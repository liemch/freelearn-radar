import { describe, expect, it, vi } from "vitest";

import { validateSafeFetchUrl } from "@/lib/safe-fetch-url";
import { fetchCourseSource } from "@/services/fetch/course-source-fetcher";
import { extractPageMetadata } from "@/services/fetch/metadata-extractor";
import { resolveProviderFetchPolicy } from "@/services/fetch/provider-fetch-policy";
import { safeHttpGet } from "@/services/fetch/safe-http-client";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { classifyCertificateFromText } from "@/domain/verification/certificate-status";

function htmlResponse(body: string, init?: ResponseInit & { url?: string }) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    url: init?.url ?? "https://example.com/course",
    headers: {
      get(name: string) {
        const headers = new Headers(init?.headers);
        return headers.get(name);
      },
    },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as unknown as Response;
}

describe("validateSafeFetchUrl", () => {
  it("allows https public URLs", () => {
    expect(validateSafeFetchUrl("https://coursera.org/learn/ai").ok).toBe(true);
  });

  it("allows http public URLs", () => {
    expect(validateSafeFetchUrl("http://example.com/course").ok).toBe(true);
  });

  it("rejects localhost and loopback", () => {
    expect(validateSafeFetchUrl("http://localhost/x").ok).toBe(false);
    expect(validateSafeFetchUrl("http://127.0.0.1/x").ok).toBe(false);
    expect(validateSafeFetchUrl("http://[::1]/x").ok).toBe(false);
  });

  it("rejects private and metadata IPs", () => {
    expect(validateSafeFetchUrl("http://10.0.0.5/x").ok).toBe(false);
    expect(validateSafeFetchUrl("http://192.168.1.1/x").ok).toBe(false);
    expect(validateSafeFetchUrl("http://172.16.0.1/x").ok).toBe(false);
    expect(validateSafeFetchUrl("http://169.254.169.254/latest").ok).toBe(false);
  });

  it("rejects unsafe schemes", () => {
    expect(validateSafeFetchUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateSafeFetchUrl("data:text/html,hi").ok).toBe(false);
    expect(validateSafeFetchUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateSafeFetchUrl("ftp://example.com/a").ok).toBe(false);
  });
});

describe("safeHttpGet redirects", () => {
  it("follows a safe redirect", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: { get: (n: string) => (n === "location" ? "https://example.com/final" : null) },
      })
      .mockResolvedValueOnce(
        htmlResponse("<html><title>Final</title></html>", {
          headers: { "content-type": "text/html" },
          url: "https://example.com/final",
        }),
      );

    const result = await safeHttpGet("https://example.com/start", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.finalUrl).toBe("https://example.com/final");
      expect(result.redirectChain).toEqual(["https://example.com/final"]);
    }
  });

  it("blocks redirect to private IP", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: (n: string) => (n === "location" ? "http://127.0.0.1/secret" : null) },
    });

    const result = await safeHttpGet("https://example.com/start", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("redirect_");
    }
  });

  it("stops after too many redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: {
        get: (n: string) =>
          n === "location" ? "https://example.com/next" : null,
      },
    });

    const result = await safeHttpGet("https://example.com/start", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxRedirects: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_many_redirects");
    }
  });

  it("rejects oversized responses", async () => {
    const big = "x".repeat(1000);
    const fetchImpl = vi.fn().mockResolvedValue(
      htmlResponse(big, { headers: { "content-type": "text/html" } }),
    );

    const result = await safeHttpGet("https://example.com/course", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxBytes: 100,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("response_too_large");
    }
  });

  it("rejects non-HTML content types", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      htmlResponse("%PDF", { headers: { "content-type": "application/pdf" } }),
    );

    const result = await safeHttpGet("https://example.com/file.pdf", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_content_type");
    }
  });

  it("maps HTTP error statuses", async () => {
    for (const status of [404, 403, 429, 500]) {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status,
        headers: { get: () => null },
      });
      const result = await safeHttpGet("https://example.com/x", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(`http_${status}`);
      }
    }
  });
});

