/**
 * Curated topic landing definitions (bilingual).
 * Pages only render when the mapped category has published courses.
 * Intros are editorial (not AI-generated filler).
 */

import type { Locale } from "@/lib/i18n/config";

type TopicCopy = {
  title: string;
  heading: string;
  description: string;
};

export type TopicLanding = {
  slug: string;
  categorySlug: string;
  relatedTopics: string[];
  en: TopicCopy;
  vi: TopicCopy;
};

export const TOPIC_LANDINGS: TopicLanding[] = [
  {
    slug: "ai",
    categorySlug: "ai",
    relatedTopics: ["python", "data-science", "cybersecurity"],
    en: {
      title: "Free AI Courses",
      heading: "Free AI & machine learning courses",
      description:
        "Browse curated free AI courses — from introductory machine learning to practical prompt and model skills. Free status and verification freshness are shown on each course.",
    },
    vi: {
      title: "Khóa học AI miễn phí",
      heading: "Khóa học AI & machine learning miễn phí",
      description:
        "Khám phá các khóa AI miễn phí được tuyển chọn — từ machine learning nhập môn đến kỹ năng prompt và mô hình thực tế. Mỗi khóa đều hiển thị trạng thái miễn phí và thời điểm xác minh.",
    },
  },
  {
    slug: "python",
    categorySlug: "programming",
    relatedTopics: ["ai", "data-science", "project-management"],
    en: {
      title: "Free Python Courses",
      heading: "Free Python courses worth your time",
      description:
        "Find free Python courses for beginners and builders. We highlight what is free (full, audit, or coupon) and when it was last verified.",
    },
    vi: {
      title: "Khóa học Python miễn phí",
      heading: "Khóa học Python miễn phí đáng học",
      description:
        "Tìm khóa Python miễn phí cho người mới và người đang xây sản phẩm. Chúng tôi nêu rõ phần nào miễn phí (toàn phần, học thử, hay cần coupon) và thời điểm xác minh gần nhất.",
    },
  },
  {
    slug: "cybersecurity",
    categorySlug: "cybersecurity",
    relatedTopics: ["ai", "cloud", "programming"],
    en: {
      title: "Free Cybersecurity Courses",
      heading: "Free cybersecurity courses",
      description:
        "Discover free cybersecurity learning paths and courses from major providers, with clear free-status labels.",
    },
    vi: {
      title: "Khóa học An toàn thông tin miễn phí",
      heading: "Khóa học an toàn thông tin miễn phí",
      description:
        "Khám phá lộ trình và khóa học an toàn thông tin miễn phí từ các nền tảng lớn, với nhãn trạng thái miễn phí rõ ràng.",
    },
  },
  {
    slug: "project-management",
    categorySlug: "project-management",
    relatedTopics: ["python", "data-science", "ai"],
    en: {
      title: "Free Project Management Courses",
      heading: "Free project management courses",
      description:
        "Explore free project management courses suitable for beginners and working professionals.",
    },
    vi: {
      title: "Khóa học Quản lý dự án miễn phí",
      heading: "Khóa học quản lý dự án miễn phí",
      description:
        "Khám phá các khóa quản lý dự án miễn phí phù hợp cho người mới và người đi làm.",
    },
  },
  {
    slug: "data-science",
    categorySlug: "data-science",
    relatedTopics: ["python", "ai", "cloud"],
    en: {
      title: "Free Data Science Courses",
      heading: "Free data science courses",
      description:
        "Curated free data science and analytics courses with transparent free and certificate status.",
    },
    vi: {
      title: "Khóa học Data Science miễn phí",
      heading: "Khóa học data science miễn phí",
      description:
        "Các khóa data science và phân tích dữ liệu miễn phí được tuyển chọn, minh bạch trạng thái miễn phí và chứng chỉ.",
    },
  },
  {
    slug: "cloud",
    categorySlug: "cloud",
    relatedTopics: ["cybersecurity", "ai", "programming"],
    en: {
      title: "Free Cloud Courses",
      heading: "Free cloud computing courses",
      description:
        "Browse free cloud courses from major platforms. Check verification dates before enrolling in promotions.",
    },
    vi: {
      title: "Khóa học Cloud miễn phí",
      heading: "Khóa học điện toán đám mây miễn phí",
      description:
        "Khám phá khóa cloud miễn phí từ các nền tảng lớn. Hãy kiểm tra ngày xác minh trước khi đăng ký các chương trình khuyến mãi.",
    },
  },
  {
    slug: "programming",
    categorySlug: "programming",
    relatedTopics: ["python", "ai", "data-science"],
    en: {
      title: "Free Programming Courses",
      heading: "Free programming courses",
      description:
        "A curated selection of free programming courses across languages and levels.",
    },
    vi: {
      title: "Khóa học Lập trình miễn phí",
      heading: "Khóa học lập trình miễn phí",
      description:
        "Tuyển chọn các khóa lập trình miễn phí trên nhiều ngôn ngữ và trình độ.",
    },
  },
];

export function findTopicLanding(slug: string): TopicLanding | null {
  return TOPIC_LANDINGS.find((topic) => topic.slug === slug) ?? null;
}

export function listTopicSlugs(): string[] {
  return TOPIC_LANDINGS.map((topic) => topic.slug);
}

export function topicCopy(landing: TopicLanding, locale: Locale): TopicCopy {
  return locale === "vi" ? landing.vi : landing.en;
}
