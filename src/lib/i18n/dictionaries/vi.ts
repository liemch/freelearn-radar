import type { Dictionary } from "@/lib/i18n/types";

export const vi: Dictionary = {
  nav: {
    explore: "Khám phá",
    categories: "Chủ đề",
    providers: "Nền tảng",
    search: "Tìm kiếm",
    menu: "Menu",
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
  footer: {
    tagline: "Học miễn phí được tuyển chọn từ nền tảng uy tín.",
  },
  language: {
    en: "English",
    vi: "Tiếng Việt",
    switchLabel: "Ngôn ngữ",
  },
};
