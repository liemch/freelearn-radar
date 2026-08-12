import type {
  CertificateType,
  CourseLevel,
  PriceType,
} from "@/domain/course/types";

export type SeedCourse = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  providerSlug: string;
  categorySlugs: string[];
  canonicalUrl: string;
  instructor: string;
  language: string;
  level: CourseLevel;
  durationMinutes: number;
  priceType: PriceType;
  certificateType: CertificateType;
  qualityScore: number;
  aiScore: number;
  editorScore: number;
  whyLearn: string;
};

export const SEED_COURSES: SeedCourse[] = [
  {
    slug: "generative-ai-fundamentals",
    title: "Generative AI Fundamentals",
    shortDescription: "Learn the foundations of generative AI and prompt design.",
    description:
      "A beginner-friendly introduction to generative AI concepts, model types, and practical prompting patterns for learners exploring AI careers.",
    providerSlug: "coursera",
    categorySlugs: ["ai"],
    canonicalUrl: "https://www.coursera.org/learn/generative-ai-fundamentals",
    instructor: "Andrew Ng",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 360,
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    qualityScore: 88,
    aiScore: 86,
    editorScore: 90,
    whyLearn: "Strong foundation for anyone starting an AI learning path.",
  },
  {
    slug: "python-for-everybody",
    title: "Python for Everybody",
    shortDescription: "Start programming with Python from absolute zero.",
    description:
      "A practical Python course covering variables, loops, files, and basic data structures for beginners.",
    providerSlug: "coursera",
    categorySlugs: ["programming", "data-science"],
    canonicalUrl: "https://www.coursera.org/specializations/python",
    instructor: "Charles Severance",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 1200,
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    qualityScore: 92,
    aiScore: 90,
    editorScore: 93,
    whyLearn: "One of the most proven free-to-audit Python starting points.",
  },
  {
    slug: "responsive-web-design",
    title: "Responsive Web Design",
    shortDescription: "Build responsive websites with HTML and CSS.",
    description:
      "freeCodeCamp curriculum covering HTML, CSS Flexbox, Grid, and accessibility fundamentals.",
    providerSlug: "freecodecamp",
    categorySlugs: ["programming", "design"],
    canonicalUrl: "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
    instructor: "freeCodeCamp",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 1800,
    priceType: "FREE_FULL",
    certificateType: "FREE_CERTIFICATE",
    qualityScore: 91,
    aiScore: 89,
    editorScore: 92,
    whyLearn: "Fully free curriculum with a free certificate and hands-on projects.",
  },
  {
    slug: "azure-fundamentals",
    title: "Azure Fundamentals",
    shortDescription: "Understand core Azure cloud concepts and services.",
    description:
      "Microsoft Learn path covering cloud concepts, Azure architecture, and core services.",
    providerSlug: "microsoft-learn",
    categorySlugs: ["cloud"],
    canonicalUrl: "https://learn.microsoft.com/training/paths/azure-fundamentals/",
    instructor: "Microsoft Learn",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 480,
    priceType: "FREE_FULL",
    certificateType: "PAID_CERTIFICATE",
    qualityScore: 84,
    aiScore: 82,
    editorScore: 85,
    whyLearn: "Official Microsoft content and a strong entry point into cloud.",
  },
  {
    slug: "introduction-to-cybersecurity",
    title: "Introduction to Cybersecurity",
    shortDescription: "Explore cybersecurity concepts and career paths.",
    description:
      "An overview of threats, defenses, and foundational security practices for newcomers.",
    providerSlug: "edx",
    categorySlugs: ["cybersecurity"],
    canonicalUrl: "https://www.edx.org/learn/cybersecurity",
    instructor: "edX Instructors",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 420,
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    qualityScore: 78,
    aiScore: 76,
    editorScore: 80,
    whyLearn: "Clear overview if you are testing interest in security roles.",
  },
  {
    slug: "sql-for-data-analysis",
    title: "SQL for Data Analysis",
    shortDescription: "Query and analyze data with practical SQL skills.",
    description:
      "Hands-on SQL lessons for filtering, joining, aggregating, and answering business questions.",
    providerSlug: "udemy",
    categorySlugs: ["data-science", "programming"],
    canonicalUrl: "https://www.udemy.com/course/sql-for-data-analysis",
    instructor: "Data Instructors",
    language: "English",
    level: "INTERMEDIATE",
    durationMinutes: 540,
    priceType: "TEMPORARILY_FREE",
    certificateType: "FREE_CERTIFICATE",
    qualityScore: 81,
    aiScore: 80,
    editorScore: 82,
    whyLearn: "Practical SQL practice that transfers directly to analyst roles.",
  },
  {
    slug: "devops-essentials",
    title: "DevOps Essentials",
    shortDescription: "Learn CI/CD, containers, and delivery basics.",
    description:
      "An introductory DevOps course covering pipelines, containers, and collaboration practices.",
    providerSlug: "udemy",
    categorySlugs: ["devops", "cloud"],
    canonicalUrl: "https://www.udemy.com/course/devops-essentials",
    instructor: "DevOps Mentors",
    language: "English",
    level: "INTERMEDIATE",
    durationMinutes: 600,
    priceType: "FREE_WITH_COUPON",
    certificateType: "FREE_CERTIFICATE",
    qualityScore: 74,
    aiScore: 73,
    editorScore: 75,
    whyLearn: "Useful bridge between coding and cloud operations.",
  },
  {
    slug: "product-management-foundations",
    title: "Product Management Foundations",
    shortDescription: "Learn how product managers discover and ship value.",
    description:
      "Covers discovery, prioritization, roadmapping, and stakeholder communication for aspiring PMs.",
    providerSlug: "coursera",
    categorySlugs: ["product-management", "business"],
    canonicalUrl: "https://www.coursera.org/learn/product-management-foundations",
    instructor: "Product Faculty",
    language: "English",
    level: "BEGINNER",
    durationMinutes: 480,
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    qualityScore: 79,
    aiScore: 77,
    editorScore: 80,
    whyLearn: "A practical first course for transitioning into product roles.",
  },
];
