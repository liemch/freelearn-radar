import { createEvidence, type EvidenceRecord } from "@/domain/verification/evidence";
import { validateSafeFetchUrl } from "@/lib/safe-fetch-url";

export type ExtractedOpenGraph = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
};

export type ExtractedMetadata = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  openGraph: ExtractedOpenGraph;
  jsonLd: Record<string, unknown>[];
  images: string[];
  textExcerpt: string;
  evidence: EvidenceRecord[];
  warnings: string[];
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
      "i",
    );
    const match = html.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (value) return decodeHtmlEntities(value.trim());
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return decodeHtmlEntities(stripTags(match[1])).slice(0, 300) || null;
}

function extractCanonical(html: string, baseUrl: string): string | null {
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i,
  );
  const href = match?.[1] ?? match?.[2];
  if (!href) return null;
  try {
    const absolute = new URL(href, baseUrl).toString();
    return validateSafeFetchUrl(absolute).ok ? absolute : null;
  } catch {
    return null;
  }
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            blocks.push(item as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Malformed JSON-LD is ignored — never throws.
    }
  }
  return blocks;
}

function collectCourseLikeNodes(
  nodes: Record<string, unknown>[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    const types = Array.isArray(type)
      ? type.map(String)
      : type
        ? [String(type)]
        : [];
    if (
      types.some((value) =>
        /Course|EducationalOccupationalProgram|LearningResource/i.test(value),
      )
    ) {
      out.push(record);
    }
    if (record["@graph"]) visit(record["@graph"]);
  }

  for (const node of nodes) visit(node);
  return out;
}

function absoluteUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const absolute = new URL(value, baseUrl).toString();
    return validateSafeFetchUrl(absolute).ok ? absolute : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic metadata extraction. No AI.
 * Priority: JSON-LD → OpenGraph → HTML meta → bounded page text.
 */
export function extractPageMetadata(input: {
  html: string;
  baseUrl: string;
  sourceProvider?: string | null;
  includeDeepText?: boolean;
  maxTextChars?: number;
}): ExtractedMetadata {
  const warnings: string[] = [];
  const evidence: EvidenceRecord[] = [];
  const html = input.html.slice(0, 1_000_000);
  const maxText = input.maxTextChars ?? 8_000;

  const jsonLd = extractJsonLd(html);
  const courseNodes = collectCourseLikeNodes(jsonLd);

  const og: ExtractedOpenGraph = {
    title: metaContent(html, ["og:title"]) ?? undefined,
    description: metaContent(html, ["og:description"]) ?? undefined,
    image: metaContent(html, ["og:image", "og:image:url"]) ?? undefined,
    url: metaContent(html, ["og:url"]) ?? undefined,
    siteName: metaContent(html, ["og:site_name"]) ?? undefined,
  };

  const htmlTitle = extractTitle(html);
  const htmlDescription = metaContent(html, ["description"]);
  const canonicalUrl = extractCanonical(html, input.baseUrl);

  let title: string | null = null;
  let description: string | null = null;

  const firstCourse = courseNodes[0];
  if (firstCourse) {
    const jdTitle =
      typeof firstCourse.name === "string"
        ? firstCourse.name
        : typeof firstCourse.headline === "string"
          ? firstCourse.headline
          : null;
    const jdDescription =
      typeof firstCourse.description === "string"
        ? firstCourse.description
        : null;
    if (jdTitle) {
      title = jdTitle.slice(0, 300);
      evidence.push(
        createEvidence({
          type: "TITLE",
          sourceUrl: input.baseUrl,
          sourceProvider: input.sourceProvider ?? null,
          observedValue: title,
          confidence: 0.9,
          method: "PAGE_METADATA",
        }),
      );
    }
    if (jdDescription) {
      description = jdDescription.slice(0, 2000);
      evidence.push(
        createEvidence({
          type: "METADATA",
          sourceUrl: input.baseUrl,
          sourceProvider: input.sourceProvider ?? null,
          observedValue: `jsonld_description:${description.slice(0, 240)}`,
          confidence: 0.85,
          method: "PAGE_METADATA",
        }),
      );
    }
  }

  if (!title && og.title) {
    title = og.title.slice(0, 300);
    evidence.push(
      createEvidence({
        type: "TITLE",
        sourceUrl: input.baseUrl,
        sourceProvider: input.sourceProvider ?? null,
        observedValue: title,
        confidence: 0.8,
        method: "PAGE_METADATA",
      }),
    );
  }

  if (!description && og.description) {
    description = og.description.slice(0, 2000);
    evidence.push(
      createEvidence({
        type: "METADATA",
        sourceUrl: input.baseUrl,
        sourceProvider: input.sourceProvider ?? null,
        observedValue: `og_description:${description.slice(0, 240)}`,
        confidence: 0.75,
        method: "PAGE_METADATA",
      }),
    );
  }

  if (!title && htmlTitle) title = htmlTitle;
  if (!description && htmlDescription) description = htmlDescription.slice(0, 2000);

  if (canonicalUrl) {
    evidence.push(
      createEvidence({
        type: "URL",
        sourceUrl: input.baseUrl,
        sourceProvider: input.sourceProvider ?? null,
        observedValue: canonicalUrl,
        confidence: 0.85,
        method: "PAGE_METADATA",
      }),
    );
  }

  const images: string[] = [];
  const ogImage = absoluteUrl(og.image, input.baseUrl);
  if (ogImage) images.push(ogImage);

  for (const node of courseNodes) {
    const image = node.image;
    if (typeof image === "string") {
      const abs = absoluteUrl(image, input.baseUrl);
      if (abs) images.push(abs);
    } else if (image && typeof image === "object" && "url" in image) {
      const abs = absoluteUrl(String((image as { url: unknown }).url), input.baseUrl);
      if (abs) images.push(abs);
    }
  }

  let textExcerpt = "";
  if (input.includeDeepText !== false) {
    textExcerpt = stripTags(html).slice(0, maxText);
    if (textExcerpt.length < 40) {
      warnings.push("thin_page_text");
    }
  } else {
    textExcerpt = [title, description].filter(Boolean).join("\n").slice(0, maxText);
  }

  if (!title && !description && !textExcerpt) {
    warnings.push("missing_metadata");
  }

  // Deduplicate images
  const uniqueImages = [...new Set(images)];

  return {
    title,
    description,
    canonicalUrl,
    openGraph: {
      ...og,
      image: ogImage ?? og.image,
      url: absoluteUrl(og.url, input.baseUrl) ?? og.url,
    },
    jsonLd: courseNodes,
    images: uniqueImages,
    textExcerpt,
    evidence,
    warnings,
  };
}
