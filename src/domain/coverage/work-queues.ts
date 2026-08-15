import type { CatalogBaseline } from "@/domain/coverage/catalog-metrics";
import type { CategoryCoverageRow } from "@/domain/coverage/catalog-metrics";
import type { DiscoveryFunnelSnapshot } from "@/domain/coverage/discovery-funnel";
import type { ProviderEffectivenessRow } from "@/domain/coverage/provider-effectiveness";
import type { UnmetIntentSummary } from "@/domain/coverage/unmet-intent";

export type WorkQueueItem = {
  id: string;
  title: string;
  count: number;
  priority: number;
  href: string;
  actionLabel: string;
};

/**
 * Transparent priority: public impact + coverage gap + demand.
 * No opaque AI score.
 */
export function buildCoverageWorkQueues(input: {
  baseline: CatalogBaseline | null;
  categories: CategoryCoverageRow[];
  funnel: DiscoveryFunnelSnapshot | null;
  providers: ProviderEffectivenessRow[];
  demand: UnmetIntentSummary | null;
  missingImages?: number;
  staleTruth?: number;
}): WorkQueueItem[] {
  const items: WorkQueueItem[] = [];

  const empty = input.categories.filter((c) => c.coverage === "EMPTY");
  const thin = input.categories.filter((c) => c.coverage === "THIN");

  if (empty.length > 0) {
    items.push({
      id: "empty-categories",
      title: "Chủ đề / danh mục trống",
      count: empty.length,
      priority: 100 + empty.length,
      href: "/admin/coverage#matrix",
      actionLabel: "Xem độ phủ",
    });
  }

  if (thin.length > 0) {
    items.push({
      id: "thin-categories",
      title: "Danh mục mỏng",
      count: thin.length,
      priority: 70 + thin.length,
      href: "/admin/coverage#matrix",
      actionLabel: "Xem độ phủ",
    });
  }

  if (input.demand && input.demand.zeroResultSearches > 0) {
    items.push({
      id: "zero-result",
      title: "Tìm kiếm không có kết quả",
      count: input.demand.zeroResultSearches,
      priority: 90 + Math.min(40, input.demand.zeroResultSearches),
      href: "/admin/discovery/demand",
      actionLabel: "Xem nhu cầu",
    });
  }

  if (input.demand && input.demand.lowResultSearches > 0) {
    items.push({
      id: "low-result",
      title: "Tìm kiếm kết quả mỏng",
      count: input.demand.lowResultSearches,
      priority: 60 + Math.min(30, input.demand.lowResultSearches),
      href: "/admin/discovery/demand",
      actionLabel: "Xem nhu cầu",
    });
  }

  const failing = input.providers.filter(
    (p) => p.health === "FAILING" || p.health === "DEGRADED",
  );
  if (failing.length > 0) {
    items.push({
      id: "providers",
      title: "Provider lỗi / suy giảm",
      count: failing.length,
      priority: 85,
      href: "/admin/coverage#providers",
      actionLabel: "Xem provider",
    });
  }

  const lowYield = input.providers.filter((p) => p.health === "LOW_YIELD");
  if (lowYield.length > 0) {
    items.push({
      id: "low-yield",
      title: "Provider yield thấp / trùng lặp cao",
      count: lowYield.length,
      priority: 55,
      href: "/admin/coverage#providers",
      actionLabel: "Xem provider",
    });
  }

  if ((input.missingImages ?? 0) > 0) {
    items.push({
      id: "missing-images",
      title: "Khóa thiếu / hỏng ảnh",
      count: input.missingImages!,
      priority: 40 + Math.min(20, input.missingImages!),
      href: "/admin/media-quality?status=MISSING",
      actionLabel: "Media Quality",
    });
  }

  if ((input.staleTruth ?? 0) > 0) {
    items.push({
      id: "stale-truth",
      title: "Truth cần verify lại",
      count: input.staleTruth!,
      priority: 50 + Math.min(20, input.staleTruth!),
      href: "/admin/courses?status=PUBLISHED",
      actionLabel: "Danh sách khóa",
    });
  }

  if (input.funnel && input.funnel.analyzedOrReady > 0) {
    items.push({
      id: "review-queue",
      title: "Ứng viên chờ duyệt",
      count: input.funnel.analyzedOrReady,
      priority: 65 + Math.min(25, input.funnel.analyzedOrReady),
      href: "/admin/candidates?status=READY_FOR_REVIEW",
      actionLabel: "Duyệt ứng viên",
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
