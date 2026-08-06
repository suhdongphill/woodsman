import Link from "next/link";
import { FunctionBadge } from "@/components/ui/Badge";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { formatNumber, formatPct, profitColor, cx } from "@/lib/format";
import type { ModelHolding } from "@/lib/types";

/** 대표 포트폴리오 종목 카드 (기존 index.html 종목 카드 레이아웃 계승) */
export function HoldingCard({ holding: h }: { holding: ModelHolding }) {
  const cur = h.currency ?? "KRW";
  const hasPrice = h.price != null;
  const profitPct =
    hasPrice && h.avgCost ? ((h.price! - h.avgCost) / h.avgCost) * 100 : null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FunctionBadge type={h.functionType} />
            {h.ticker && (
              <span className="text-[11px] font-mono text-gray-500">{h.ticker}</span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-white truncate">{h.name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{h.market ?? "—"}</p>
        </div>
        <div className="text-right shrink-0">
          {hasPrice ? (
            <>
              <p className="text-sm font-semibold text-white tabular-nums">
                {formatNumber(h.price!, cur)}
              </p>
              {/* ⚠ 등락률이 아니라 '언제 적은 값인가'를 쓴다 — 실시간 시세가 아니다. */}
              <p className="text-[11px] tabular-nums text-gray-500">
                {h.priceAsOf ? `${h.priceAsOf} 기준` : "기준일 없음"}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">현금성</p>
          )}
        </div>
      </div>

      {h.thesis && (
        <p className="mt-3 text-[12.5px] text-muted leading-relaxed line-clamp-3">
          {h.thesis}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-gray-500">목표비중</span>
          <span className="text-sm font-bold text-gold-400 tabular-nums">
            {h.targetWeight != null ? `${h.targetWeight}%` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {profitPct != null && (
            <span className={cx("text-[11px] tabular-nums", profitColor(profitPct))}>
              평가 {formatPct(profitPct)}
            </span>
          )}
          {h.canslim != null && <CanslimScore score={h.canslim} size="sm" showLabel={false} />}
        </div>
      </div>
    </>
  );

  const cls =
    "block bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40";

  return h.ticker && h.market !== "BOND" && h.market !== "CASH" ? (
    <Link href={`/stocks/${h.ticker}`} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
