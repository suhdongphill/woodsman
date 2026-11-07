import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { BarChartIcon } from "@/components/icons";
import { ReportCard } from "@/features/reports/ui/ReportCard";
import { loadPublishedSummaries } from "@/features/reports/repository";
import { loadPublishedReportFiles } from "@/features/reports/file-repo";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

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
export default async function StocksPage() {
  const [reports, reportFiles] = await Promise.all([loadPublishedSummaries(), loadPublishedReportFiles()]);

  const structured = new Set(reports.map((r) => r.ticker));
  const files = reportFiles.filter((f) => f.hasHtml && !structured.has(f.ticker));

  return (
    <>
      <PageHeader
        eyebrow="STOCKS"
        title="종목분석"
        description="근거·출처·기준일을 갖춘 보고서만 발행합니다. 확인하지 못한 항목은 비운 채 조회처를 적습니다."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6 py-10">
        {/* 섹터 표는 주도주 화면으로 옮겼다(2026-11-07). 찾던 사람이 길을 잃지 않게 잇는다. */}
        <p className="text-[13px] text-muted">
          어느 섹터·어느 종목이 강한지는{" "}
          <Link href="/leaders" className="text-gold-500 hover:text-gold-400">
            주도주 화면 →
          </Link>
        </p>

        {reports.length + files.length === 0 ? (
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
            {files.map((f) => (
              <Link key={f.ticker} href={`/stocks/${encodeURIComponent(f.ticker)}`}>
                <Card className="h-full hover:border-gold-600/40">
                  <p className="text-[15px] font-semibold text-ink">{f.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-500">{f.ticker}</p>
                  <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{f.headline}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
