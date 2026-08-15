import type { ResolvedAffiliateCard } from "@/domain/affiliate/resolve-placements";

type AffiliateResourcesProps = {
  heading: string;
  cards: ResolvedAffiliateCard[];
  emptyHint?: string;
};

/**
 * Contextual affiliate cards. Never styled as course cards (plan §114.2).
 */
export function AffiliateResources({
  heading,
  cards,
}: AffiliateResourcesProps) {
  if (cards.length === 0) return null;
  const hasCommerce = cards.some((card) => card.merchant);

  return (
    <section className="space-y-3 border-t border-border/60 pt-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {heading}
      </h2>
      {hasCommerce ? (
        <AffiliateDisclosure label="Liên kết tiếp thị: FreeLearn Radar có thể nhận hoa hồng khi bạn mua qua liên kết, không làm thay đổi giá hoặc thứ tự gợi ý." />
      ) : null}
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={`${card.productId ?? card.campaignKey}-${card.placementKey}`}>
            <a
              href={card.href}
              rel="sponsored noopener noreferrer"
              className="flex gap-3 rounded border border-dashed border-border px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/30"
            >
              {card.imageUrl ? (
                // Merchant CDNs vary by product; the destination itself is still
                // host-validated before render and again before redirect.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-16 shrink-0 rounded object-cover"
                />
              ) : null}
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-medium text-foreground">
                  {card.title}
                </span>
                {card.shopName || card.displayPrice ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[card.shopName, card.displayPrice].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                <span className="mt-1 block text-[0.75rem] font-medium text-primary">
                  {card.merchant
                    ? `Xem trên ${card.merchant === "SHOPEE" ? "Shopee" : "Lazada"}`
                    : card.disclosure}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AffiliateDisclosure({ label }: { label: string }) {
  return (
    <p className="text-[0.6875rem] text-muted-foreground" role="note">
      {label}
    </p>
  );
}
