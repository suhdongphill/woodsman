import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { BarChartIcon } from "@/components/icons";
import { ReportCard } from "@/features/reports/ui/ReportCard";
import { loadPublishedSummaries } from "@/features/reports/repository";
import { loadSeriesMany } from "@/features/macro/repository";
import { indicatorsByGroup } from "@/lib/macro/catalog";
import { sectorStrength, type SectorStrength } from "@/lib/sector-strength";
import { SectorLeaders } from "@/features/stocks/ui/SectorLeaders";

export const metadata: Metadata = {
  alternates: { canonical: "/stocks" },
  title: "종목분석",
  description: "정직성 규율을 통과해 발행한 종목분석 보고서 목록입니다.",
};

/** ⚠ 정적 생성 금지 — 발행 상태가 바뀌면 곧바로 반영돼야 한다. */
export const dynamic = "force-dynamic";

/**
 * 종목분석 목록.
 *
 * ⚠ 2026-08-15: `lib/mock`의 종목 8건(지어낸 시세 포함)을 걷어냈다.
 *    이제 **발행된 보고서만** 나온다. 비어 있으면 비어 있다고 적는다 —
 *    목업으로 채운 목록은 방문자에게 "이만큼 분석했다"는 거짓 신호를 준다.
 */
/** ⚠ 시장 기준(SPY)의 키. 이 값이 없으면 상대강도를 내지 않는다 — 기준 없는 강함은 없다. */
const BENCHMARK_KEY = "spx_etf";

export default async function StocksPage() {
  const leaders = indicatorsByGroup("leaders");
  const [reports, series] = await Promise.all([
    loadPublishedSummaries(),
    loadSeriesMany(leaders.map((i) => i.key)),
  ]);

  const benchmark = series.get(BENCHMARK_KEY);
  const strengths: SectorStrength[] = leaders
    // 기준(SPY)은 비교 대상이지 섹터가 아니다 — 표에 넣지 않는다.
    .filter((i) => i.key !== BENCHMARK_KEY)
    .map((i) => sectorStrength({ key: i.key, name: i.name, points: series.get(i.key) ?? [] }, benchmark))
    .filter((s): s is SectorStrength => s !== null);

  return (
    <>
      <PageHeader
        eyebrow="STOCKS"
        title="종목분석"
        description="근거·출처·기준일을 갖춘 보고서만 발행합니다. 확인하지 못한 항목은 비운 채 조회처를 적습니다."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6 py-10">
        {/* ⚠ 바람·조류(거시)를 읽었다면 파도가 어디서 일고 있는지가 여기 있다 */}
        <SectorLeaders items={strengths} />

        {reports.length === 0 ? (
          <EmptyState
            icon={<BarChartIcon size={30} />}
            title="아직 발행한 보고서가 없습니다"
            description="정직성 규율(근거·출처·기준일·철회 조건·방법론 한계)을 통과한 보고서만 여기에 올립니다. 준비되는 대로 공개합니다."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r) => (
              <ReportCard key={r.ticker} report={r} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
