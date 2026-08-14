import { or, sql, type SQL } from "drizzle-orm";

import { categories, courseCategories, courses, providers } from "@/db/schema";
import { courseTopicTags, topicTags } from "@/db/schema/topic-tags";
import {
  LEXICAL_TITLE_SIMILARITY_THRESHOLD,
  prepareLexicalQuery,
  type PreparedLexicalQuery,
} from "@/domain/search/lexical";

/**
 * Weighted lexical match for catalog search (M20.1 §87).
 * Relies on migration 0008: immutable_unaccent + pg_trgm.
 */
export function buildLexicalMatchCondition(rawQuery: string): SQL | null {
  const prepared = prepareLexicalQuery(rawQuery);
  if (!prepared) return null;

  const pattern = prepared.likePattern;
  const folded = prepared.foldedExpanded;
  const threshold = LEXICAL_TITLE_SIMILARITY_THRESHOLD;

  return or(
    sql`public.immutable_unaccent(lower(coalesce(${courses.title}, ''))) like ${pattern} escape '\\'`,
    sql`public.immutable_unaccent(lower(coalesce(${courses.shortDescription}, ''))) like ${pattern} escape '\\'`,
    sql`public.immutable_unaccent(lower(coalesce(${courses.description}, ''))) like ${pattern} escape '\\'`,
    sql`public.immutable_unaccent(lower(coalesce(${providers.name}, ''))) like ${pattern} escape '\\'`,
    sql`similarity(public.immutable_unaccent(lower(coalesce(${courses.title}, ''))), ${folded}) >= ${threshold}`,
    sql`exists (
      select 1
      from ${courseCategories} sc
      join ${categories} scat on scat.id = sc.category_id
      where sc.course_id = ${courses.id}
        and public.immutable_unaccent(lower(coalesce(scat.name, ''))) like ${pattern} escape '\\'
    )`,
    sql`exists (
      select 1
      from ${courseTopicTags} ctt
      join ${topicTags} tt on tt.id = ctt.tag_id
      where ctt.course_id = ${courses.id}
        and (
          public.immutable_unaccent(lower(coalesce(tt.name_en, ''))) like ${pattern} escape '\\'
          or public.immutable_unaccent(lower(coalesce(tt.name_vi, ''))) like ${pattern} escape '\\'
          or public.immutable_unaccent(lower(coalesce(tt.slug, ''))) like ${pattern} escape '\\'
        )
    )`,
  )!;
}

/**
 * Ranking score: title > topic tags > short description > description > provider,
 * plus title trigram similarity. Higher is better.
 */
export function buildLexicalRankExpression(rawQuery: string): SQL | null {
  const prepared = prepareLexicalQuery(rawQuery);
  if (!prepared) return null;
  return lexicalRankSql(prepared);
}

function lexicalRankSql(prepared: PreparedLexicalQuery): SQL {
  const pattern = prepared.likePattern;
  const folded = prepared.foldedExpanded;

  return sql`(
    (case when public.immutable_unaccent(lower(coalesce(${courses.title}, ''))) like ${pattern} escape '\\' then 3.0 else 0 end)
    + (case when exists (
         select 1 from ${courseTopicTags} ctt
         join ${topicTags} tt on tt.id = ctt.tag_id
         where ctt.course_id = ${courses.id}
           and (
             public.immutable_unaccent(lower(coalesce(tt.name_en, ''))) like ${pattern} escape '\\'
             or public.immutable_unaccent(lower(coalesce(tt.name_vi, ''))) like ${pattern} escape '\\'
           )
       ) then 2.0 else 0 end)
    + (case when public.immutable_unaccent(lower(coalesce(${courses.shortDescription}, ''))) like ${pattern} escape '\\' then 1.5 else 0 end)
    + (case when public.immutable_unaccent(lower(coalesce(${courses.description}, ''))) like ${pattern} escape '\\' then 1.0 else 0 end)
    + (case when public.immutable_unaccent(lower(coalesce(${providers.name}, ''))) like ${pattern} escape '\\' then 1.2 else 0 end)
    + (similarity(public.immutable_unaccent(lower(coalesce(${courses.title}, ''))), ${folded}) * 2.0)
  )`;
}
