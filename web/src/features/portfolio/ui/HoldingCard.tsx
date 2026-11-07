import Link from "next/link";
import { FunctionBadge } from "@/components/ui/Badge";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { formatNumber, formatPct, profitColor, cx } from "@/lib/format";
import type { ModelHolding } from "@/lib/types";
import { HoldingTagChips } from "./HoldingTagChips";

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
  blogHref,
  bucketName,
  bucketColor,
  weightPct,
}: {
  holding: ModelHolding;
  /** 발행된 보고서가 있을 때만 온다. 없으면 카드는 링크가 아니다 */
  reportHref?: string;
  /** 관리자가 붙인 분류 이름·색 */
  bucketName?: string;
  bucketColor?: string;
  /** 블로그 글이 있을 때만 온다(`/go` 경유) */
  blogHref?: string;
  /** 공개 종목 합계 대비 비중(%). 값을 모르면 오지 않는다 */
  weightPct?: number;
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
          <h3 className="mt-2 text-[15px] font-semibold text-ink truncate">{h.name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{h.market ?? "—"}</p>
          {h.tags && <HoldingTagChips tags={h.tags} today={new Date().toISOString().slice(0, 10)} />}
        </div>
        <div className="text-right shrink-0">
          {hasPrice ? (
            <>
              <p className="text-sm font-semibold text-ink tabular-nums">
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
        {/* ⚠ 금액·수량은 공개하지 않는다(2026-11-07). 목표가 없으면 「—」를 반복하지 않고 뺀다. */}
        <div className="flex items-baseline gap-1.5">
          {weightPct !== undefined && (
            <>
              <span className="text-[11px] text-gray-500">비중</span>
              <span className="text-sm font-bold text-gold-400 tabular-nums">{weightPct.toFixed(1)}%</span>
            </>
          )}
          {h.targetWeight != null && (
            <span className="text-[11px] text-gray-500 tabular-nums">목표 {h.targetWeight}%</span>
          )}
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

  const hasLinks = reportHref || blogHref;

  // ⚠ 링크가 둘일 수 있어 카드 전체를 링크로 두지 않는다 — 링크 안의 링크는 HTML이 아니다.
  return (
    <div className="flex flex-col bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40">
      {body}
      {hasLinks && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-gold-400">
          {reportHref && (
            <Link href={reportHref} className="hover:text-gold-500">
              분석 보고서 보기 →
            </Link>
          )}
          {blogHref && (
            <a href={blogHref} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500">
              블로그 글 읽기 →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