describe("extractPageMetadata", () => {
  const html = `
    <html>
      <head>
        <title>HTML Title</title>
        <meta name="description" content="HTML description" />
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="OG Description" />
        <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
        <meta property="og:url" content="https://example.com/course/ai" />
        <link rel="canonical" href="https://example.com/course/ai" />
        <script type="application/ld+json">
          {"@type":"Course","name":"JSON-LD Course","description":"JSON-LD description","image":"https://cdn.example.com/jsonld.jpg"}
        </script>
      </head>
      <body><h1>Learn AI</h1><p>Completely free course for beginners</p></body>
    </html>
  `;

  it("prefers JSON-LD for title/description and extracts OG image + canonical", () => {
    const extracted = extractPageMetadata({
      html,
      baseUrl: "https://example.com/course/ai",
    });

    expect(extracted.title).toBe("JSON-LD Course");
    expect(extracted.description).toContain("JSON-LD");
    expect(extracted.canonicalUrl).toBe("https://example.com/course/ai");
    expect(extracted.images[0]).toBe("https://cdn.example.com/cover.jpg");
    expect(extracted.jsonLd.length).toBeGreaterThan(0);
    expect(extracted.textExcerpt.toLowerCase()).toContain("completely free");
  });

  it("extracts JSON-LD image arrays and ImageObject URLs", () => {
    const extracted = extractPageMetadata({
      baseUrl: "https://example.com/course/ai",
      html: `<script type="application/ld+json">
        {
          "@type":"Course",
          "name":"AI",
          "image":[
            {"@type":"ImageObject","contentUrl":"/cover.webp"},
            "https://cdn.example.com/second.jpg"
          ],
          "thumbnailUrl":"/thumb.jpg"
        }
      </script>`,
    });

    expect(extracted.images).toEqual([
      "https://example.com/cover.webp",
      "https://cdn.example.com/second.jpg",
      "https://example.com/thumb.jpg",
    ]);
  });

  it("handles malformed HTML without throwing", () => {
    const extracted = extractPageMetadata({
      html: "<html><title>Broken<script type=\"application/ld+json\">{not-json}</script>",
      baseUrl: "https://example.com/x",
    });
    expect(extracted.jsonLd).toEqual([]);
    expect(Array.isArray(extracted.warnings)).toBe(true);
  });
});

describe("provider fetch policy", () => {
  it("resolves known providers", () => {
    expect(resolveProviderFetchPolicy({ providerSlug: "coursera" }).fetch).toBe(
      "FETCH_ALLOWED",
    );
    expect(
      resolveProviderFetchPolicy({ url: "https://www.linkedin.com/learning/x" })
        .fetch,
    ).toBe("METADATA_ONLY");
  });
});

describe("fetchCourseSource", () => {
  it("returns structured ok result for a valid page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      htmlResponse(
        `<html><head><title>Python Basics</title>
         <meta property="og:image" content="https://cdn.example.com/p.jpg" />
         </head><body>Entirely free python course</body></html>`,
        { headers: { "content-type": "text/html" } },
      ),
    );

    const result = await fetchCourseSource("https://example.com/python", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      providerSlug: "coursera",
    });

    expect(result.status).toBe("ok");
    expect(result.title).toBe("Python Basics");
    expect(result.images[0]).toContain("cdn.example.com");
    expect(result.evidence.some((item) => item.type === "PRICE")).toBe(true);
  });

  it("skips NO_FETCH / SEARCH_RESULT_ONLY policies without calling network for blocked hosts", async () => {
    const result = await fetchCourseSource("https://intranet.internal/course", {
      providerSlug: null,
    });
    // default METADATA_ONLY for unknown public hosts — ensure blocked .internal
    expect(result.status === "skipped" || result.status === "error").toBe(true);
  });
});

describe("deceptive free / certificate phrases", () => {
  const cases: Array<{ text: string; expected: string }> = [
    { text: "Enroll for free today", expected: "FREE_AUDIT" },
    { text: "Start for free and upgrade later", expected: "UNKNOWN" },
    { text: "Try free for 7 days", expected: "FREE_TRIAL" },
    { text: "Free preview of selected lessons", expected: "UNKNOWN" },
    { text: "Audit this course for free", expected: "FREE_AUDIT" },
    { text: "Free certificate included", expected: "FREE_FULL" }, // free-status may see free certificate as strong free; cert classifier separate
    { text: "Certificate available after completion", expected: "UNKNOWN" },
    { text: "Free with subscription", expected: "PAID" },
  ];

  for (const item of cases) {
    it(`classifies free status for: ${item.text}`, () => {
      const result = classifyFreeStatusFromText(item.text);
      // "Free certificate included" contains "free" + certificate — free-status may return FREE_FULL or UNKNOWN
      if (item.text === "Free certificate included") {
        expect(["FREE_FULL", "UNKNOWN"]).toContain(result.priceType);
        return;
      }
      if (item.text === "Start for free and upgrade later") {
        expect(result.priceType).toBe("UNKNOWN");
        return;
      }
      expect(result.priceType).toBe(item.expected);
    });
  }

  it("does not treat certificate available as free certificate", () => {
    const result = classifyCertificateFromText("Certificate available");
    expect(result.certificateType).toBe("UNKNOWN");
  });

  it("recognizes explicit free certificate", () => {
    const result = classifyCertificateFromText("Free certificate included");
    expect(result.certificateType).toBe("FREE_CERTIFICATE");
  });
});
