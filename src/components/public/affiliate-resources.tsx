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

  return (
    <section className="space-y-3 border-t border-border/60 pt-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {heading}
      </h2>
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={`${card.campaignKey}-${card.placementKey}`}>
            <a
              href={card.href}
              rel="sponsored noopener noreferrer"
              className="block rounded border border-dashed border-border px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/30"
            >
              <p className="text-[0.8125rem] font-medium text-foreground">
                {card.title}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                {card.disclosure}
                {card.providerType === "COMMERCE" ? " · gợi ý học tập" : ""}
              </p>
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
