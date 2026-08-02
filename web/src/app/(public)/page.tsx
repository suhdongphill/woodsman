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
import {
  accountSnapshots,
  featuredStocks,
  functionAllocation,
  journalEntries,
  posts,
  rebalances,
  siteConfig,
} from "@/lib/mock";

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

export default function HomePage() {
  const alloc = functionAllocation();
  const segments = [
    { label: "성장", value: alloc.GROWTH, color: FUNCTION_COLOR.GROWTH },
    { label: "인컴", value: alloc.INCOME, color: FUNCTION_COLOR.INCOME },
    { label: "방어", value: alloc.DEFENSE, color: FUNCTION_COLOR.DEFENSE },
  ];
  const perf = summarizePerformance(accountSnapshots);
  const latestInsights = posts.filter((p) => p.type !== "NOTICE").slice(0, 3);
  const recentJournal = journalEntries.filter((e) => e.published).slice(0, 3);

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
                {siteConfig.heroTitle}
              </h1>
              <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">
                {siteConfig.heroSubtitle}
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
                    {journalEntries.length}건
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

              <p className="mt-5 pt-4 border-t border-border/70 text-[11px] text-gray-500 leading-relaxed">
                최근 리밸런싱 · {rebalances[0].memo}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── 자금 흐름 ─── */}
      {perf && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
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
              snapshots={accountSnapshots}
              rebalances={rebalances.map((r) => ({ date: r.date, memo: r.memo }))}
            />
          </Card>
        </section>
      )}

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
        <TistoryCta variant="compact" className="mt-4" />
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
