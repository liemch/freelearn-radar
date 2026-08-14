/**
 * M21.1 — Multi-domain taxonomy expansion.
 * Reuse existing Tech categories; add non-Tech domains without duplicates.
 */

export type TaxonomyCategorySeed = {
  slug: string;
  /** Display name (Vietnamese public UI). */
  nameVi: string;
  /** English catalog / seed alias. */
  nameEn: string;
  /** Optional description for admin/SEO. */
  description?: string;
  /** Existing slug this maps from (rename/reuse). */
  mapsFrom?: string[];
};

/**
 * Top-level domains. Existing Tech slugs kept; soft-skills/business/design/
 * marketing/project-management/product-management reused rather than duplicated.
 */
export const M21_TAXONOMY_CATEGORIES: TaxonomyCategorySeed[] = [
  {
    slug: "cong-nghe-it",
    nameVi: "Công nghệ & IT",
    nameEn: "Technology & IT",
    mapsFrom: [
      "ai",
      "programming",
      "data-science",
      "cybersecurity",
      "cloud",
      "devops",
    ],
    description: "Nhóm Tech hiện hữu — giữ slug cũ làm topic/category lá.",
  },
  {
    slug: "ai",
    nameVi: "Trí tuệ nhân tạo",
    nameEn: "Artificial Intelligence",
  },
  {
    slug: "programming",
    nameVi: "Lập trình",
    nameEn: "Programming",
  },
  {
    slug: "data-science",
    nameVi: "Khoa học dữ liệu",
    nameEn: "Data Science",
  },
  {
    slug: "cybersecurity",
    nameVi: "An ninh mạng",
    nameEn: "Cybersecurity",
  },
  {
    slug: "cloud",
    nameVi: "Điện toán đám mây",
    nameEn: "Cloud",
  },
  {
    slug: "devops",
    nameVi: "DevOps",
    nameEn: "DevOps",
  },
  {
    slug: "business",
    nameVi: "Kinh doanh & Quản lý",
    nameEn: "Business & Management",
    mapsFrom: ["project-management", "product-management", "marketing"],
  },
  {
    slug: "project-management",
    nameVi: "Quản lý dự án",
    nameEn: "Project Management",
  },
  {
    slug: "product-management",
    nameVi: "Quản lý sản phẩm",
    nameEn: "Product Management",
  },
  {
    slug: "marketing",
    nameVi: "Marketing",
    nameEn: "Marketing",
  },
  {
    slug: "finance",
    nameVi: "Tài chính",
    nameEn: "Finance",
  },
  {
    slug: "soft-skills",
    nameVi: "Kỹ năng mềm",
    nameEn: "Soft Skills",
  },
  {
    slug: "personal-development",
    nameVi: "Phát triển bản thân",
    nameEn: "Personal Development",
  },
  {
    slug: "lifestyle-health",
    nameVi: "Cuộc sống & Sức khỏe",
    nameEn: "Lifestyle & Health",
  },
  {
    slug: "design",
    nameVi: "Thiết kế & Sáng tạo",
    nameEn: "Design & Creativity",
  },
  {
    slug: "languages",
    nameVi: "Ngoại ngữ",
    nameEn: "Languages",
  },
  {
    slug: "office-productivity",
    nameVi: "Văn phòng & Công việc",
    nameEn: "Office & Productivity",
  },
  {
    slug: "education",
    nameVi: "Giáo dục",
    nameEn: "Education",
  },
  {
    slug: "science-engineering",
    nameVi: "Khoa học & Kỹ thuật",
    nameEn: "Science & Engineering",
  },
  {
    slug: "humanities",
    nameVi: "Xã hội & Nhân văn",
    nameEn: "Society & Humanities",
  },
  {
    slug: "career",
    nameVi: "Nghề nghiệp",
    nameEn: "Career",
  },
];

/** Categories that get discovery budget attention (avoid Tech-only starvation). */
export const DISCOVERY_BUDGET_CATEGORY_SLUGS = [
  "ai",
  "programming",
  "data-science",
  "cybersecurity",
  "cloud",
  "devops",
  "business",
  "project-management",
  "finance",
  "soft-skills",
  "personal-development",
  "lifestyle-health",
  "design",
  "languages",
  "office-productivity",
  "education",
  "science-engineering",
  "humanities",
  "career",
  "marketing",
  "product-management",
] as const;

/** Quick-domain chips on homepage (Vietnamese labels via category name). */
export const HOMEPAGE_QUICK_DOMAIN_SLUGS = [
  "soft-skills",
  "programming",
  "ai",
  "business",
  "languages",
  "personal-development",
  "office-productivity",
  "finance",
  "lifestyle-health",
  "design",
] as const;

/** Deterministic alias → category slug for classifier. */
export const CATEGORY_ALIAS_DICTIONARY: Record<string, string> = {
  // EN
  "soft skills": "soft-skills",
  communication: "soft-skills",
  "public speaking": "soft-skills",
  negotiation: "soft-skills",
  leadership: "soft-skills",
  "time management": "personal-development",
  productivity: "personal-development",
  habits: "personal-development",
  mindfulness: "lifestyle-health",
  yoga: "lifestyle-health",
  nutrition: "lifestyle-health",
  excel: "office-productivity",
  "microsoft excel": "office-productivity",
  "google sheets": "office-productivity",
  "power point": "office-productivity",
  powerpoint: "office-productivity",
  english: "languages",
  "english speaking": "languages",
  ielts: "languages",
  toeic: "languages",
  finance: "finance",
  accounting: "finance",
  investing: "finance",
  "personal finance": "finance",
  career: "career",
  resume: "career",
  interview: "career",
  teaching: "education",
  pedagogy: "education",
  physics: "science-engineering",
  chemistry: "science-engineering",
  history: "humanities",
  philosophy: "humanities",
  psychology: "humanities",
  // VI
  "kỹ năng mềm": "soft-skills",
  "giao tiếp": "soft-skills",
  "thuyết trình": "soft-skills",
  "phát triển bản thân": "personal-development",
  "quản lý thời gian": "personal-development",
  "ngoại ngữ": "languages",
  "tiếng anh": "languages",
  "tài chính": "finance",
  "văn phòng": "office-productivity",
  "cuộc sống": "lifestyle-health",
  "sức khỏe": "lifestyle-health",
  "nghề nghiệp": "career",
  "giáo dục": "education",
};

export function resolveCategoryAlias(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (CATEGORY_ALIAS_DICTIONARY[key]) {
    return CATEGORY_ALIAS_DICTIONARY[key]!;
  }
  for (const [alias, slug] of Object.entries(CATEGORY_ALIAS_DICTIONARY)) {
    if (key.includes(alias)) return slug;
  }
  return null;
}

/** Seed rows for categories table: unique by slug, Vietnamese display name. */
export function buildExpandedCategorySeeds(): Array<{
  name: string;
  slug: string;
  description?: string;
}> {
  const seen = new Set<string>();
  const rows: Array<{ name: string; slug: string; description?: string }> = [];
  for (const cat of M21_TAXONOMY_CATEGORIES) {
    if (seen.has(cat.slug)) continue;
    // Skip umbrella-only cong-nghe-it — keep leaf Tech categories as browsable.
    if (cat.slug === "cong-nghe-it") continue;
    seen.add(cat.slug);
    rows.push({
      name: cat.nameVi,
      slug: cat.slug,
      description: cat.nameEn,
    });
  }
  return rows;
}
