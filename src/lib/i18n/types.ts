export type Dictionary = {
  nav: {
    explore: string;
    categories: string;
    providers: string;
    search: string;
    menu: string;
    close: string;
    courses: string;
    dailyFree: string;
    topics: string;
    directory: string;
    learningPaths: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    searchPlaceholder: string;
    searchButton: string;
    /**
     * Curated shortcuts, not behavioural data. Named for what it is: the
     * previous "Trending" label claimed popularity the product cannot measure.
     */
    topicShortcuts: string;
  };
  /**
   * Homepage trust strip. Every numeric item is rendered only when the
   * application can supply a real value; there are no placeholder figures.
   */
  trust: {
    verifiedCourses: string;
    verifiedCoursesHint: string;
    providersTracked: string;
    providersTrackedHint: string;
    lastChecked: string;
    transparency: string;
    transparencyHint: string;
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
    dailyFree: string;
    dailyFreeSub: string;
    durableFree: string;
    durableFreeSub: string;
    forYou: string;
    forYouSub: string;
    quickDomains: string;
    quickDomainsSub: string;
  };
  interests: {
    title: string;
    description: string;
    save: string;
    saved: string;
    pickCta: string;
    change: string;
    emptyRanked: string;
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
    /**
     * Accessible name for the remove control on an active-filter chip.
     *
     * A template string rather than a function: this object is handed whole to
     * a client component, and a function cannot cross that boundary.
     * Placeholder: {label}
     */
    removeFilter: string;
  };
  pagination: {
    previous: string;
    next: string;
    pageOf: (page: number, total: number) => string;
  };
  errors: {
    reference: string;
    notFoundTitle: string;
    notFoundDescription: string;
    goHome: string;
    searchCourses: string;
    genericTitle: string;
    genericDescription: string;
    tryAgain: string;
  };
  common: {
    home: string;
    courseCount: (count: number) => string;
    resultCount: (count: number) => string;
    providers: string;
    collections: string;
    freeCourses: string;
    topicGuide: string;
    freeCertificates: string;
    browseAll: string;
    searchCatalog: string;
    openCategory: string;
    relatedTopics: string;
    unknown: string;
  };
  pages: {
    categoryFallbackDescription: (name: string) => string;
    categoryEmptyTitle: string;
    categoryEmptyDescription: string;
    topicEmptyTitle: string;
    topicEmptyDescription: string;
    topicFullCategory: (name: string) => string;
    topicTagIntro: (name: string) => string;
    providerHeading: (name: string) => string;
    providerIntro: string;
    providerNotHosted: string;
    providerListed: (count: number) => string;
    providerEmptyTitle: (name: string) => string;
    providerEmptyDescription: string;
    providerRecentlyVerified: string;
    collectionIntro: (minutes: number) => string;
    collectionEmptyTitle: string;
    collectionEmptyDescription: string;
    certificatesHeading: string;
    certificatesIntro: string;
    certificatesEmptyTitle: string;
    certificatesEmptyDescription: string;
    bestHeading: (month: string) => string;
    bestIntro: string;
    bestFallbackNotice: string;
    bestEmptyTitle: string;
    bestEmptyDescription: string;
    dailyFreeHeading: string;
    dailyFreeIntro: string;
    dailyFreeEmptyTitle: string;
    dailyFreeEmptyDescription: string;
    dailyFreeCta: string;
    coupon100Badge: string;
    limitedFreeBadge: string;
  };
  courseDetail: {
    keyFacts: string;
    whyLearn: string;
    noSummary: string;
    whatIsFree: string;
    certificate: string;
    level: string;
    duration: string;
    language: string;
    instructor: string;
    lastVerified: string;
    lastObserved: string;
    freeDurability: string;
    provider: string;
    notListed: string;
    notVerified: string;
    unknown: string;
    inactiveNotice: string;
    relatedCourses: string;
    relatedAlternatives: string;
    viewCourseHeading: string;
    continuesOn: (provider: string) => string;
    viewCourseOn: (provider: string) => string;
    moreFrom: (provider: string) => string;
    monthlyBest: string;
    fallbackSummary: string;
    trackerHeading: string;
    watchHeading: string;
    watchEmail: string;
    watchSubmit: string;
    watchSubmitting: string;
    watchSuccess: string;
    watchError: string;
  };
  tracker: {
    heading: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    unknownCourse: string;
  };
  meta: {
    categoryNotFound: string;
    providerNotFound: string;
    courseNotFound: string;
    collectionNotFound: string;
    topicNotFound: string;
    trackerNotFound: string;
    certificatesTitle: string;
  };
  a11y: {
    freeStatusAndCertificate: string;
    exploreRelated: string;
    breadcrumb: string;
  };
  verification: {
    never: string;
    today: string;
    yesterday: string;
    daysAgo: (days: number) => string;
    recently: string;
    notVerifiedNotice: string;
    staleNotice: (days: number) => string;
  };
  share: {
    action: string;
    copied: string;
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
