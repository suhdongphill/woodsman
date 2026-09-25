import { Card, SectionHeader } from "@/components/ui/Card";
import { cx, profitColor } from "@/lib/format";
import { divergingWidth, supplyText, type Group } from "@/lib/leaders/view";

/**
 * 자금이 흐르는 순서 — 레이어별 3개월 상대강도 중앙값을 0 기준 좌우 막대로.
 * 순서는 볼트 그대로(상류 전력 → 반도체 → 연결 → 데이터센터 → 모델 → 피지컬 AI, 그리고 한국 축) — 흐름의 순서 자체가 정보다.
 * ⚠ 수급 칩은 「실측」과 「프록시」를 반드시 구분해 적는다 — ETF 거래대금은 순유입이 아니다.
 */
export function LayerFlow({ groups }: { groups: Group[] }) {
  const maxAbs = Math.max(0, ...groups.map((g) => Math.abs(g.rsMedianM3 ?? 0)));
  return (
    <section>
      <SectionHeader
        title="자금이 흐르는 순서"
        subtitle="레이어별 3개월 상대강도 중앙값. 막대는 0을 기준으로 벤치마크를 앞섰는지(오른쪽)·뒤졌는지(왼쪽)를 나타냅니다. 상류(데이터센터 투자)의 지출이 하류의 매출이 됩니다."
      />
      <Card padding="p-0">
        <ul>
          {groups.map((g) => {
            const v = g.rsMedianM3;
            const w = v == null ? 0 : divergingWidth(v, maxAbs);
            return (
              <li key={g.groupId} className="border-t border-border first:border-t-0 px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <a href={`#layer-${g.groupId}`} className="text-[14px] font-semibold text-ink hover:text-gold-400">
                    {g.name}
                  </a>
                  <span className="text-[11.5px] text-gray-500">
                    주도주 <strong className="text-ink">{g.leaders}</strong> / {g.members.length}곳
                    {g.prime > 0 && ` · ★★ ${g.prime}`}
                    {g.breadthHigh != null && ` · 신고가권 ${g.breadthHigh}%`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-2.5 flex-1 rounded-full bg-bg" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    {v != null && (
                      <span
                        className={cx("absolute inset-y-0 rounded-full", v >= 0 ? "bg-up/70" : "bg-down/70")}
                        style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                      />
                    )}
                  </div>
                  <span className={cx("w-16 shrink-0 text-right text-[13px] font-bold tabular-nums", v == null ? "text-gray-500" : profitColor(v))}>
                    {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%p`}
                  </span>
                </div>
                {g.supply?.label && (
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    <span className={cx("mr-1.5 rounded px-1.5 py-0.5", g.supply.basis === "proxy" ? "bg-bg" : "bg-emerald-500/15 text-emerald-400")}>
                      {g.supply.basis === "proxy" ? "프록시" : "실측"}
                    </span>
                    {supplyText(g.supply.label)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
