import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type {
  HealthState,
  SubsystemHealth,
} from "@/domain/admin/operations-snapshot";
import type { AdminDictionary } from "@/lib/i18n/admin/types";

type HealthPanelProps = {
  t: AdminDictionary;
  locale: string;
  items: Array<{ label: string; health: SubsystemHealth }>;
};

const TONE: Record<HealthState, StatusTone> = {
  healthy: "healthy",
  degraded: "warning",
  failed: "error",
  unknown: "unknown",
};

function stateLabel(state: HealthState, t: AdminDictionary): string {
  switch (state) {
    case "healthy":
      return t.health.healthy;
    case "degraded":
      return t.health.degraded;
    case "failed":
      return t.health.failed;
    default:
      return t.health.unknown;
  }
}

function formatSignal(
  health: SubsystemHealth,
  t: AdminDictionary,
  locale: string,
): string {
  if (!health.observedAt) return t.health.unknownHint;
  return `${t.health.lastSignal}: ${health.observedAt.toLocaleString(
    locale === "vi" ? "vi-VN" : "en-GB",
  )}`;
}

export function HealthPanel({ t, locale, items }: HealthPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t.health.heading}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.health.description}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatSignal(item.health, t, locale)}
                {item.health.detail
                  ? ` · ${t.health.errorsRecorded(Number(item.health.detail))}`
                  : ""}
              </p>
            </div>
            <StatusBadge
              tone={TONE[item.health.state]}
              label={stateLabel(item.health.state, t)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
