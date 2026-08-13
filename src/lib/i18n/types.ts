export type Dictionary = {
  nav: {
    explore: string;
    categories: string;
    providers: string;
    search: string;
    menu: string;
    close: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    searchPlaceholder: string;
    searchButton: string;
    trending: string;
  };
  sections: {
    freeThisWeek: string;
    freeThisWeekSub: string;
    bestFree: string;
    bestFreeSub: string;
    browseTopic: string;
    recentlyVerified: string;
    recentlyVerifiedSub: string;
    freeCertificates: string;
    freeCertificatesSub: string;
    shortCourses: string;
    shortCoursesSub: string;
    providers: string;
    monthlyCollection: string;
    monthlyCollectionSub: string;
    monthlyCollectionCta: string;
    viewAll: string;
  };
  empty: {
    catalogTitle: string;
    catalogDescription: string;
    catalogAction: string;
    searchTitle: string;
    searchDescription: string;
    searchAction: string;
  };
  course: {
    openCourse: string;
    viewCourse: string;
    durationUnknown: string;
    levelUnknown: string;
    staleVerification: string;
  };
  search: {
    title: string;
    description: string;
    results: (count: number, query?: string) => string;
  };
  filters: {
    filters: string;
    active: string;
    keyword: string;
    keywordPlaceholder: string;
    provider: string;
    level: string;
    freeType: string;
    certificate: string;
    duration: string;
    sort: string;
    all: string;
    any: string;
    apply: string;
    clearAll: string;
    filtersActive: string;
    categories: string;
    sortRecommended: string;
    sortNewest: string;
    sortPopular: string;
    sortShortest: string;
    levelBeginner: string;
    levelIntermediate: string;
    levelAdvanced: string;
    levelAll: string;
  };
  pagination: {
    previous: string;
    next: string;
    pageOf: (page: number, total: number) => string;
  };
  errors: {
    notFoundTitle: string;
    notFoundDescription: string;
    goHome: string;
    searchCourses: string;
    genericTitle: string;
    genericDescription: string;
    tryAgain: string;
  };
  footer: {
    tagline: string;
  };
  language: {
    en: string;
    vi: string;
    switchLabel: string;
  };
};
