const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";

const PATHS = [
  "/vi/tracker",
  "/vi/course/nope",
  "/vi/category/nope",
  "/vi/topic/nope",
  "/vi/provider/nope",
  "/vi/collections/nope",
  "/vi/free-courses/nope",
  "/vi/course/draft-course-not-live",
  "/vi/nonexistent-route",
  "/vi",
  "/vi/course/python-cho-nguoi-moi",
  "/vi/mien-phi-hom-nay",
];

async function main() {
  for (const pathname of PATHS) {
    const response = await fetch(`${BASE}${pathname}`, { redirect: "manual" });
    const body = await response.text();
    const title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const lang = body.match(/<html[^>]*lang="([^"]*)"/)?.[1] ?? "-";
    console.log(
      `${String(response.status).padEnd(4)} lang=${lang.padEnd(4)} ${pathname.padEnd(36)} ${title.slice(0, 44)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
