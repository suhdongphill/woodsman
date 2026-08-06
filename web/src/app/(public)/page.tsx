import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatBar } from "@/components/ui/StatBar";
import { FUNCTION_COLOR } from "@/components/ui/Badge";
import { PostCard } from "@/features/posts/ui/PostCard";
import { CapitalFlowChart } from "@/features/portfolio/ui/CapitalFlowChart";
import { JournalTimeline } from "@/features/portfolio/ui/JournalTimeline";
import { StockCard } from "@/features/stocks/ui/StockCard";
import { AdSlot } from "@/components/analytics/AdSlot";
import { ArrowRightIcon, ChevronRightIcon } from "@/components/icons";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { summarizePerformance } from "@/lib/performance";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { loadPublishedHoldings, loadRebalances } from "@/features/portfolio/repository";
import { loadMacroOverview } from "@/features/macro/service";
import { RecessionBoard } from "@/features/macro/ui/RecessionBoard";
import { sumTargetWeights } from "@/lib/allocation";
import { featuredStocks } from "@/lib/mock";
import { loadPublishedPosts, loadSectionPosts } from "@/features/posts/repository";
import { SectionFrame } from "@/features/posts/ui/SectionFrame";
import type { FunctionType } from "@/lib/types";

/**
 * 홈.
 *
 * 이 사이트는 서비스 가입을 파는 곳이 아니라 **읽는 곳**이다.
 * 그래서 가입 유도 퍼널을 두지 않고, 첫 화면에서 바로
 * "넣은 돈이 얼마가 됐는지"와 "그때 무슨 판단을 했는지"를 보여준다.
 */

const PRINCIPLES = [
  {
    title: "기능으로 나눈다",
    desc: "종목을 고르기 전에 통을 정합니다. 성장·인컴·방어 — 이 돈이 포트폴리오에서 무슨 일을 하는지부터.",
    href: "/portfolio",
    cta: "배분 보기",
  },
  {
    title: "판단을 먼저 적는다",
    desc: "매매 전에 근거를 적습니다. 사후에 고칠 수 없게 만들어야 기록이 자산이 됩니다.",
    href: "/journal",
    cta: "투자일지 읽기",
  },
  {
    title: "손실도 지우지 않는다",
    desc: "평가액이 원금을 밑돌았던 달과, 그때 아무것도 하지 않기로 한 판단까지 남깁니다.",
    href: "/about",
    cta: "운영 원칙",
  },
];

