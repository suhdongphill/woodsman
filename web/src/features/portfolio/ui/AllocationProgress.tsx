/**
 * 목표 비중 대비 현재 비중 — "한 번에 완성되지 않는다"를 그대로 보여주는 화면.
 *
 * ## 왜 이 화면이 필요한가
 * 목표 배분만 보여주면 **이미 그렇게 굴리고 있는 것처럼** 읽힌다. 실제로는 매달 넣는 돈으로
 * 조금씩 채워 가는 중이다. 그 과정을 감추면 나중에 실제 기록을 올렸을 때 신뢰를 잃는다.
 *
 * 그래서 목표와 현재를 같은 막대 위에 겹쳐 그린다.
 * - 채워진 부분(진한 색) = 현재 비중
 * - 남은 부분(테두리만) = 목표까지 남은 자리
 *
 * ⚠ "무엇을 얼마나 사라"는 말은 쓰지 않는다. 차이까지만 보여주고 판단은 사람이 한다.
 */
import { Card, SectionHeader } from "@/components/ui/Card";
import { bucketColor, bucketName, type PortfolioBucket } from "@/lib/bucket-target";
import type { AllocationRow } from "@/lib/allocation";
import type { UsdKrwRate } from "@/lib/fx-rate";

export function AllocationProgress({
  rows,
  buckets,
  fillPct,
  usdKrw,
  className,
}: {
  rows: AllocationRow[];
  /** 이름·색의 원본. ⚠ 관리자가 바꾼 이름을 화면이 그대로 쓴다 */
  buckets: PortfolioBucket[];
  /** 구성 완료율 0~100 */
  fillPct: number;
  /**
   * 달러 종목 환산에 쓴 환율 — 화면에 밝힌다.
   * ⚠ 숫자만 받지 않는다. **기준일과 출처가 붙어 온다**(2026-08-31) —
   *    전에는 숫자만 받아서 「1달러 = 1,350원」이 언제 기준인지 아무도 몰랐다.
   */
  usdKrw: UsdKrwRate;
  className?: string;
}) {
  const maxScale = Math.max(100, ...rows.map((r) => Math.max(r.targetPct, r.currentPct)));

  return (
    <section className={className}>
      <SectionHeader
        title="목표까지 얼마나 채웠나"
        subtitle="정한 분류별 목표 비중을 매달 나눠서 채워 갑니다. 지금은 그 과정의 한 지점입니다."
      />

      <Card>
        <div className="mb-5 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tabular-nums text-ink">{fillPct}%</span>
          <span className="text-[12.5px] text-muted">구성 완료</span>
        </div>

        <ul className="space-y-4">
          {rows.map((row) => {
            const color = bucketColor(buckets, row.functionType);
            const label = bucketName(buckets, row.functionType);
            const currentW = (row.currentPct / maxScale) * 100;
            const targetW = (row.targetPct / maxScale) * 100;
            const filled = row.gapPct >= 0;

            return (
              <li key={row.functionType}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-gray-300">{label}</span>
                  </span>
                  <span className="tabular-nums text-gray-500">
                    <span className="text-ink">{row.currentPct}%</span>
                    <span className="mx-1 text-gray-700">/</span>
                    목표 {row.targetPct}%
                    <span className={filled ? "ml-2 text-gray-600" : "ml-2 text-gold-500"}>
                      {filled ? "채움" : `${Math.abs(row.gapPct)}%p 남음`}
                    </span>
                  </span>
                </div>

                {/* 목표 자리는 테두리로, 채운 만큼만 색으로 */}
                <div
                  className="relative h-3 rounded-full bg-bg"
                  role="img"
                  aria-label={`${label} 현재 ${row.currentPct}%, 목표 ${row.targetPct}%`}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full border border-dashed"
                    style={{ width: `${targetW}%`, borderColor: `${color}66` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${currentW}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 border-t border-border/70 pt-3.5 text-[11.5px] leading-relaxed text-gray-600">
          점선은 목표 비중, 채워진 막대는 현재 비중입니다. 목표에 맞추기 위해 한꺼번에 사고팔지
          않고, 매달 들어오는 자금으로 부족한 자리부터 채웁니다. 달러 종목은{" "}
          {/* ⚠ 문구는 `lib/fx-rate.ts`가 만든다 — 화면마다 조립하면 어딘가는 날짜를 빠뜨린다. */}
          {/* ⚠ 낡았거나 설정값으로 떨어졌으면 눈에 띄게 — 조용히 지나가면 안 본다. */}
          <span
            className={
              usdKrw.stale || usdKrw.origin === "SETTING" ? "text-gold-500" : "text-gray-500"
            }
          >
            {usdKrw.caption}
          </span>{" "}
          기준으로 환산했습니다.
        </p>
      </Card>
    </section>
  );
}
