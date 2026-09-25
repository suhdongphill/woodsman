import { Card, SectionHeader } from "@/components/ui/Card";
import { cx, profitColor } from "@/lib/format";
import { className, type Fit } from "@/lib/leaders/view";

/**
 * 실증 적합도 — 과거 시점에 그때 알 수 있던 정보로 분류하고 그 뒤 3개월 초과수익을 잰 것(볼트 validate-leaders.py).
 * ⚠ **한계를 숫자와 같은 크기로** 적는다. 이 사이트는 근거 있는 항해를 말하는 곳이고, 편향을 작게 쓰면 숫자가 광고가 된다.
 * ⚠ 판정이 방향을 가리켰는지만 말한다 — 「주도주를 사면 +13%p」로 읽히게 쓰지 않는다(투자 권유 금지, /disclaimer).
 */
export function LeaderFit({ fit }: { fit: Fit }) {
  return (
    <section>
      <SectionHeader
        title="이 판정은 과거에 맞았나"
        subtitle={
          fit.span
            ? `${fit.span[0]} ~ ${fit.span[1]} · 월 리밸런스 ${fit.rebalances ?? "—"}회 · 관측 ${fit.observations?.toLocaleString() ?? "—"}건. 그 시점에 알 수 있던 정보만으로 분류하고, 그 뒤 3개월 벤치마크 대비 초과수익을 쟀습니다.`
            : undefined
        }
      />
      <Card>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fit.byClass.map(({ cls, m3 }) => (
            <div key={cls} className="rounded-lg bg-bg px-3 py-2.5">
              <dt className="text-[11px] text-gray-500">{className(cls)}</dt>
              <dd className={cx("mt-0.5 text-[16px] font-bold tabular-nums", profitColor(m3.mean))}>
                {m3.mean >= 0 ? "+" : ""}
                {m3.mean.toFixed(1)}%p
              </dd>
              <p className="mt-0.5 text-[10.5px] tabular-nums text-gray-500">
                n {m3.n} · 승률 {m3.win.toFixed(1)}% · t {m3.t.toFixed(1)}
              </p>
            </div>
          ))}
        </dl>
        {/* ⚠ 기준선을 같이 둔다 — 상승장 표본에선 모든 판정이 플러스라, 기준선 없이 보면 「뭘 사도 된다」로 읽힌다 */}
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          {fit.baseline && `같은 기간 관찰 대상 전체 평균은 ${fit.baseline.mean >= 0 ? "+" : ""}${fit.baseline.mean.toFixed(1)}%p입니다(상승장이 많은 표본). `}
          {fit.spread != null &&
            `주도주와 제외의 3개월 초과수익 차이는 ${fit.spread >= 0 ? "+" : ""}${fit.spread.toFixed(1)}%p — ${fit.spread > 0 ? "분류가 방향을 가리켰습니다" : "분류가 방향을 가리키지 못했습니다"}. 다만 후발 후보·추격 주의·제외 사이의 순서는 뚜렷하지 않습니다.`}
        </p>
        {fit.caveats.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-bg px-4 py-3">
            <p className="text-[12px] font-semibold text-ink">이 검증이 증명하지 못하는 것</p>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-muted">
              {fit.caveats.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </section>
  );
}
