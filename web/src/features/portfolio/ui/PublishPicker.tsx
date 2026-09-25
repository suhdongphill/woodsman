import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, FunctionBadge } from "@/components/ui/Badge";
import { cx, formatPct, profitColor } from "@/lib/format";
import type { PublishCoverage } from "@/lib/publish-selection";
import type { ModelHolding } from "@/lib/types";
import type { PortfolioBucket } from "@/lib/bucket-target";
import { savePublishSelectionAction } from "../actions";

/**
 * 공개 종목 고르기 — 운영 포트폴리오 전체를 한 표에 놓고 공개할 것만 체크한다(2026-09-25).
 *
 * 볼트가 증권사 잔고를 **비공개 초안**으로 싣는다. 100종목이 넘어서 카드마다 편집 폼을 여는
 * 방식으로는 고를 수 없다. 평가액이 큰 순서로 놓아 계좌에 영향이 큰 것부터 판단하게 한다.
 *
 * ⚠ 자바스크립트 없이 동작하는 평범한 폼이다. 표에 보였던 id를 `listed`로 함께 보내고,
 *   서버는 **그 종목들만** 바꾼다(`lib/publish-selection.ts`).
 */
export function PublishPicker({
  holdings,
  valueKrw,
  coverage,
  buckets,
}: {
  holdings: ModelHolding[];
  /** id → 원화 환산 평가액. 모르면 없음 */
  valueKrw: Map<string, number | undefined>;
  coverage: PublishCoverage;
  buckets: PortfolioBucket[];
}) {
  const total = holdings.reduce((sum, h) => sum + (valueKrw.get(h.id) ?? 0), 0);
  const rows = [...holdings].sort(
    (a, b) => (valueKrw.get(b.id) ?? -1) - (valueKrw.get(a.id) ?? -1),
  );

  return (
    <Card className="mb-5">
      <CardTitle
        action={
          <Badge tone="emerald">
            공개 {coverage.publishedCount} / {coverage.totalCount}
            {coverage.publishedValuePct != null && ` · 평가액의 ${coverage.publishedValuePct}%`}
          </Badge>
        }
      >
        공개 종목 고르기
      </CardTitle>
      <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
        체크한 종목만 공개 화면(/portfolio)에 나갑니다. 체크를 빼고 저장하면 바로 내려갑니다.
        계좌 비중은 원화로 환산한 종목 평가액 기준입니다(현금 제외).
        {coverage.unvalued > 0 &&
          ` 수량·현재가가 없는 ${coverage.unvalued}종목은 비중 계산에서 빠졌습니다.`}
      </p>

      {holdings.length === 0 ? (
        <p className="text-[13px] text-muted">아직 종목이 없습니다.</p>
      ) : (
        <form action={savePublishSelectionAction}>
          <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead className="sticky top-0 bg-card text-[11px] text-gray-500">
                <tr className="border-b border-border">
                  <th className="w-12 px-3 py-2 text-left font-normal">공개</th>
                  <th className="px-2 py-2 text-left font-normal">종목</th>
                  <th className="px-2 py-2 text-left font-normal">분류</th>
                  <th className="px-2 py-2 text-right font-normal">계좌 비중</th>
                  <th className="px-3 py-2 text-right font-normal">평가손익</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const v = valueKrw.get(h.id);
                  const weight = v != null && total > 0 ? (v / total) * 100 : null;
                  const profit =
                    h.price != null && h.avgCost ? ((h.price - h.avgCost) / h.avgCost) * 100 : null;
                  const bucket = buckets.find((b) => b.key === h.functionType);
                  return (
                    <tr key={h.id} className="border-b border-border/60 last:border-0 hover:bg-cardHover">
                      <td className="px-3 py-1.5">
                        <input type="hidden" name="listed" value={h.id} />
                        <input
                          type="checkbox"
                          name="published"
                          value={h.id}
                          defaultChecked={h.published}
                          aria-label={`${h.name} 공개`}
                          className="h-4 w-4 accent-gold-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-ink">{h.name}</span>
                        {h.ticker && (
                          <span className="ml-1.5 font-mono text-[11px] text-gray-500">{h.ticker}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <FunctionBadge type={h.functionType} name={bucket?.name} color={bucket?.color} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-300">
                        {weight != null ? `${weight.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={cx(
                          "px-3 py-1.5 text-right tabular-nums",
                          profit != null ? profitColor(profit) : "text-gray-500",
                        )}
                      >
                        {profit != null ? formatPct(profit) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600"
            >
              선택대로 공개 저장
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
