import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Donut } from "@/components/ui/Donut";
import { StatTile } from "@/components/ui/StatBar";
import { HoldingCard } from "@/features/portfolio/ui/HoldingCard";
import { CapitalFlowSection } from "@/features/portfolio/ui/CapitalFlowSection";
import { MacroAnswerNote } from "@/features/portfolio/ui/MacroAnswerNote";
import { JournalTimeline } from "@/features/portfolio/ui/JournalTimeline";
import { AllocationProgress } from "@/features/portfolio/ui/AllocationProgress";
import { ChevronRightIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { summarizePerformance } from "@/lib/performance";
import { fillProgressPct, holdingValueKrw, summarizeAllocation } from "@/lib/allocation";
import { summarizeManualPrices } from "@/lib/manual-price";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { loadPublishedHoldings, loadRebalances } from "@/features/portfolio/repository";
import { loadSectionPosts } from "@/features/posts/repository";
import { SectionFrame } from "@/features/posts/ui/SectionFrame";
import type { ModelHolding } from "@/lib/types";
import { loadBuckets } from "@/features/portfolio/buckets-repo";
import { loadReportLinkEntries } from "@/features/reports/repository";
import { loadMacroOverview } from "@/features/macro/service";
import { loadUsdKrwRate } from "@/features/macro/fx-service";
import { macroLede } from "@/lib/home-lede";
import { buildReportIndex, publicReportHref } from "@/lib/report/link";
import {
  cashTargetPct,
  isBucketTargetSet,
  orphanHoldings,
  type PortfolioBucket,
} from "@/lib/bucket-target";

export const metadata: Metadata = {
  title: "대표 포트폴리오",
  description:
    "지표가 말하는 흐름에 대해 실제로 계좌를 어떻게 굴렸는지 그대로 공개합니다. 납입원금 대비 평가액 추이, 기능별 배분, 종목별 편입 논리(thesis)와 목표 비중을 채워 가는 과정까지 기록합니다.",
};

/** ⚠ 정적 생성 금지 — 기록을 올려도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/** 버킷 안의 종목 이름 — 예전엔 "TSMC · 엔비디아"가 코드에 박혀 있었다(DB를 고쳐도 안 바뀜). */
function bucketNames(holdings: ModelHolding[], key: string): string {
  const names = holdings.filter((h) => h.functionType === key).map((h) => h.name);
  if (!names.length) return "아직 비어 있음";
  return names.length > 3 ? `${names.slice(0, 3).join(" · ")} 외 ${names.length - 3}` : names.join(" · ");
}

export default async function PortfolioPage() {
  const [
    snapshots,
    recentJournal,
    basics,
    published,
    rebalances,
    sectionPosts,
    buckets,
    reportEntries,
    macro,
  ] = await Promise.all([
    loadSnapshots(),
    loadPublishedJournal(3),
    getSiteBasics(),
    loadPublishedHoldings(),
    loadRebalances(),
    loadSectionPosts("PORTFOLIO", 5),
    loadBuckets(),
    loadReportLinkEntries(),
    loadMacroOverview(),
  ]);

  /**
   * ⚠ 환율은 **수집값**을 쓴다(2026-08-31). `basics.usdKrwRate`는 수집 전·수집 실패 때의
   *    설정값이고, 그때는 화면이 그렇다고 밝힌다(`lib/fx-rate.ts`).
   */
  const usdKrw = await loadUsdKrwRate(basics.usdKrwRate);

  // 목표 비중 대비 현재 비중 — 한 번에 완성되지 않는다는 사실을 그대로 보여준다.
  const allocationRows = summarizeAllocation(
    published.map((h) => ({
      functionType: h.functionType,
      targetWeight: h.targetWeight,
      // ⚠ 반드시 원화로 환산해서 넘긴다 — 통화를 섞으면 비중이 통째로 틀린다.
      marketValue: holdingValueKrw(h, usdKrw.rate),
    })),
    buckets,
  );
  const fillPct = fillProgressPct(allocationRows);
  const targetPct = (key: string) =>
    allocationRows.find((r) => r.functionType === key)?.targetPct ?? 0;

  // ⚠ 목표는 관리자가 정한 값이다. 종목에서 파생시키지 않는다(2026-08-17).
  const targetSet = isBucketTargetSet(buckets);
  const cashPct = cashTargetPct(buckets);
  const segments = [
    ...buckets.map((b) => ({ label: b.name, value: b.targetPct, color: b.color })),
    // ⚠ 남는 몫을 그린다. 빼면 도넛이 100%를 채워 "현금이 없다"로 읽힌다.
    ...(cashPct > 0 ? [{ label: "현금·미배정", value: cashPct, color: "var(--w-flat)" }] : []),
  ];
  // ⚠ 어느 버킷에도 없는 종목 — 아래 버킷 목록에서 빠지므로 따로 모아 보여준다.
  const orphans = orphanHoldings(buckets, published);

  // ⚠ 보고서가 **발행돼 있을 때만** 카드에 링크를 건다. 전에는 티커만 있으면 걸어서
  //    발행본이 없는 종목이 전부 404로 갔다(`lib/report/link.ts`).
  const reportIndex = buildReportIndex(reportEntries);
  const cardProps = (h: ModelHolding) => ({
    reportHref: publicReportHref(h, reportIndex),
    bucketName: buckets.find((b) => b.key === h.functionType)?.name,
    bucketColor: buckets.find((b) => b.key === h.functionType)?.color,
  });
  const headline: PortfolioBucket[] = buckets.slice(0, 2);
  const perf = summarizePerformance(snapshots);
  // ⚠ 현재가는 수기 입력이다. 기준일을 밝히지 않으면 자동 시세처럼 읽힌다.
  const prices = summarizeManualPrices(published, new Date().toISOString().slice(0, 10));

  return (
    <>
      {/* ⚠ 머리말은 **흐름에 대한 나의 답**이다(2026-08-31, 재편 Step 4). 계좌 자랑이 아니라,
          위에서 읽은 바람에 대해 실제로 무엇을 했는지가 이 페이지의 자리다. */}
      <PageHeader
        eyebrow="MODEL PORTFOLIO"
        title="대표 포트폴리오"
        description="지표가 말하는 흐름에 대한 저의 답입니다. 매달 얼마를 넣어 지금 얼마가 되었는지, 각 종목이 맡은 '기능'과 편입 논리까지 그대로 공개합니다."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-12">
        <DataModeNotice mode={basics.dataMode} />

        {/* 무엇에 대한 답인가 — 값이 없으면 이 줄은 사라진다(지어내지 않는다) */}
        <MacroAnswerNote
          lede={macroLede({ empty: macro.empty, summary: macro.summary, asOf: macro.asOf })}
        />

        {/* ─── 자금 흐름: 넣은 돈과 불어난 돈. ⚠ 스냅숏이 없어도 섹션을 빼지 않는다 ─── */}
        <CapitalFlowSection
          snapshots={snapshots}
          rebalances={rebalances.map((r) => ({ date: r.date, memo: r.memo }))}
          perf={perf}
        />

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
                  <span className="text-sm font-bold text-ink tabular-nums">{s.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatTile label="공개 종목" value={`${published.length}개`} sub="현금성 포함" />
            {/* ⚠ 앞의 두 분류를 보여준다. 예전엔 성장·인컴이 코드에 박혀 있어
                관리자가 분류를 바꿔도 이 자리만 옛 이름으로 남았다. */}
            {headline.map((b, i) => (
              <StatTile
                key={b.key}
                label={`${b.name} 버킷`}
                value={`${targetPct(b.key)}%`}
                tone={i === 0 ? "up" : "gold"}
                sub={bucketNames(published, b.key)}
              />
            ))}
            <StatTile
              label="최근 리밸런싱"
              value={rebalances.length ? formatDate(rebalances[0].date) : "—"}
              sub={rebalances.length ? `총 ${rebalances.length}회` : "기록 없음"}
            />
          </div>
        </section>

        {/* 목표 대비 현재 — 한 번에 완성되지 않는다는 사실을 그대로 */}
        {targetSet && (
          <AllocationProgress
            rows={allocationRows}
            buckets={buckets}
            fillPct={fillPct}
            usdKrw={usdKrw}
          />
        )}

        {/* ⚠ 현재가는 손으로 적는 값이다. 기준일을 밝히지 않으면 자동 시세로 읽힌다. */}
        {published.length > 0 && (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-[12px] leading-relaxed text-gray-400">
            {prices.note}
          </p>
        )}

        {/* 기능별 종목 */}
        {buckets.map((b) => {
          const items = published.filter((h) => h.functionType === b.key);
          if (!items.length) return null;
          return (
            <section key={b.key}>
              <SectionHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.name} 버킷
                    <span className="text-sm font-normal text-gold-400">{targetPct(b.key)}%</span>
                  </span>
                }
                subtitle={b.description}
              />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((h) => (
                  <HoldingCard key={h.id} holding={h} {...cardProps(h)} />
                ))}
              </div>
            </section>
          );
        })}

        {/* ⚠ 어느 버킷에도 속하지 않는 종목. 위 목록에서 빠지므로 여기 모아 둔다 —
            조용히 사라지면 공개 종목 수와 화면이 어긋난다. */}
        {orphans.length > 0 && (
          <section>
            <SectionHeader
              title="분류 미지정"
              subtitle="아직 어느 분류에도 넣지 않은 종목입니다. 배분 비중 계산에는 들어가지 않습니다."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orphans.map((h) => (
                <HoldingCard key={h.id} holding={h} {...cardProps(h)} />
              ))}
            </div>
          </section>
        )}

        {/* 이 화면에 대해 쓴 글 — 발행할 때마다 쌓인다 */}
        <SectionFrame section="PORTFOLIO" posts={sectionPosts} />

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
