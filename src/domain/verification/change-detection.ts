import type {
  CertificateType,
  CourseStatus,
  PriceType,
} from "@/domain/course/types";

export type CourseChangeKind =
  | "PRICE_CHANGED"
  | "CERTIFICATE_CHANGED"
  | "BECAME_UNAVAILABLE"
  | "BECAME_AVAILABLE"
  | "TITLE_CHANGED"
  | "URL_CHANGED"
  | "STATUS_CHANGED";

export type CourseChange = {
  kind: CourseChangeKind;
  from: string;
  to: string;
};

export function detectCourseChanges(input: {
  previous: {
    priceType: PriceType;
    certificateType: CertificateType;
    status: CourseStatus;
    title: string;
    canonicalUrl: string;
  };
  next: {
    priceType: PriceType;
    certificateType: CertificateType;
    status: CourseStatus;
    title: string;
    canonicalUrl: string;
  };
}): CourseChange[] {
  const changes: CourseChange[] = [];

  if (input.previous.priceType !== input.next.priceType) {
    changes.push({
      kind: "PRICE_CHANGED",
      from: input.previous.priceType,
      to: input.next.priceType,
    });
  }

  if (input.previous.certificateType !== input.next.certificateType) {
    changes.push({
      kind: "CERTIFICATE_CHANGED",
      from: input.previous.certificateType,
      to: input.next.certificateType,
    });
  }

  if (input.previous.status !== input.next.status) {
    changes.push({
      kind: "STATUS_CHANGED",
      from: input.previous.status,
      to: input.next.status,
    });

    if (
      input.next.status === "UNAVAILABLE" ||
      input.next.status === "EXPIRED"
    ) {
      changes.push({
        kind: "BECAME_UNAVAILABLE",
        from: input.previous.status,
        to: input.next.status,
      });
    }

    if (
      input.previous.status !== "PUBLISHED" &&
      input.next.status === "PUBLISHED"
    ) {
      changes.push({
        kind: "BECAME_AVAILABLE",
        from: input.previous.status,
        to: input.next.status,
      });
    }
  }

  if (normalizeTitle(input.previous.title) !== normalizeTitle(input.next.title)) {
    // Only flag material title changes (length delta or token distance)
    if (isMaterialTitleChange(input.previous.title, input.next.title)) {
      changes.push({
        kind: "TITLE_CHANGED",
        from: input.previous.title,
        to: input.next.title,
      });
    }
  }

  if (input.previous.canonicalUrl !== input.next.canonicalUrl) {
    changes.push({
      kind: "URL_CHANGED",
      from: input.previous.canonicalUrl,
      to: input.next.canonicalUrl,
    });
  }

  return changes;
}

export function summarizeChanges(changes: CourseChange[]): string | null {
  if (changes.length === 0) return null;
  return changes.map((change) => `${change.from}→${change.to}`).join("; ");
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isMaterialTitleChange(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return false;
  if (na.includes(nb) || nb.includes(na)) {
    // "Python Basics" vs "Python Basics Advanced" — material
    return Math.abs(na.length - nb.length) >= 4;
  }
  return true;
}
