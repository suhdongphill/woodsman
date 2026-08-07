import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { MockChart } from "@/features/stocks/ui/MockChart";
import { CanslimPanel } from "@/features/ai/ui/CanslimPanel";
import { PostCard } from "@/features/posts/ui/PostCard";
import { ChevronRightIcon } from "@/components/icons";
import { cx, formatNumber, formatPct, profitColor } from "@/lib/format";
import { getStock, mockSeries } from "@/lib/mock";
import { loadPublishedPosts } from "@/features/posts/repository";
import { findPublishedHoldingByTicker } from "@/features/portfolio/repository";

type Props = { params: Promise<{ ticker: string }> };

/* 목업 뉴스는 삭제했다(2026-08-07 점검).
   Reuters·Bloomberg·CNBC·WSJ 이름을 달고 실재하지 않는 기사를 보여주고 있었고,
   링크는 전부 href="#"이라 아무 데도 가지 않았다. 숫자를 공개해 신뢰를 얻는 사이트에서
   실재 언론사 이름을 붙인 가짜 기사는 가장 크게 깨는 지점이다(운영지침 5장).
   ⚠ 실제 뉴스 출처가 붙기 전까지 되살리지 말 것. */
const CANSLIM_SCORES: Record<string, Record<string, number>> = {
  TSM: { C: 9, A: 8, N: 9, S: 8, L: 9, I: 8, M: 7 },
  NVDA: { C: 9, A: 9, N: 8, S: 7, L: 9, I: 8, M: 6 },
  DEFAULT: { C: 6, A: 6, N: 5, S: 6, L: 5, I: 6, M: 6 },
};

/**
 * ⚠ 정적 생성 금지 — 이 화면은 대표 포트폴리오(DB)를 읽는다.
 *    `generateStaticParams`로 굳혀 두면 종목을 편입·제외해도 "편입 안 됨"이 그대로 남는다.
 *    (차트·뉴스·시세는 아직 목업이다. 실데이터 연결은 P6/P7.)
 */
export const dynamic = "force-dynamic";

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
  const holding = await findPublishedHoldingByTicker(stock.ticker);
  const related = (await loadPublishedPosts(50))
    .filter((p) => p.ticker === stock.ticker)
    .slice(0, 2);

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
                  {holding.targetWeight != null ? `${holding.targetWeight}%` : "—"}
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
