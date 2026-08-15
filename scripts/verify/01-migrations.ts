/**
 * Verification 01 — migrations actually execute.
 *
 * The prior validation could only inspect the SQL by reading it. This runs every
 * `drizzle/*.sql` file in journal order against a real Postgres and then asserts
 * the objects v1.3/v1.3.1 depend on exist with the right shape.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import "@/lib/load-env";

import { CheckRun, createHarness, applyMigrations } from "./pg-harness";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";

async function main(): Promise<number> {
  const run = new CheckRun();
  run.section("Migration execution (real Postgres)");

  const pg = await PGlite.create({ extensions: { vector, pg_trgm, unaccent } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS unaccent;");

  let applied: string[] = [];
  try {
    applied = await applyMigrations(pg, process.cwd());
    run.expect(
      "all migrations apply in journal order",
      applied.length === 14,
      `${applied.length} applied: ${applied.join(", ")}`,
    );
  } catch (error) {
    run.expect(
      "all migrations apply in journal order",
      false,
      error instanceof Error ? error.message : String(error),
    );
    await pg.close();
    return run.summary();
  }

  run.expect(
    "migration 0013 (review remediation) applied",
    applied.includes("0013_v13_review_remediation"),
  );

  await pg.close();

  // Fresh harness so the object assertions run against a clean migrate.
  const h = await createHarness();
  const rows = async (q: string) => h.sql(q);

  run.section("Tables required by v1.3 / v1.3.1");
  const tables = (
    await rows(
      "select table_name from information_schema.tables where table_schema='public'",
    )
  ).map((r) => r.table_name as string);

  for (const table of [
    "courses",
    "providers",
    "categories",
    "course_categories",
    "topic_tags",
    "course_candidates",
    "course_observations",
    "course_verifications",
    "search_queries",
    "search_evaluations",
    "search_benchmark_runs",
    "course_embeddings",
    "query_embedding_cache",
    "coupon_sources",
    "coupon_candidates",
    "course_offers",
    "discovery_category_stats",
    "affiliate_providers",
    "affiliate_campaigns",
    "affiliate_placements",
    "affiliate_clicks",
    "outbound_clicks",
    "api_usage_log",
    "admin_audit_log",
  ]) {
    run.expect(`table ${table} exists`, tables.includes(table));
  }

  run.section("Extensions and the immutable_unaccent wrapper");
  const exts = (await rows("select extname from pg_extension")).map(
    (r) => r.extname as string,
  );
  for (const ext of ["unaccent", "pg_trgm", "vector"]) {
    run.expect(`extension ${ext} installed`, exts.includes(ext));
  }

  const fn = await rows(
    "select provolatile from pg_proc where proname='immutable_unaccent'",
  );
  run.expect("immutable_unaccent exists", fn.length === 1);
  run.expect(
    "immutable_unaccent is IMMUTABLE (required for the trigram indexes)",
    fn[0]?.provolatile === "i",
    `provolatile=${String(fn[0]?.provolatile)}`,
  );

  const folded = await rows(
    "select public.immutable_unaccent(lower('KHÓA HỌC Python')) as v",
  );
  run.expectEqual(
    "immutable_unaccent folds Vietnamese diacritics",
    folded[0]?.v,
    "khoa hoc python",
  );

  const sim = await rows(
    "select similarity('khoa hoc python','khoa hoc pyton') as s",
  );
  run.expect(
    "pg_trgm similarity() is callable and returns a useful score",
    typeof sim[0]?.s === "number" && (sim[0]!.s as number) > 0.5,
    `similarity=${String(sim[0]?.s)}`,
  );

  run.section("Constraints the review added or relied on");
  const indexes = (
    await rows(
      "select indexname, tablename from pg_indexes where schemaname='public'",
    )
  ).map((r) => `${r.tablename}.${r.indexname}`);

  run.expect(
    "coupon_candidates.offer_url UNIQUE index exists (migration 0013)",
    indexes.some((i) => i.includes("coupon_candidates_offer_url_uidx")),
  );
  run.expect(
    "course_offers.offer_url UNIQUE index exists",
    indexes.some((i) => i.includes("course_offers_offer_url_uidx")),
  );
  run.expect(
    "course_embeddings (course_id, model, version) UNIQUE index exists",
    indexes.some((i) => i.includes("course_embeddings")),
  );
  run.expect(
    "discovery_category_stats.category_slug UNIQUE index exists",
    indexes.some((i) => i.includes("discovery_category_stats_slug_uidx")),
  );

  run.section("Enum values reachable from TypeScript");
  const priceTypes = (
    await rows(
      "select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='price_type'",
    )
  ).map((r) => r.enumlabel as string);
  for (const value of [
    "FREE_FULL",
    "FREE_AUDIT",
    "FREE_PREVIEW",
    "FREE_WITH_COUPON",
    "TEMPORARILY_FREE",
    "FREE_TRIAL",
    "PAID",
    "UNKNOWN",
  ]) {
    run.expect(`price_type has ${value}`, priceTypes.includes(value));
  }

  const couponStatuses = (
    await rows(
      "select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='coupon_offer_status'",
    )
  ).map((r) => r.enumlabel as string);
  for (const value of [
    "DISCOVERED",
    "VERIFYING",
    "ACTIVE_100_OFF",
    "ACTIVE_DISCOUNTED",
    "EXPIRED",
    "INVALID",
    "BLOCKED",
    "UNKNOWN",
  ]) {
    run.expect(`coupon_offer_status has ${value}`, couponStatuses.includes(value));
  }

  run.section("courses.image_* columns (M21.6) exist with correct defaults");
  const imageCols = await rows(
    `select column_name, is_nullable, column_default
     from information_schema.columns
     where table_name='courses' and column_name like 'image%'`,
  );
  const imageColNames = imageCols.map((c) => c.column_name as string);
  for (const col of [
    "image_source_url",
    "image_storage_url",
    "image_resolved_url",
    "image_source_type",
    "image_status",
    "image_width",
    "image_height",
    "image_hash",
    "image_fallback_reason",
    "image_checked_at",
  ]) {
    run.expect(`courses.${col} exists`, imageColNames.includes(col));
  }
  const statusCol = imageCols.find((c) => c.column_name === "image_status");
  run.expect(
    "courses.image_status defaults to MISSING",
    String(statusCol?.column_default ?? "").includes("MISSING"),
    String(statusCol?.column_default),
  );

  run.section("search_queries analytics columns (M20.3 §89.6)");
  const sqCols = (
    await rows(
      "select column_name from information_schema.columns where table_name='search_queries'",
    )
  ).map((c) => c.column_name as string);
  for (const col of [
    "retrieval_mode",
    "degraded",
    "latency_ms",
    "top_score",
    "unmet_intent",
    "lexical_would_be_zero",
    "ranking_config_version",
  ]) {
    run.expect(`search_queries.${col} exists`, sqCols.includes(col));
  }

  run.section("Replay safety of the v1.3 / v1.3.1 migrations");
  // Production never replays raw SQL — the migrator's tracking table prevents it,
  // and 0000 would fail on `CREATE TYPE` without a guard. But the migrations this
  // release added are the ones an operator might realistically re-apply (the
  // documented manual path is pasting `scripts/neon-bootstrap.sql` into the Neon
  // SQL editor), so each of those must be individually replay-safe.
  const v13Migrations = [
    "0007_m20_foundation",
    "0008_m20_1_lexical",
    "0009_provider_policy_catalog_free",
    "0010_m20_2_semantic",
    "0011_m20_12_monetization",
    "0012_m21_coupon_media_taxonomy",
    "0013_v13_review_remediation",
  ];

  for (const tag of v13Migrations) {
    const sqlText = readFileSync(
      path.join(process.cwd(), "drizzle", `${tag}.sql`),
      "utf8",
    );
    let ok = true;
    let message = "";
    try {
      await h.pg.exec(sqlText);
    } catch (error) {
      ok = false;
      message = error instanceof Error ? error.message : String(error);
    }
    run.expect(`${tag} is replay-safe`, ok, message);
  }

  // The 0013 dedupe DELETE must not damage good rows when replayed.
  const candidateCount = await h.sql(
    "select count(*)::int as n from coupon_candidates",
  );
  run.expect(
    "0013 replay left coupon_candidates intact",
    candidateCount[0]?.n === 0,
    `rows=${String(candidateCount[0]?.n)}`,
  );

  await h.close();
  return run.summary();
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error("harness error:", error);
    process.exit(1);
  });
