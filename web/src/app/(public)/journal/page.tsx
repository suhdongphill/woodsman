import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatBar";
import { JournalTimeline } from "@/features/portfolio/ui/JournalTimeline";
import { AdSlot } from "@/components/analytics/AdSlot";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { formatDate, formatPct } from "@/lib/format";
import { summarizePerformance } from "@/lib/performance";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";

export const metadata: Metadata = {
  alternates: { canonical: "/journal" },
  title: "투자일지",
  description:
    "매수·매도·리밸런싱을 언제 왜 했는지, 체결 수량과 단가까지 함께 남기는 기록입니다. 잘못된 판단도 지우지 않습니다.",
};

/** ⚠ 정적 생성 금지 — 관리자가 일지를 올려도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const [entries, snapshots, basics] = await Promise.all([
    loadPublishedJournal(),
    loadSnapshots(),
    getSiteBasics(),
  ]);
  const perf = summarizePerformance(snapshots);

  const counts = {
    trade: entries.filter((e) => e.action === "BUY" || e.action === "SELL").length,
    rebalance: entries.filter((e) => e.action === "REBALANCE").length,
    note: entries.filter((e) => e.action === "NOTE").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="JOURNAL"
        title="투자일지"
        description="산 이유와 판 이유를 그때그때 적습니다. 사후에 고치지 않기 위해서입니다."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <DataModeNotice mode={basics.dataMode} className="mb-5" />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="매매 기록" value={`${counts.trade}건`} sub="매수 · 매도" />
          <StatTile label="리밸런싱" value={`${counts.rebalance}회`} tone="gold" sub="정기 조정" />
          <StatTile
            label="누적 성과"
            value={perf ? formatPct(perf.returnPct) : "—"}
            tone={perf && perf.returnPct >= 0 ? "up" : "down"}
            sub={perf ? `${formatDate(perf.asOf)} 기준` : undefined}
          />
        </div>

        <Card className="mt-6">
          <p className="text-[12.5px] leading-relaxed text-muted">
            기록 원칙 — ① 매매 <strong className="text-gray-300">전</strong>에 근거를 적는다. ②
            정기 리밸런싱과 논리 훼손 매도를 섞지 않는다. ③{" "}
            <strong className="text-gray-300">아무것도 하지 않기로 한 판단도 기록한다.</strong>{" "}
            성과 곡선은{" "}
            <Link href="/portfolio" className="text-gold-400 hover:text-gold-500">
              대표 포트폴리오
            </Link>
            에서 볼 수 있습니다.
          </p>
        </Card>

        <div className="mt-8">
          <JournalTimeline entries={entries} />
        </div>

        {/* 기록을 다 읽은 자리 — 블로그 유도 먼저 */}
        <TistoryCta
          variant="compact"
          className="mt-10"
          headline="판단의 배경은 블로그에 더 길게 씁니다"
        />

        {/* 광고 — CTA 아래 */}
        <AdSlot placement="content-bottom" />

        <p className="mt-10 text-[11px] leading-relaxed text-gray-600">
          ※ 개인의 매매 기록이며 투자 권유가 아닙니다. 같은 종목을 같은 시점에 매매해도 결과는
          다를 수 있습니다.{" "}
          <Link href="/disclaimer" className="text-gray-500 underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
        </p>
      </div>
    </>
  );
}
