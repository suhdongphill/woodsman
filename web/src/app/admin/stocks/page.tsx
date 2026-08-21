import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { loadReportSummaries } from "@/features/reports/repository";
import { NewReportForm } from "@/features/reports/ui/NewReportForm";
import { classifyQuotaError } from "@/lib/quota";
import { loadLastQuoteIngestAt } from "@/features/stocks/repository";
import { FetchQuotesCard } from "@/features/stocks/ui/FetchQuotesCard";
import { QUOTE_STALE_AFTER_DAYS, quoteAgeDays } from "@/lib/quote/kpi";
import { viewDateKey } from "@/lib/analytics";

export const metadata: Metadata = { title: "종목 보고서" };

/** ⚠ 정적 생성 금지 — 목록은 매번 DB에서 읽어야 한다. */
export const dynamic = "force-dynamic";

/**
 * 종목분석 보고서 목록.
 *
 * ⚠ 섹션 구성·정직성 규율은 `lib/report/catalog.ts`가 원본이다(코드 = 구조, DB = 내용).
 */
export default async function AdminStocksPage() {
  await requireAdmin("/admin/stocks");

  let summaries: Awaited<ReturnType<typeof loadReportSummaries>> | null = null;
  let failure: string | undefined;
  let lastIngestAt: string | undefined;

  try {
    [summaries, lastIngestAt] = await Promise.all([
      loadReportSummaries(),
      loadLastQuoteIngestAt(),
    ]);
  } catch (error) {
    // ⚠ "값이 없음"과 "읽지 못함"을 같은 화면으로 만들지 않는다.
    //    한도 문제면 그렇다고 말해 준다 — 코드 버그와 증상이 똑같아서 구분이 안 된다.
    const verdict = classifyQuotaError(error);
    failure =
      verdict.kind === "no"
        ? "목록을 불러오지 못했습니다. 서버 로그의 [d1] 항목을 확인하세요."
        : `${verdict.title} ${verdict.action}`;
  }

  // ⚠ 판단은 `lib/quote/kpi`가 한다. 화면은 문장만 받는다 — 같은 판단이 두 곳에 생기면
  //    관리자 화면과 보고서가 다른 말을 한다.
  const ingestAgeDays = quoteAgeDays(lastIngestAt?.slice(0, 10), viewDateKey(new Date()));
  const staleNote =
    ingestAgeDays != null && ingestAgeDays > QUOTE_STALE_AFTER_DAYS
      ? `${ingestAgeDays}일 지났습니다. 수집이 멈췄는지 확인하세요.`
      : undefined;

  return (
    <AdminShell>
      <AdminPageHeader
        title="종목 보고서"
        description="13섹션 종목분석 보고서를 쓰고, 정직성 규율을 통과해야 발행합니다."
        action={
          <Link
            href="/admin/diagnostics"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white"
          >
            자가 진단
          </Link>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardTitle>새 보고서</CardTitle>
          <NewReportForm />
        </Card>

        <Card>
          <CardTitle>시세</CardTitle>
          <FetchQuotesCard lastIngestAt={lastIngestAt} staleNote={staleNote} />
        </Card>

        {failure ? (
          <Card className="border-red-500/30 bg-red-500/[0.06]">
            <p className="text-[13px] text-red-200">{failure}</p>
          </Card>
        ) : summaries && summaries.length > 0 ? (
          <Card padding="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted">
                    <th className="px-5 py-3">티커</th>
                    <th className="px-5 py-3">종목</th>
                    <th className="px-5 py-3">상태</th>
                    <th className="px-5 py-3">한 줄 논지</th>
                    <th className="px-5 py-3 whitespace-nowrap">다음 판단</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.ticker} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 font-mono text-gold-400">
                        <Link href={`/admin/stocks/${s.ticker}`} className="hover:underline">
                          {s.ticker}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-200">
                        {s.name}
                        <span className="ml-1.5 text-[10.5px] text-gray-600">
                          {s.market === "KR" ? "한국" : "미국"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            s.status === "PUBLISHED"
                              ? "rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] text-emerald-300"
                              : "rounded-md bg-cardHover px-1.5 py-0.5 text-[10.5px] text-gray-400"
                          }
                        >
                          {s.status === "PUBLISHED" ? `발행 v${s.version}` : "초안"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted max-w-md truncate">{s.headline}</td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap tabular-nums">
                        {s.nextCheckAt ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="아직 보고서가 없습니다"
            description="위에서 초안을 만들면 13섹션 편집 화면이 열립니다."
          />
        )}
      </div>
    </AdminShell>
  );
}
