/**
 * Curated topic landing definitions.
 * Pages only render when the mapped category has published courses.
 * Intros are editorial (not AI-generated filler).
 */

export type TopicLanding = {
  slug: string;
  categorySlug: string;
  title: string;
  heading: string;
  description: string;
  relatedTopics: string[];
};

export const TOPIC_LANDINGS: TopicLanding[] = [
  {
    slug: "ai",
    categorySlug: "ai",
    title: "Free AI Courses",
    heading: "Free AI & machine learning courses",
    description:
      "Browse curated free AI courses — from introductory machine learning to practical prompt and model skills. Free status and verification freshness are shown on each course.",
    relatedTopics: ["python", "data-science", "cybersecurity"],
  },
  {
    slug: "python",
    categorySlug: "programming",
    title: "Free Python Courses",
    heading: "Free Python courses worth your time",
    description:
      "Find free Python courses for beginners and builders. We highlight what is free (full, audit, or coupon) and when it was last verified.",
    relatedTopics: ["ai", "data-science", "project-management"],
  },
  {
    slug: "cybersecurity",
    categorySlug: "cybersecurity",
    title: "Free Cybersecurity Courses",
    heading: "Free cybersecurity courses",
    description:
      "Discover free cybersecurity learning paths and courses from major providers, with clear free-status labels.",
    relatedTopics: ["ai", "cloud", "programming"],
  },
  {
    slug: "project-management",
    categorySlug: "project-management",
    title: "Free Project Management Courses",
    heading: "Free project management courses",
    description:
      "Explore free project management courses suitable for beginners and working professionals.",
    relatedTopics: ["python", "data-science", "ai"],
  },
  {
    slug: "data-science",
    categorySlug: "data-science",
    title: "Free Data Science Courses",
    heading: "Free data science courses",
    description:
      "Curated free data science and analytics courses with transparent free and certificate status.",
    relatedTopics: ["python", "ai", "cloud"],
  },
  {
    slug: "cloud",
    categorySlug: "cloud",
    title: "Free Cloud Courses",
    heading: "Free cloud computing courses",
    description:
      "Browse free cloud courses from major platforms. Check verification dates before enrolling in promotions.",
    relatedTopics: ["cybersecurity", "ai", "programming"],
  },
  {
    slug: "programming",
    categorySlug: "programming",
    title: "Free Programming Courses",
    heading: "Free programming courses",
    description:
      "A curated selection of free programming courses across languages and levels.",
    relatedTopics: ["python", "ai", "data-science"],
  },
];

export function findTopicLanding(slug: string): TopicLanding | null {
  return TOPIC_LANDINGS.find((topic) => topic.slug === slug) ?? null;
}

export function listTopicSlugs(): string[] {
  return TOPIC_LANDINGS.map((topic) => topic.slug);
}
