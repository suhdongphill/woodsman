import { Card, SectionHeader } from "@/components/ui/Card";
import { CapitalFlowChart, type RebalanceMarker } from "./CapitalFlowChart";
import { formatDate, formatNumber, formatPct, profitColor } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/performance";
import type { AccountSnapshot } from "@/lib/types";

/**
 * 자금 흐름 — 넣은 돈과 불어난 돈. `/portfolio`의 **첫 화면**이다.
 *
 * ## 왜 컴포넌트로 뺐나 (2026-08-31, 홈 재편 Step 4)
 * 홈에서 계좌 상세가 내려오면서 이 섹션이 `/portfolio`의 머리가 됐다
 * (`docs/설계_홈_콘텐츠중심_재편.md` Step 2·4). 그런데 라우트가 이 자리에서
 * **차트 조립·문구·"값이 없으면 어떻게 하나"**를 다 쥐고 있었다 — CLAUDE.md §1이
 * 경고하는 상태다(라우트는 조립만 한다).
 *
 * ## ⚠ 스냅숏이 없어도 **섹션을 빼지 않는다**
 * 전에는 `perf`가 `null`이면 이 섹션이 **통째로 사라졌다.** 그러면 계좌 페이지의 첫 화면이
 * 도넛부터 시작해, 처음 온 사람에게는 "이 페이지에 자금 흐름이 없다"로 읽힌다.
 * 홈의 계좌 띠는 이미 같은 규칙을 지키고 있다(`features/home/ui/AccountStrip`) —
 * **빈 칸을 0원으로 만들지 않고, 없다고 적는다.** 두 화면이 같은 상태를 다르게 말하면 안 된다.
 *
 * ⚠ 이 차트는 **여기에만** 있다. 홈에서 내려온 것이라 홈에 다시 그리면 중복이 된다
 * (`app/design-policy.test.ts`가 소스를 훑어 지킨다).
 */
export function CapitalFlowSection({
  snapshots,
  rebalances,
  perf,
}: {
  snapshots: AccountSnapshot[];
  rebalances: RebalanceMarker[];
  perf: PerformanceSummary | null;
}) {
  return (
    <section>
      <SectionHeader
        title="넣은 돈과 불어난 돈"
        subtitle={
          perf
            ? `${perf.months}개월 기록 · ${formatDate(perf.asOf)} 기준`
            : "매달의 납입원금과 평가액을 기록하면 여기에 곡선이 그려집니다"
        }
      />

      {perf ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="min-w-0">
            <CapitalFlowChart snapshots={snapshots} rebalances={rebalances} />
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Card>
              <p className="text-[11px] text-muted">평가액</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                {formatNumber(perf.value)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                납입원금 {formatNumber(perf.principal)}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] text-muted">평가손익</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${profitColor(perf.profit)}`}>
                {formatPct(perf.returnPct)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {perf.profit >= 0 ? "+" : "−"}
                {formatNumber(Math.abs(perf.profit))} · 배당·이자 누적 {formatNumber(perf.income)}
              </p>
            </Card>
            {/* ⚠ 손실 구간을 지우지 않는다 — 좋은 구간만 남기면 기록이 아니라 광고가 된다. */}
            {perf.worst && (
              <Card className="sm:col-span-2 lg:col-span-1">
                <p className="text-[11px] text-muted">원금 아래로 내려갔던 구간</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-red-400">
                  {formatPct(perf.worst.pct)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  {formatDate(perf.worst.date)} · 총 {perf.underwaterMonths}개월. 손실 구간도
                  지우지 않고 남깁니다.
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* ⚠ 없는 값을 0으로 만들지 않는다 — 없다고 말한다. */
        <Card>
          <p className="text-[13px] leading-relaxed text-muted">
            아직 계좌 스냅숏이 없습니다. 첫 기록이 올라가면 납입원금 위를 지나는 평가액 곡선과
            리밸런싱 지점이 여기에 그려집니다.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
            그때까지도 아래의 <strong className="font-medium text-muted">목표 구성비</strong>와{" "}
            <strong className="font-medium text-muted">편입 논리</strong>는 그대로 공개되어
            있습니다 — 숫자가 없다고 판단까지 비어 있는 것은 아닙니다.
          </p>
        </Card>
      )}
    </section>
  );
}
