import postgres from "postgres";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await client`
    select id, slug from courses where slug in ('python-cho-nguoi-moi','ai-for-beginners')`;
  const ids = rows.map((r) => r.id).join(",");
  const slugs = rows.map((r) => r.slug).join(",");
  await client.end();

  for (const [label, url] of [
    ["no params", "/vi/compare"],
    ["slugs via compare=", `/vi/compare?compare=${slugs}`],
    ["slugs via ids=", `/vi/compare?ids=${slugs}`],
    ["uuids via ids=", `/vi/compare?ids=${ids}`],
    ["uuids via compare=", `/vi/compare?compare=${ids}`],
  ] as const) {
    const r = await fetch(`${BASE}${url}`, { redirect: "manual" });
    const b = await r.text();
    const title = b.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const hasPython = b.includes("Khóa học Python cho người mới");
    const hasAi = b.includes("AI for Beginners");
    console.log(
      `${label.padEnd(22)} ${r.status} title="${title.slice(0, 34)}" python=${hasPython} ai=${hasAi}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
