import type { Dictionary } from "@/lib/i18n/types";

export const en: Dictionary = {
  nav: {
    explore: "Explore",
    categories: "Categories",
    providers: "Providers",
    search: "Search",
    menu: "Menu",
    close: "Close",
  },
  hero: {
    eyebrow: "Curated · verified · free to learn",
    headline: "Learn something new — without paying for it.",
    subhead:
      "Free courses from trusted platforms with clear free status and verification freshness.",
    searchPlaceholder: "Search Python, AI, project management…",
    searchButton: "Search",
    trending: "Trending",
  },
  sections: {
    freeThisWeek: "Free this week",
    freeThisWeekSub: "Fully free, limited-time, or coupon-ready picks",
    bestFree: "Best free courses",
    bestFreeSub: "Ranked by quality, freshness, and free value",
    browseTopic: "Browse by topic",
    recentlyVerified: "Recently verified",
    recentlyVerifiedSub: "Free status checked more recently",
    freeCertificates: "Free certificate courses",
    freeCertificatesSub: "Only courses with a free certificate — never guessed",
    shortCourses: "Short courses",
    shortCoursesSub: "About an hour or less",
    providers: "Popular providers",
    monthlyCollection: "Best of the month",
    monthlyCollectionSub: "Editorial picks for the current month",
    monthlyCollectionCta: "See this month's best",
    viewAll: "View all",
  },
  empty: {
    catalogTitle: "Fresh courses are on the way",
    catalogDescription:
      "We're preparing the latest verified free courses from trusted learning platforms. Check back soon or explore topics below.",
    catalogAction: "Browse topics",
    searchTitle: "No courses match your search",
    searchDescription:
      "Try a broader keyword or clear filters to see more results.",
    searchAction: "Browse AI topics",
  },
  course: {
    openCourse: "View course",
    viewCourse: "View course on provider",
    durationUnknown: "Duration unknown",
    levelUnknown: "Level unknown",
    staleVerification: "Free status may be outdated",
  },
  search: {
    title: "Search courses",
    description:
      "Filter by provider, level, free type, certificate, and duration.",
    results: (count, query) =>
      `${count} result${count === 1 ? "" : "s"}${query ? ` for “${query}”` : ""}`,
  },
  filters: {
    filters: "Filters",
    active: "Active",
    keyword: "Keyword",
    keywordPlaceholder: "Search courses",
    provider: "Provider",
    level: "Level",
    freeType: "Free type",
    certificate: "Certificate",
    duration: "Duration",
    sort: "Sort",
    all: "All",
    any: "Any",
    apply: "Apply",
    clearAll: "Clear all",
    filtersActive: "Filters active",
    categories: "Categories",
    sortRecommended: "Recommended",
    sortNewest: "Newest",
    sortPopular: "Most Popular",
    sortShortest: "Shortest",
    levelBeginner: "Beginner",
    levelIntermediate: "Intermediate",
    levelAdvanced: "Advanced",
    levelAll: "All levels",
  },
  pagination: {
    previous: "Previous",
    next: "Next",
    pageOf: (page, total) => `Page ${page} of ${total}`,
  },
  errors: {
    notFoundTitle: "Page not found",
    notFoundDescription:
      "That link does not match a course or collection on FreeLearn Radar. Try searching, or return home.",
    goHome: "Go home",
    searchCourses: "Search courses",
    genericTitle: "Something went wrong",
    genericDescription:
      "We could not load this page. Try again, or browse free courses from search.",
    tryAgain: "Try again",
  },
  footer: {
    tagline: "Curated free learning from trusted providers.",
  },
  language: {
    en: "English",
    vi: "Tiếng Việt",
    switchLabel: "Language",
  },
};
