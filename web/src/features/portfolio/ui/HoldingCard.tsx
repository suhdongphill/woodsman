import Link from "next/link";
import { FunctionBadge } from "@/components/ui/Badge";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { formatNumber, formatPct, profitColor, cx } from "@/lib/format";
import type { ModelHolding } from "@/lib/types";

/**
 * 대표 포트폴리오 종목 카드.
 *
 * ## ⚠ 보고서 링크는 **받아서** 건다 (2026-08-17)
 * 전에는 티커만 있으면 무조건 `/stocks/<티커>`로 링크했다. 그런데 그 화면은
 * **발행된 보고서가 없으면 404**다 — 발행본이 0건인 동안 **모든 카드가 404로 갔다.**
 * 이제 "보고서가 있는가"는 `lib/report/link.ts`가 판단하고, 여기는 결과만 쓴다.
 */
export function HoldingCard({
  holding: h,
  reportHref,
  bucketName,
  bucketColor,
}: {
  holding: ModelHolding;
  /** 발행된 보고서가 있을 때만 온다. 없으면 카드는 링크가 아니다 */
  reportHref?: string;
  /** 관리자가 붙인 분류 이름·색 */
  bucketName?: string;
  bucketColor?: string;
}) {
  const cur = h.currency ?? "KRW";
  const hasPrice = h.price != null;
  const profitPct =
    hasPrice && h.avgCost ? ((h.price! - h.avgCost) / h.avgCost) * 100 : null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FunctionBadge type={h.functionType} name={bucketName} color={bucketColor} />
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

  return reportHref ? (
    <Link href={reportHref} className={cls}>
      {body}
      {/* ⚠ 링크가 걸린 카드와 아닌 카드가 겉으로 같으면 눌러 보고 알게 된다 */}
      <span className="mt-3 block text-[11px] text-gold-400">분석 보고서 보기 →</span>
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
