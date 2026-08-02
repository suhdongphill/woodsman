import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { MockChart } from "@/features/stocks/ui/MockChart";
import { CanslimPanel } from "@/features/ai/ui/CanslimPanel";
import { PostCard } from "@/features/posts/ui/PostCard";
import { ExternalIcon, ChevronRightIcon } from "@/components/icons";
import { cx, formatNumber, formatPct, profitColor } from "@/lib/format";
import { getStock, mockSeries, modelHoldings, posts, stocks } from "@/lib/mock";

type Props = { params: Promise<{ ticker: string }> };

/** 목업 뉴스 (Phase 7에서 서버 라우트로 대체) */
const NEWS = [
  {
    title: "선단 공정 수요 확대…파운드리 가동률 상향",
    source: "Reuters",
    at: "2026-07-30",
    url: "#",
  },
  {
    title: "AI 가속기 출하 전망 상향 조정",
    source: "Bloomberg",
    at: "2026-07-28",
    url: "#",
  },
  {
    title: "분기 실적 컨센서스 상회…가이던스 유지",
    source: "CNBC",
    at: "2026-07-24",
    url: "#",
  },
  {
    title: "설비투자 계획 발표, 캐펙스 사이클 주목",
    source: "WSJ",
    at: "2026-07-19",
    url: "#",
  },
];

const CANSLIM_SCORES: Record<string, Record<string, number>> = {
  TSM: { C: 9, A: 8, N: 9, S: 8, L: 9, I: 8, M: 7 },
  NVDA: { C: 9, A: 9, N: 8, S: 7, L: 9, I: 8, M: 6 },
  DEFAULT: { C: 6, A: 6, N: 5, S: 6, L: 5, I: 6, M: 6 },
};

export async function generateStaticParams() {
  return stocks.map((s) => ({ ticker: s.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const s = getStock(ticker);
  if (!s) return { title: "종목을 찾을 수 없습니다" };
  return {
    title: `${s.name} (${s.ticker})`,
    description: `${s.name} 차트·CANSLIM 점수·최신 뉴스를 한 화면에서 확인합니다.`,
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { ticker } = await params;
  const stock = getStock(ticker);
  if (!stock) notFound();

  const up = stock.changePct >= 0;
  const series = mockSeries(stock.price);
  const scores = CANSLIM_SCORES[stock.ticker] ?? CANSLIM_SCORES.DEFAULT;
  const holding = modelHoldings.find((h) => h.ticker === stock.ticker);
  const related = posts.filter((p) => p.ticker === stock.ticker).slice(0, 2);

  return (
    <>
      <PageHeader
        eyebrow={`${stock.market} · ${stock.ticker}`}
        title={stock.name}
        description={stock.industry}
        action={
          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold text-white tabular-nums">
              {formatNumber(stock.price, stock.currency)}
            </p>
            <p className={cx("text-sm tabular-nums mt-0.5", profitColor(stock.changePct))}>
              {formatPct(stock.changePct)}
            </p>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="space-y-6">
          <MockChart series={series} up={up} />

          {/* 뉴스 */}
          <Card padding="p-0">
            <div className="px-5 pt-5">
              <CardTitle action={<Badge tone="neutral">Yahoo Finance</Badge>}>
                주요 기사
              </CardTitle>
            </div>
            <ul>
              {NEWS.map((n) => (
                <li key={n.title}>
                  <a
                    href={n.url}
                    className="flex items-start gap-3 px-5 py-3.5 border-t border-border hover:bg-cardHover transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-2 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] text-gray-200 leading-snug">
                        {n.title}
                      </span>
                      <span className="block text-[11px] text-gray-600 mt-1">
                        {n.source} · {n.at}
                      </span>
                    </span>
                    <ExternalIcon size={13} className="text-gray-600 mt-1 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <CanslimPanel composite={stock.canslim ?? 0} scores={scores} />

          {/* 대표 포트폴리오 편입 여부 */}
          {holding ? (
            <Card>
              <CardTitle
                action={
                  <Link
                    href="/portfolio"
                    className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
                  >
                    포트폴리오
                    <ChevronRightIcon size={12} />
                  </Link>
                }
              >
                대표 포트폴리오 편입
              </CardTitle>
              <div className="flex items-center gap-3 mb-3">
                <Badge tone={holding.functionType === "GROWTH" ? "emerald" : "gold"}>
                  {holding.functionType === "GROWTH"
                    ? "성장"
                    : holding.functionType === "INCOME"
                      ? "인컴"
                      : "방어"}
                </Badge>
                <span className="text-xs text-muted">목표비중</span>
                <span className="text-sm font-bold text-gold-400 tabular-nums">
                  {holding.targetWeight}%
                </span>
              </div>
              {holding.thesis && (
                <p className="text-[12.5px] text-muted leading-relaxed">{holding.thesis}</p>
              )}
            </Card>
          ) : (
            <Card>
              <CardTitle>대표 포트폴리오 편입</CardTitle>
              <p className="text-[12.5px] text-muted">
                현재 편입되지 않은 관찰 종목입니다.
              </p>
            </Card>
          )}

          {/* 관련 글 */}
          {related.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">이 종목 관련 글</h3>
              <div className="space-y-3">
                {related.map((p) => (
                  <PostCard key={p.id} post={p} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
