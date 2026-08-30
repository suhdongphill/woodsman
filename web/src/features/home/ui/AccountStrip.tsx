import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatBar } from "@/components/ui/StatBar";
import { ChevronRightIcon } from "@/components/icons";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { formatDate, formatNumber, formatPct, profitColor } from "@/lib/format";
import { cashTargetPct, isBucketTargetSet, type PortfolioBucket } from "@/lib/bucket-target";
import type { PerformanceSummary } from "@/lib/performance";
import type { DataMode } from "@/lib/data-mode";

/**
 * 계좌 띠 — **"이 흐름 속에서 나는 이렇게 하고 있다"** 한 줄.
 *
 * ## 왜 카드가 아니라 띠인가 (2026-08-30, Step 2)
 * 홈의 첫 화면이 계좌 평가액으로 열리고 있었다. 그런데 검색으로 들어온 사람은 남의 계좌
 * 숫자를 찾아온 게 아니고, 1순위 목적은 **블로그로 넘기는 것**이다.
 * 그래서 계좌를 **지우지 않고 자리를 옮겼다** — 입구는 콘텐츠가 맡고, 계좌는 그 흐름에 대한
 * **나의 답**으로 뒤에 붙는다.
 *
 * ⚠ **지우지 않는 이유가 있다.** 운영지침 §4는 "사이트 고유 콘텐츠(계좌 공개·투자일지)가
 *    검색 유입을 만드는 미끼다. 약화시키지 않는다"고 못 박는다. 남의 지표 요약은 흔하지만
 *    **지표를 읽고 실제로 그렇게 굴린 기록**은 흔하지 않다 — 그것이 이 사이트의 차별점이다.
 *
 * ⚠ 계좌 숫자가 **한 줄이라도** 나오면 모의/실계좌 표시는 의무다(운영지침 §5).
 *    자리가 줄었다고 표시를 빼지 않는다.
 * ⚠ 막대는 **목표 구성비**다. 현재 배분이 아니다(2026-08-17 점검에서 지적된 자리).
 * ⚠ 스냅숏이 없어도 **띠를 빼지 않는다.** 빈 칸을 0원으로 만들지 않고, 없다고 적는다.
 */
export function AccountStrip({
  perf,
  buckets,
  dataMode,
}: {
  perf: PerformanceSummary | null;
  buckets: PortfolioBucket[];
  dataMode: DataMode;
}) {
  const cashPct = cashTargetPct(buckets);
  const targetSet = isBucketTargetSet(buckets);
  const segments = [
    ...buckets.map((b) => ({ label: b.name, value: b.targetPct, color: b.color })),
    ...(cashPct > 0 ? [{ label: "현금·미배정", value: cashPct, color: "var(--w-flat)" }] : []),
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">이 흐름 속에서 저는 이렇게 하고 있습니다</p>
            {perf ? (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold tabular-nums leading-none text-ink">
                  {formatNumber(perf.value)}
                </span>
                <span
                  className={`text-[13px] font-medium tabular-nums ${
                    profitColor(perf.profit)
                  }`}
                >
                  {formatPct(perf.returnPct)}
                </span>
                <span className="text-[11px] text-gray-500">
                  납입원금 {formatNumber(perf.principal)} · {formatDate(perf.asOf)} 기준
                </span>
              </p>
            ) : (
              /* ⚠ 없는 값을 0으로 만들지 않는다 — 없다고 말한다. */
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                아직 계좌 스냅숏이 없습니다. 첫 기록이 올라가면 여기에 평가액과 수익률이 나옵니다.
              </p>
            )}
          </div>

          {targetSet && (
            <div className="min-w-[220px] flex-1">
              {/* ⚠ 목표임을 반드시 적는다. 안 적으면 현재 배분으로 읽힌다. */}
              <p className="mb-1.5 flex items-baseline justify-between text-[11px] text-gray-500">
                <span>목표 구성비</span>
                <span className="text-gray-600">현재 배분은 /portfolio에서</span>
              </p>
              <StatBar segments={segments} height="h-3" />
            </div>
          )}

          <Link
            href="/portfolio"
            className="flex shrink-0 items-center gap-0.5 text-[12.5px] text-gold-400 transition-colors hover:text-gold-500"
          >
            계좌 자세히 보기
            <ChevronRightIcon size={13} />
          </Link>
        </div>

        {/* ⚠ 계좌 숫자가 나오는 자리에는 모의/실계좌를 반드시 밝힌다(운영지침 §5). */}
        <DataModeNotice mode={dataMode} className="mt-4" compact />
      </Card>
    </section>
  );
}
