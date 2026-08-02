import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Donut } from "@/components/ui/Donut";
import { StatTile } from "@/components/ui/StatBar";
import { FUNCTION_COLOR, FUNCTION_LABEL } from "@/components/ui/Badge";
import { HoldingCard } from "@/features/portfolio/ui/HoldingCard";
import { CapitalFlowChart } from "@/features/portfolio/ui/CapitalFlowChart";
import { JournalTimeline } from "@/features/portfolio/ui/JournalTimeline";
import { AllocationProgress } from "@/features/portfolio/ui/AllocationProgress";
import { ChevronRightIcon } from "@/components/icons";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { summarizePerformance } from "@/lib/performance";
import { fillProgressPct, holdingValueKrw, summarizeAllocation } from "@/lib/allocation";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { functionAllocation, modelHoldings, rebalances } from "@/lib/mock";
import type { FunctionType } from "@/lib/types";

export const metadata: Metadata = {
  title: "대표 포트폴리오",
  description:
    "납입원금 대비 평가액 추이, 성장·인컴·방어 기능별 배분, 종목별 편입 논리(thesis)를 그대로 공개합니다. 목표 비중을 단계적으로 채워 가는 과정을 기록합니다.",
};

const ORDER: FunctionType[] = ["GROWTH", "INCOME", "DEFENSE"];

const BUCKET_DESC: Record<FunctionType, string> = {
  GROWTH: "이익 성장으로 수익을 만든다. 변동성을 감수하는 자리.",
  INCOME: "배당·이자로 현금흐름을 만든다. 하락장에서 버티는 힘.",
  DEFENSE: "지수·현금으로 최악을 막고 리밸런싱 탄약을 보관한다.",
};

/** ⚠ 정적 생성 금지 — 기록을 올려도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [snapshots, recentJournal, basics] = await Promise.all([
    loadSnapshots(),
    loadPublishedJournal(3),
    getSiteBasics(),
  ]);

  const published = modelHoldings.filter((h) => h.published);
  const alloc = functionAllocation();

  // 목표 비중 대비 현재 비중 — 한 번에 완성되지 않는다는 사실을 그대로 보여준다.
  const allocationRows = summarizeAllocation(
    published.map((h) => ({
      functionType: h.functionType,
      targetWeight: h.targetWeight,
      // ⚠ 반드시 원화로 환산해서 넘긴다 — 통화를 섞으면 비중이 통째로 틀린다.
      marketValue: holdingValueKrw(h, basics.usdKrwRate),
    })),
  );
  const fillPct = fillProgressPct(allocationRows);
  const segments = ORDER.map((f) => ({
    label: FUNCTION_LABEL[f],
    value: alloc[f],
    color: FUNCTION_COLOR[f],
  }));
  const perf = summarizePerformance(snapshots);

  return (
    <>
      <PageHeader
        eyebrow="MODEL PORTFOLIO"
        title="대표 포트폴리오"
        description="매달 얼마를 넣었고 지금 얼마가 되었는지, 각 종목이 맡은 '기능'과 편입 논리까지 그대로 공개합니다."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-12">
        <DataModeNotice mode={basics.dataMode} />
        {/* ─── 자금 흐름: 넣은 돈과 불어난 돈 ─── */}
        {perf && (
          <section>
            <SectionHeader
              title="넣은 돈과 불어난 돈"
              subtitle={`${perf.months}개월 기록 · ${formatDate(perf.asOf)} 기준`}
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <Card className="min-w-0">
                <CapitalFlowChart
                  snapshots={snapshots}
                  rebalances={rebalances.map((r) => ({ date: r.date, memo: r.memo }))}
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Card>
                  <p className="text-[11px] text-muted">평가액</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {formatNumber(perf.value)}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    납입원금 {formatNumber(perf.principal)}
                  </p>
                </Card>
                <Card>
                  <p className="text-[11px] text-muted">평가손익</p>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      perf.profit >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatPct(perf.returnPct)}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {perf.profit >= 0 ? "+" : "−"}
                    {formatNumber(Math.abs(perf.profit))} · 배당·이자 누적{" "}
                    {formatNumber(perf.income)}
                  </p>
                </Card>
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
          </section>
        )}

        {/* 요약 */}
        <section className="grid lg:grid-cols-[auto_1fr] gap-8 items-center">
          <Card className="flex items-center gap-7">
            <Donut
              segments={segments}
              centerLabel={String(published.length)}
              centerSub="종목"
            />
            <div className="space-y-3.5 min-w-[140px]">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-muted flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-white tabular-nums">{s.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatTile label="공개 종목" value={`${published.length}개`} sub="현금성 포함" />
            <StatTile
              label="성장 버킷"
              value={`${alloc.GROWTH}%`}
              tone="up"
              sub="TSMC · 엔비디아"
            />
            <StatTile
              label="인컴 버킷"
              value={`${alloc.INCOME}%`}
              tone="gold"
              sub="채권 · 배당주 · 인프라"
            />
            <StatTile
              label="최근 리밸런싱"
              value={formatDate(rebalances[0].date)}
              sub={`총 ${rebalances.length}회`}
            />
          </div>
        </section>

        {/* 목표 대비 현재 — 한 번에 완성되지 않는다는 사실을 그대로 */}
        <AllocationProgress
          rows={allocationRows}
          fillPct={fillPct}
          usdKrwRate={basics.usdKrwRate}
        />

        {/* 기능별 종목 */}
        {ORDER.map((f) => {
          const items = published.filter((h) => h.functionType === f);
          if (!items.length) return null;
          return (
            <section key={f}>
              <SectionHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: FUNCTION_COLOR[f] }}
                    />
                    {FUNCTION_LABEL[f]} 버킷
                    <span className="text-sm font-normal text-gold-400">{alloc[f]}%</span>
                  </span>
                }
                subtitle={BUCKET_DESC[f]}
              />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((h) => (
                  <HoldingCard key={h.id} holding={h} />
                ))}
              </div>
            </section>
          );
        })}

        {/* 최근 투자일지 — 결과 옆에 판단을 둔다 */}
        <section>
          <SectionHeader
            title="최근 투자일지"
            subtitle="위 곡선이 '무슨 일이 있었나'라면, 여기는 '왜 그렇게 했나'입니다."
            action={
              <Link
                href="/journal"
                className="flex shrink-0 items-center gap-0.5 text-xs text-gold-400 hover:text-gold-500"
              >
                전체 기록
                <ChevronRightIcon size={13} />
              </Link>
            }
          />
          <JournalTimeline entries={recentJournal} />
        </section>

        <p className="text-[11px] text-gray-600 leading-relaxed">
          ※ 본 포트폴리오는 정보 제공 목적의 기록이며 투자 권유가 아닙니다. 평가액·수익률은 기록
          시점의 종가 기준으로 세금·거래비용이 반영되지 않을 수 있으며, 과거의 성과가 미래의
          수익을 보장하지 않습니다. 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있습니다.{" "}
          <Link href="/disclaimer" className="text-gray-500 underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
        </p>
      </div>
    </>
  );
}
