import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { CanslimPanel } from "@/features/ai/ui/CanslimPanel";
import { ReportView } from "@/features/reports/ui/ReportView";
import { PostCard } from "@/features/posts/ui/PostCard";
import { ChevronRightIcon } from "@/components/icons";
import { scoreCanslim } from "@/lib/canslim/score";
import { outboundStockHref } from "@/lib/outbound";
import { loadPublishedReport } from "@/features/reports/repository";
import { loadContext } from "@/features/reports/context-repo";
import { SiteContextCard } from "@/features/reports/ui/SiteContextCard";
import { loadPublishedPosts } from "@/features/posts/repository";
import { findPublishedHoldingByTicker } from "@/features/portfolio/repository";

type Props = { params: Promise<{ ticker: string }> };

/**
 * 종목분석 보고서 (공개).
 *
 * ## ⚠ 2026-08-15: 목업을 전부 걷어냈다
 * 이 화면은 `lib/mock`의 **지어낸 시세**(AAPL 232.6 같은)와 결정적 파형으로 만든 가짜 차트,
 * 근거 없는 CANSLIM 예시 점수를 실제 분석처럼 보여주고 있었다. 숫자를 공개해 신뢰를 얻는
 * 사이트에서 가장 크게 깨지는 지점이라(운영지침 §5) 통째로 지웠다.
 *
 * ⚠ 이제 **발행된 보고서(PUBLISHED)만** 이 경로에 존재한다. 보고서가 없으면 404다 —
 *    빈 껍데기 화면을 만들어 두면 검색엔진에 내용 없는 페이지가 색인된다.
 * ⚠ 차트는 없다. 시세 실데이터가 붙는 단계에서 더한다. **없는 것을 그리지 않는다.**
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const report = await loadPublishedReport(ticker);
  if (!report) return { title: "보고서를 찾을 수 없습니다" };

  return {
    title: `${report.name} (${report.ticker}) 종목분석`,
    description: report.headline,
  };
}

export default async function StockReportPage({ params }: Props) {
  const { ticker } = await params;
  const report = await loadPublishedReport(ticker);
  if (!report) notFound();

  const canslim = scoreCanslim(report.readings);
  // ⚠ 얼려 둔 스냅숏이다. 오늘 값으로 갱신하지 않는다 — 본문의 논지가 참조한 숫자다.
  const snapshot = await loadContext(report.ticker);
  const holding = await findPublishedHoldingByTicker(report.ticker);
  const related = (await loadPublishedPosts(50))
    .filter((p) => p.ticker === report.ticker)
    .slice(0, 2);

  return (
    <>
      <PageHeader
        eyebrow={`${report.market === "KR" ? "한국" : "미국"} · ${report.ticker}${
          report.industry ? ` · ${report.industry}` : ""
        }`}
        title={report.name}
        description={report.headline}
        action={
          <div className="text-left sm:text-right">
            <p className="text-[11px] text-muted">보고서 버전</p>
            <p className="text-sm font-mono text-gold-400">v{report.version}</p>
            {report.publishedAt && (
              <p className="text-[11px] text-gray-600 tabular-nums mt-0.5">
                {report.publishedAt.slice(0, 10)} 발행
              </p>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <ReportView report={report} />

        <div className="space-y-6 lg:sticky lg:top-6">
          {/* ⚠ 티스토리 CTA를 **맨 위**에 둔다. 1순위 목적은 블로그로 보내는 것이고(운영지침 §5),
              자리 경쟁이 붙으면 티스토리가 이긴다. 경유(/go)로 보내 클릭을 센다. */}
          {report.tistoryUrl && (
            <a
              href={outboundStockHref(report.ticker)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-gold-600/40 bg-gold-500/10 p-4 transition-colors hover:bg-gold-500/15"
            >
              <p className="text-[11px] text-gold-400/80">블로그 원문</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gold-300">
                티스토리에서 이 보고서 읽기
                <ChevronRightIcon size={14} />
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                같은 분석을 블로그에도 실었습니다. 댓글과 구독은 그쪽에서 받습니다.
              </p>
            </a>
          )}

          <CanslimPanel score={canslim} />

          {/* 작성 시점 사이트 자료 — ⚠ 주입한 보고서에만 나온다. 없으면 카드를 만들지 않는다 */}
          {snapshot && <SiteContextCard snapshot={snapshot} />}

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
              <p className="text-[12.5px] text-muted">현재 편입되지 않은 관찰 종목입니다.</p>
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