/** ⚠ 정적 생성 금지 — 기록을 올려도 홈이 안 바뀐다. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [snapshots, allJournal, basics, holdings, rebalances, macro, latestPosts, homePosts] =
    await Promise.all([
    loadSnapshots(),
    loadPublishedJournal(),
    getSiteBasics(),
    loadPublishedHoldings(),
    loadRebalances(),
    loadMacroOverview(),
    loadPublishedPosts(3),
    loadSectionPosts("HOME", 4),
  ]);
  const recentJournal = allJournal.slice(0, 3);
  const journalCount = allJournal.length;

  const bucketTarget = (f: FunctionType) =>
    sumTargetWeights(holdings.filter((h) => h.functionType === f));
  const segments = [
    { label: "성장", value: bucketTarget("GROWTH"), color: FUNCTION_COLOR.GROWTH },
    { label: "인컴", value: bucketTarget("INCOME"), color: FUNCTION_COLOR.INCOME },
    { label: "방어", value: bucketTarget("DEFENSE"), color: FUNCTION_COLOR.DEFENSE },
  ];
  const perf = summarizePerformance(snapshots);
  const latestInsights = latestPosts.filter((p) => p.type !== "NOTICE");

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(700px 320px at 12% -10%, rgba(201,166,87,.16), transparent 60%), radial-gradient(600px 300px at 88% 0%, rgba(54,160,106,.14), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
            <div className="fade-up">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-[11px] text-gold-400">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-glow" />
                CULTIVATING WEALTH LIKE A FOREST
              </span>
              <h1 className="mt-5 text-3xl sm:text-4xl lg:text-[42px] font-bold text-white leading-[1.25] tracking-tight">
                {basics.heroTitle}
              </h1>
              <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">
                {basics.heroSubtitle}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <LinkButton href="/portfolio" variant="gold" size="lg">
                  계좌 성과 보기
                  <ArrowRightIcon size={16} />
                </LinkButton>
                <LinkButton href="/journal" variant="outline" size="lg">
                  투자일지 읽기
                </LinkButton>
              </div>
              <dl className="mt-9 grid grid-cols-3 gap-4 max-w-md">
                <div>
                  <dt className="text-[11px] text-gray-500">기록 개월</dt>
                  <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                    {perf?.months ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-500">투자일지</dt>
                  <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                    {journalCount}건
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-500">리밸런싱</dt>
                  <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                    {rebalances.length}회
                  </dd>
                </div>
              </dl>
            </div>

            {/* 계좌 요약 — 숫자를 첫 화면에 그대로 둔다 */}
            <Card className="fade-up bg-card/80 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">운용 계좌</p>
                  <p className="text-base font-semibold text-white mt-0.5">
                    {perf ? formatDate(perf.asOf) : "—"} 기준
                  </p>
                </div>
                <Link
                  href="/portfolio"
                  className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
                >
                  상세
                  <ChevronRightIcon size={12} />
                </Link>
              </div>

              {perf && (
                <>
                  <p className="mt-5 text-[28px] font-bold tabular-nums text-white leading-none">
                    {formatNumber(perf.value)}
                  </p>
                  <p className="mt-2 text-[12px] text-muted">
                    납입원금 {formatNumber(perf.principal)} ·{" "}
                    <span className={perf.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatPct(perf.returnPct)}
                    </span>
                  </p>
                </>
              )}

              <StatBar segments={segments} className="mt-5" height="h-3" />

              {rebalances.length > 0 && (
                <p className="mt-5 pt-4 border-t border-border/70 text-[11px] text-gray-500 leading-relaxed">
                  최근 리밸런싱 · {rebalances[0].memo}
                </p>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* ─── 자금 흐름 ─── */}
      {perf && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          {/* ⚠ 계좌 숫자가 나오는 자리에는 모의/실계좌를 반드시 밝힌다 */}
          <DataModeNotice mode={basics.dataMode} className="mb-5" compact />

          <SectionHeader
            title="넣은 돈과 불어난 돈"
            subtitle="매달 납입한 원금 위로 평가액이 얼마나 떠 있는지 — 벌어진 폭이 곧 성과입니다."
            action={
              <Link
                href="/portfolio"
                className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
              >
                자세히
                <ChevronRightIcon size={13} />
              </Link>
            }
          />
          <Card>
            <CapitalFlowChart
              snapshots={snapshots}
              rebalances={rebalances.map((r) => ({ date: r.date, memo: r.memo }))}
            />
          </Card>
        </section>
      )}

      {/* ─── 거시 지표 ─── */}
      {/* 계좌(내 기록) 다음에 시장(바깥 환경)을 둔다. 초보자는 "내 돈이 놓인 판이 지금
          어떤가"를 먼저 궁금해하고, 그 답이 여기 있다. 깊이 들어가는 건 /macro가 맡는다. */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <SectionHeader
          title="지금 경제는 어떤 상태인가"
          subtitle="침체 신호 다섯 가지를 종합하고, 지표마다 읽는 법을 붙였습니다."
          action={
            <Link
              href="/macro"
              className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
            >
              지표 전체 보기
              <ChevronRightIcon size={13} />
            </Link>
          }
        />

        <RecessionBoard
          summary={macro.summary}
          signals={macro.signals}
          asOf={macro.asOf}
          compact
        />

        {macro.headlines.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {macro.headlines.map((h) => (
              <Link
                key={h.indicator.key}
                href={`/macro/${h.indicator.group}`}
                className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-gold-600/40 hover:bg-cardHover"
              >
                <p className="text-[11px] text-muted">{h.indicator.name}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-white">{h.display}</p>
                <p className="mt-1 text-[11px] text-gray-600">
                  {h.asOf ? `${h.asOf} 기준` : "수집 전"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ─── 운영 원칙 ─── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <SectionHeader
          title="어떻게 기록하나요"
          subtitle="추천하지 않습니다. 대신 제 판단과 결과를 그대로 둡니다."
        />
        <div className="grid sm:grid-cols-3 gap-4">
          {PRINCIPLES.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className="group bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40"
            >
              <h3 className="text-[15px] font-semibold text-white group-hover:text-gold-400 transition-colors">
                {p.title}
              </h3>
              <p className="mt-2 text-[12.5px] text-muted leading-relaxed">{p.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] text-emerald-400">
                {p.cta}
                <ChevronRightIcon size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── 홈 섹션에 쌓인 글 ─── */}
      {/* 발행할 때마다 여기가 한 편씩 길어진다(features/posts/ui/SectionFrame). */}
      {homePosts.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
          <SectionFrame section="HOME" posts={homePosts} />
        </div>
      )}

      {/* ─── 최신 인사이트 ─── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <SectionHeader
          title="최신 인사이트"
          subtitle="시장이 아니라 원칙을 다룹니다."
          action={
            <Link
              href="/insights"
              className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
            >
              전체 보기
              <ChevronRightIcon size={13} />
            </Link>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestInsights.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>

        {/* 티스토리 유도 — 인사이트를 훑은 직후가 가장 잘 넘어가는 자리 */}
        <TistoryCta
          variant="compact"
          className="mt-4"
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />
      </section>

      {/* ─── 최근 투자일지 + 주목 종목 ─── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 grid lg:grid-cols-2 gap-8">
        <div className="min-w-0">
          <SectionHeader
            title="최근 투자일지"
            action={
              <Link
                href="/journal"
                className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
              >
                전체 기록
                <ChevronRightIcon size={13} />
              </Link>
            }
          />
          <JournalTimeline entries={recentJournal} />
        </div>

        <div className="min-w-0">
          <SectionHeader
            title="주목 종목"
            action={
              <Link
                href="/stocks"
                className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
              >
                종목분석
                <ChevronRightIcon size={13} />
              </Link>
            }
          />
          <div className="grid sm:grid-cols-2 gap-4">
            {featuredStocks.map((s) => (
              <StockCard key={s.ticker} stock={s} />
            ))}
          </div>
        </div>
      </section>

      {/* 광고 — 콘텐츠를 다 훑은 자리. 첫 화면은 광고 없이 콘텐츠로 시작한다. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AdSlot placement="content-bottom" />
      </div>

      {/* 광고·검색 심사에서도 첫 페이지에 고지가 보여야 한다 */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <p className="text-[11px] leading-relaxed text-gray-600">
          ※ Woodsman의 모든 콘텐츠는 개인의 기록이자 정보 제공 목적이며, 투자 권유나 자문이
          아닙니다. 과거의 성과는 미래의 수익을 보장하지 않으며 투자 판단과 그 결과의 책임은
          투자자 본인에게 있습니다.{" "}
          <Link href="/disclaimer" className="text-gray-500 underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
          {" · "}
          <Link href="/privacy" className="text-gray-500 underline hover:text-gold-400">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </>
  );
}
