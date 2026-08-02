import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { Sparkline } from "@/components/ui/Sparkline";
import { cx, formatNumber, formatPct, profitColor } from "@/lib/format";
import type { StockSummary } from "@/lib/types";

export function StockCard({ stock: s }: { stock: StockSummary }) {
  const up = s.changePct >= 0;
  return (
    <Link
      href={`/stocks/${s.ticker}`}
      className="group block bg-card border border-border rounded-2xl p-4 card-hover hover:border-gold-600/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-gold-400 transition-colors">
            {s.name}
          </p>
          <p className="text-[11px] font-mono text-gray-500 mt-0.5">
            {s.ticker} · {s.market}
          </p>
        </div>
        <Sparkline data={s.spark} up={up} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold text-white tabular-nums">
            {formatNumber(s.price, s.currency)}
          </p>
          <p className={cx("text-xs tabular-nums", profitColor(s.changePct))}>
            {formatPct(s.changePct)}
          </p>
        </div>
        <CanslimScore score={s.canslim} size="sm" showLabel={false} />
      </div>
      <div className="mt-3 pt-3 border-t border-border/70">
        <Badge tone="neutral">{s.industry}</Badge>
      </div>
    </Link>
  );
}
