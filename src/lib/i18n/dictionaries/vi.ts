import type { Dictionary } from "@/lib/i18n/types";

export const vi: Dictionary = {
  nav: {
    explore: "Khám phá",
    categories: "Chủ đề",
    providers: "Nền tảng",
    search: "Tìm kiếm",
    menu: "Danh mục",
    close: "Đóng",
  },
  hero: {
    eyebrow: "Tuyển chọn · xác minh · học miễn phí",
    headline: "Học điều mới — không tốn một đồng.",
    subhead:
      "Khóa học miễn phí từ các nền tảng uy tín, với trạng thái miễn phí rõ ràng và thời điểm xác minh.",
    searchPlaceholder: "Tìm Python, AI, quản lý dự án…",
    searchButton: "Tìm kiếm",
    trending: "Xu hướng",
  },
  sections: {
    freeThisWeek: "Miễn phí tuần này",
    freeThisWeekSub: "Khóa miễn phí toàn phần, có hạn, hoặc cần coupon",
    bestFree: "Khóa miễn phí hay nhất",
    bestFreeSub: "Xếp hạng theo chất lượng, độ mới và giá trị miễn phí",
    browseTopic: "Khám phá theo chủ đề",
    recentlyVerified: "Vừa xác minh",
    recentlyVerifiedSub: "Trạng thái miễn phí được kiểm tra gần đây",
    freeCertificates: "Chứng chỉ miễn phí",
    freeCertificatesSub: "Chỉ khóa có chứng chỉ miễn phí — không đoán",
    shortCourses: "Khóa ngắn",
    shortCoursesSub: "Khoảng một giờ hoặc ít hơn",
    providers: "Nền tảng phổ biến",
    monthlyCollection: "Hay nhất tháng này",
    monthlyCollectionSub: "Tuyển chọn biên tập cho tháng hiện tại",
    monthlyCollectionCta: "Xem hay nhất tháng",
    viewAll: "Xem tất cả",
  },
  empty: {
    catalogTitle: "Khóa học mới đang được chuẩn bị",
    catalogDescription:
      "Chúng tôi đang tuyển chọn các khóa miễn phí mới nhất từ nền tảng uy tín. Quay lại sớm hoặc khám phá chủ đề bên dưới.",
    catalogAction: "Khám phá chủ đề",
    searchTitle: "Không tìm thấy khóa phù hợp",
    searchDescription:
      "Thử từ khóa rộng hơn hoặc xóa bộ lọc để xem thêm kết quả.",
    searchAction: "Khám phá chủ đề AI",
  },
  course: {
    openCourse: "Xem khóa học",
    viewCourse: "Xem trên nền tảng",
    durationUnknown: "Thời lượng chưa rõ",
    levelUnknown: "Trình độ chưa rõ",
    staleVerification: "Trạng thái miễn phí có thể đã cũ",
  },
  search: {
    title: "Tìm khóa học",
    description:
      "Lọc theo nền tảng, trình độ, loại miễn phí, chứng chỉ và thời lượng.",
    results: (count, query) =>
      `${count} kết quả${query ? ` cho “${query}”` : ""}`,
  },
  filters: {
    filters: "Bộ lọc",
    active: "Đang dùng",
    keyword: "Từ khóa",
    keywordPlaceholder: "Tìm khóa học",
    provider: "Nền tảng",
    level: "Trình độ",
    freeType: "Loại miễn phí",
    certificate: "Chứng chỉ",
    duration: "Thời lượng",
    sort: "Sắp xếp",
    all: "Tất cả",
    any: "Bất kỳ",
    apply: "Áp dụng",
    clearAll: "Xóa hết",
    filtersActive: "Đang lọc",
    categories: "Chủ đề",
    sortRecommended: "Đề xuất",
    sortNewest: "Mới nhất",
    sortPopular: "Phổ biến",
    sortShortest: "Ngắn nhất",
    levelBeginner: "Cơ bản",
    levelIntermediate: "Trung cấp",
    levelAdvanced: "Nâng cao",
    levelAll: "Mọi trình độ",
  },
  pagination: {
    previous: "Trước",
    next: "Sau",
    pageOf: (page, total) => `Trang ${page} / ${total}`,
  },
  errors: {
    reference: "Mã tham chiếu",
    notFoundTitle: "Không tìm thấy trang",
    notFoundDescription:
      "Liên kết này không khớp khóa học hoặc bộ sưu tập nào trên FreeLearn Radar. Hãy tìm kiếm hoặc về trang chủ.",
    goHome: "Về trang chủ",
    searchCourses: "Tìm khóa học",
    genericTitle: "Đã xảy ra lỗi",
    genericDescription:
      "Không tải được trang này. Thử lại hoặc tìm khóa học miễn phí.",
    tryAgain: "Thử lại",
  },
  common: {
    home: "Trang chủ",
    courseCount: (count) => `${count} khóa học`,
    resultCount: (count) => `${count} kết quả`,
    providers: "Nền tảng",
    collections: "Bộ sưu tập",
    freeCourses: "Khóa miễn phí",
    topicGuide: "Hướng dẫn chủ đề",
    freeCertificates: "Chứng chỉ miễn phí",
    browseAll: "Xem tất cả khóa học",
    searchCatalog: "Tìm trong danh mục",
    openCategory: "Mở chủ đề",
    relatedTopics: "Chủ đề liên quan",
    unknown: "Chưa rõ",
  },
  pages: {
    categoryFallbackDescription: (name) => `Khóa học ${name} miễn phí.`,
    categoryEmptyTitle: "Không có khóa học phù hợp",
    categoryEmptyDescription:
      "Chưa có khóa nào khớp bộ lọc này. Hãy xóa bộ lọc hoặc xem chủ đề khác.",
    topicEmptyTitle: "Không có khóa nào khớp bộ lọc",
    topicEmptyDescription: "Hãy xóa bộ lọc hoặc xem một chủ đề liên quan.",
    topicFullCategory: (name) => `Toàn bộ chủ đề ${name}`,
    providerHeading: (name) => `Khóa học miễn phí từ ${name}`,
    providerIntro: "Danh sách khóa học miễn phí được tuyển chọn, liên kết từ",
    providerNotHosted:
      "FreeLearn Radar không lưu trữ nội dung khóa học.",
    providerListed: (count) => `Hiện có ${count} khóa đã xuất bản`,
    providerEmptyTitle: (name) =>
      `Hiện chưa có khóa miễn phí nào từ ${name}`,
    providerEmptyDescription:
      "Hãy xem nền tảng khác hoặc tìm trong toàn bộ danh mục.",
    providerRecentlyVerified: "Vừa xác minh trên trang này",
    collectionIntro: (minutes) =>
      `Các khóa có thời lượng xác định từ ${minutes} phút trở xuống. Khóa không có dữ liệu thời lượng sẽ không hiển thị.`,
    collectionEmptyTitle: "Chưa có khóa ngắn nào phù hợp",
    collectionEmptyDescription:
      "Hãy thử bộ sưu tập thời lượng khác hoặc xem tất cả khóa học.",
    certificatesHeading: "Khóa học có chứng chỉ miễn phí",
    certificatesIntro:
      "Chỉ gồm khóa đã xác nhận có chứng chỉ miễn phí. Chúng tôi không phỏng đoán trạng thái chứng chỉ.",
    certificatesEmptyTitle: "Chưa có khóa chứng chỉ miễn phí",
    certificatesEmptyDescription:
      "Chúng tôi chỉ liệt kê khóa đã xác nhận chứng chỉ miễn phí. Vui lòng quay lại sau.",
    bestHeading: (month) => `Khóa miễn phí hay nhất — ${month}`,
    bestIntro:
      "Tuyển chọn biên tập, xếp hạng theo chất lượng, độ mới và giá trị miễn phí trong tháng.",
    bestFallbackNotice:
      "Tháng này chưa có đủ khóa mới, nên danh sách hiển thị các khóa xếp hạng cao nhất tổng thể.",
    bestEmptyTitle: "Chưa có bộ sưu tập cho tháng này",
    bestEmptyDescription:
      "Chúng tôi vẫn đang xác minh khóa học cho giai đoạn này. Trong lúc đó hãy xem toàn bộ danh mục.",
  },
  courseDetail: {
    keyFacts: "Thông tin chính",
    whyLearn: "Vì sao nên học",
    noSummary: "Chưa có mô tả.",
    whatIsFree: "Miễn phí phần nào",
    certificate: "Chứng chỉ",
    level: "Trình độ",
    duration: "Thời lượng",
    language: "Ngôn ngữ",
    instructor: "Giảng viên",
    lastVerified: "Xác minh gần nhất",
    provider: "Nền tảng",
    notListed: "Không có thông tin",
    notVerified: "Chưa xác minh",
    unknown: "Chưa rõ",
    inactiveNotice:
      "Khóa học hoặc ưu đãi miễn phí này có thể không còn hiệu lực. Hãy kiểm tra trên trang nền tảng, hoặc xem các khóa liên quan bên dưới.",
    relatedCourses: "Khóa học liên quan",
    relatedAlternatives: "Lựa chọn thay thế",
    viewCourseHeading: "Xem khóa học",
    continuesOn: (provider) =>
      `Tiếp tục trên ${provider}. FreeLearn Radar không lưu trữ bài giảng. Trạng thái miễn phí không được đảm bảo.`,
    viewCourseOn: (provider) => `Xem khóa học trên ${provider}`,
    moreFrom: (provider) => `Xem thêm từ ${provider}`,
    monthlyBest: "Hay nhất tháng",
    fallbackSummary: "Khóa học miễn phí được tuyển chọn.",
  },
  meta: {
    categoryNotFound: "Không tìm thấy chủ đề",
    providerNotFound: "Không tìm thấy nền tảng",
    courseNotFound: "Không tìm thấy khóa học",
    collectionNotFound: "Không tìm thấy bộ sưu tập",
    topicNotFound: "Không tìm thấy chủ đề",
    certificatesTitle: "Khóa học có chứng chỉ miễn phí",
  },
  a11y: {
    freeStatusAndCertificate: "Trạng thái miễn phí và chứng chỉ",
    exploreRelated: "Khám phá nội dung liên quan",
  },
  verification: {
    never: "Chưa từng xác minh",
    today: "Đã xác minh hôm nay",
    yesterday: "Đã xác minh hôm qua",
    daysAgo: (days) => `Xác minh ${days} ngày trước`,
    recently: "Vừa xác minh",
    notVerifiedNotice:
      "Trạng thái miễn phí chưa được xác minh. Thông tin có thể chưa đầy đủ.",
    staleNotice: (days) =>
      `Trạng thái miễn phí được xác minh ${days} ngày trước. Ưu đãi có thể đã thay đổi — hãy kiểm tra trên trang nền tảng trước khi đăng ký.`,
  },
  share: {
    action: "Chia sẻ / Sao chép liên kết",
    copied: "Đã sao chép liên kết",
  },
  footer: {
    tagline: "Học miễn phí được tuyển chọn từ nền tảng uy tín.",
  },
  language: {
    en: "English",
    vi: "Tiếng Việt",
    switchLabel: "Ngôn ngữ",
  },
};
