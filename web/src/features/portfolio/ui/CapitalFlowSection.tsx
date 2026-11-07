import { Card, SectionHeader } from "@/components/ui/Card";
import { formatDate, formatPct, profitColor } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/performance";

/**
 * 수익률 기록. `/portfolio`의 **첫 화면**이다.
 *
 * ## ⚠ 금액을 내지 않는다 (2026-11-07 운영자 결정)
 * 계좌가 실제 운용이고 공개는 비중만이다. 평가액·납입원금·손익 금액은 물론, 금액 곡선과 체결 메모도
 * 이 컴포넌트로 받지 않는다 — 받지 않으면 페이지 데이터로도 새지 않는다.
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
export function CapitalFlowSection({ perf }: { perf: PerformanceSummary | null }) {
  return (
    <section>
      <SectionHeader
        title="수익률 기록"
        subtitle={
          perf
            ? `${perf.months}개월 기록 · ${formatDate(perf.asOf)} 기준`
            : "금액은 공개하지 않고 비중과 수익률로 보여 드립니다"
        }
      />

      {perf ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-[11px] text-muted">납입원금 대비 수익률</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${profitColor(perf.profit)}`}>
              {formatPct(perf.returnPct)}
            </p>
          </Card>
          {/* ⚠ 손실 구간을 지우지 않는다 — 좋은 구간만 남기면 기록이 아니라 광고다. */}
          {perf.worst && (
            <Card>
              <p className="text-[11px] text-muted">원금 아래로 내려갔던 구간</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-red-400">{formatPct(perf.worst.pct)}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                {formatDate(perf.worst.date)} · 총 {perf.underwaterMonths}개월. 손실 구간도 지우지 않고 남깁니다.
              </p>
            </Card>
          )}
        </div>
      ) : (
        /* ⚠ 없는 값을 0으로 만들지 않는다 — 없다고 말한다. */
        <Card>
          <p className="text-[13px] leading-relaxed text-muted">
            납입원금 대비 수익률은 계좌 기록이 쌓이면 여기에 나옵니다.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
            그때까지도 아래의 <strong className="font-medium text-muted">구성 비중</strong>과{" "}
            <strong className="font-medium text-muted">편입 논리</strong>는 그대로 공개되어 있습니다.
          </p>
        </Card>
      )}
    </section>
  );
}
