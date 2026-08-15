import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { viewDateKey } from "@/lib/analytics";
import { publishBlockers, validateReport } from "@/lib/report/rules";
import { scoreCanslim, canslimCoverageNotice, missingAxes } from "@/lib/canslim/score";
import { loadReport } from "@/features/reports/repository";
import { ReportEditor } from "@/features/reports/ui/ReportEditor";
import { RuleReport } from "@/features/reports/ui/RuleReport";
import { PublishBar } from "@/features/reports/ui/PublishBar";

type Props = { params: Promise<{ ticker: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `보고서 편집 · ${ticker}` };
}

/**
 * 보고서 편집.
 *
 * ⚠ **규율 검증 결과를 편집 화면과 같은 페이지에** 둔다. 발행 버튼을 눌러야 알게 되면
 *    무엇을 고쳐야 하는지 모른 채 왔다 갔다 하게 된다.
 * ⚠ 검증은 **저장된 내용** 기준이다. 화면의 입력값이 아니라 DB에 들어간 것을 판정한다 —
 *    발행되는 것이 그것이기 때문이다.
 */
export default async function AdminStockReportPage({ params }: Props) {
  const { ticker } = await params;
  await requireAdmin(`/admin/stocks/${ticker}`);

  const report = await loadReport(ticker);
  if (!report) notFound();

  const problems = validateReport(report, viewDateKey(new Date()));
  const blockers = publishBlockers(problems);
  const canslim = scoreCanslim(report.readings);

  return (
    <AdminShell>
      <AdminPageHeader
        title={`${report.name} (${report.ticker})`}
        description={report.headline || "한 줄 논지를 아직 적지 않았습니다."}
        action={
          <Link
            href="/admin/stocks"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white"
          >
            목록
          </Link>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardTitle
            action={
              report.status === "PUBLISHED" ? (
                <Link
                  href={`/stocks/${report.ticker}`}
                  className="text-[11px] text-gold-400 hover:text-gold-500"
                >
                  공개 화면 보기
                </Link>
              ) : undefined
            }
          >
            발행 전 규율 검증
          </CardTitle>

          <div className="space-y-4">
            <PublishBar
              ticker={report.ticker}
              status={report.status}
              blockerCount={blockers.length}
            />
            <RuleReport problems={problems} />
          </div>
        </Card>

        <Card>
          <CardTitle>CANSLIM 현재 점수</CardTitle>
          <div className="space-y-1.5 text-[12.5px]">
            {canslim.composite10 === undefined ? (
              <p className="text-gray-500">
                아직 채점한 축이 없습니다. ⚠ 0점으로 표시하지 않습니다 — 0은 &lsquo;저조&rsquo;로 읽힙니다.
              </p>
            ) : (
              <p className="text-gray-200">
                종합 {canslim.composite10.toFixed(1)} / 10 ({canslim.composite100?.toFixed(0)}점) —{" "}
                {canslim.band?.grade} · {canslim.band?.action}
              </p>
            )}
            {canslim.gate.state !== "clear" && (
              <p className={canslim.gate.state === "hold" ? "text-amber-400" : "text-gray-500"}>
                {canslim.gate.text}
              </p>
            )}
            <p className="text-gray-600">{canslimCoverageNotice(canslim.coverage)}</p>
            {missingAxes(canslim).length > 0 && (
              <p className="text-gray-600">
                채점 안 된 축:{" "}
                {missingAxes(canslim)
                  .map((m) => `${m.key}(${m.why === "na" ? "N/A" : m.why === "missing" ? "미입력" : "범위 밖"})`)
                  .join(" · ")}
              </p>
            )}
          </div>
        </Card>

        <ReportEditor draft={report} readings={report.readings} />
      </div>
    </AdminShell>
  );
}
