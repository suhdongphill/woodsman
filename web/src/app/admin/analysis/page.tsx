import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { loadRecentAnalyses } from "@/features/analysis/repository";
import { AnalysisForm } from "@/features/analysis/ui/AnalysisForm";

export const metadata: Metadata = { title: "그날의 분석" };

/** ⚠ 정적 생성 금지 — 저장해도 목록이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 그날의 분석 — 홈 유동성 카드 해석 팝업의 2부(통합 계획 S4).
 *
 * ⚠ 운영자 결정(2026-09-14): 점수는 **우리 계산**으로 낸다. 외부 보고서(예: ChatGPT Global Capital Regime Monitor)에서는
 *   출처 있는 사실과 해석만 싣고, 산식 없는 점수 · Confidence %는 뺀다 — 저장 전에 점검하고 걸린 줄을 보여 준다.
 */
export default async function AdminAnalysisPage() {
  await requireAdmin("/admin/analysis");
  const recent = await loadRecentAnalyses(14);
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

  return (
    <AdminShell>
      <AdminPageHeader
        title="그날의 분석"
        description="홈 유동성 카드의 해석 팝업에 나가는 분석입니다. 점수는 사이트가 계산하고, 여기에는 출처 있는 사실과 해석만 붙여넣습니다."
      />

      <Card className="mb-6">
        <CardTitle>분석 붙여넣기</CardTitle>
        <AnalysisForm today={today} />
      </Card>

      <Card>
        <CardTitle>최근 분석 {recent.length}건</CardTitle>
        {recent.length === 0 ? (
          <p className="text-[12.5px] text-muted">아직 저장한 분석이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((a) => (
              <li key={a.date} className="py-2.5 text-[12.5px]">
                <span className="tabular-nums text-ink-3">{a.date}</span>
                <span className="ml-3 text-ink">{a.oneLine}</span>
                <span className="ml-2 text-[11px] text-ink-3">· {a.sourceLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}
