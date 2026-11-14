import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { HORIZON_LABEL, VERIFY_LABEL, isVerifyStatus, type ResearchHorizon } from "@/lib/research/import";
import { loadResearch, loadResearchBatches, loadResearchImports } from "@/features/research/repository";
import { ResearchImportForm } from "@/features/research/ui/ResearchImportForm";
import { ResearchVerifyForm } from "@/features/research/ui/ResearchVerifyForm";

export const metadata: Metadata = { title: "연구 라이브러리" };
export const dynamic = "force-dynamic";

/**
 * 연구 라이브러리(2026-11-14 · v3) — GCRM 개선 후보의 근거 연구와 검증 기록.
 * ⚠ 관리자 전용. 여기서 운영 점수·가중치·임계값을 바꾸는 경로는 없다 — 연구는 「후보」이고, 운영 반영은 검증 보고 뒤 별도 승인이다.
 * ⚠ 배치 기록·가져오기 이력(baseline·notes)은 비공개 검토 기록이다. 공개 화면에 옮기지 않는다.
 */
export default async function AdminResearchPage() {
  await requireAdmin("/admin/research");
  const [papers, batches, imports] = await Promise.all([loadResearch(), loadResearchBatches(), loadResearchImports(5)]);

  const byStatus = new Map<string, number>();
  for (const p of papers) byStatus.set(p.verifyStatus, (byStatus.get(p.verifyStatus) ?? 0) + 1);

  return (
    <AdminShell>
      <AdminPageHeader
        title="연구 라이브러리"
        description="GCRM 개선 후보의 근거 연구입니다. 가져온 연구는 모두 「검증 후보」로 시작하고, 원문 확인·재현·백테스트는 근거 메모와 함께 여기서 기록합니다. 운영 모델은 바뀌지 않습니다."
      />

      <Card className="mb-6">
        <CardTitle>가져오기</CardTitle>
        <p className="mt-2 text-[12px] text-muted">
          같은 파일을 다시 올려도 중복이 생기지 않습니다. 원문 칸은 고쳐지고 검증 상태는 그대로 남습니다.
        </p>
        <div className="mt-4">
          <ResearchImportForm />
        </div>
        {imports.length > 0 && (
          <ul className="mt-4 space-y-1 text-[11.5px] text-muted">
            {imports.map((i) => (
              <li key={i.id}>
                {i.at.slice(0, 16).replace("T", " ")} UTC · {i.fileName} · 새로 {i.inserted} · 고침 {i.updated} · 그대로{" "}
                {i.unchanged} · 확인 필요 {i.conflicts}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <CardTitle>
          연구 {papers.length}편{" "}
          <span className="text-[12px] font-normal text-muted">
            {[...byStatus.entries()]
              .map(([s, n]) => `${isVerifyStatus(s) ? VERIFY_LABEL[s] : s} ${n}`)
              .join(" · ")}
          </span>
        </CardTitle>
        {papers.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">아직 가져온 연구가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {papers.map((p) => (
              <li key={p.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.verifyStatus === "CANDIDATE" ? "neutral" : p.verifyStatus === "REJECTED" ? "danger" : "emerald"}>
                    {isVerifyStatus(p.verifyStatus) ? VERIFY_LABEL[p.verifyStatus] : p.verifyStatus}
                  </Badge>
                  <Badge tone="info">{HORIZON_LABEL[p.horizon as ResearchHorizon] ?? p.horizon}</Badge>
                  <span className="text-[11.5px] text-muted">
                    {p.source} · 발행 {p.date} · 등록 {p.registeredAt.slice(0, 10)} · <span className="font-mono">{p.id}</span>
                  </span>
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-[14px] font-semibold text-ink hover:text-gold-500"
                >
                  {p.title}
                </a>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-[7rem_1fr]">
                  {(
                    [
                      ["사실", p.fact],
                      ["방법", p.method],
                      ["한계", p.limit],
                      ["해석", p.interpret],
                      ["가설", p.hypothesis],
                      ["연결 대상", p.mapping],
                      ["검증 후보", p.candidate],
                      ["검증 방법", p.test],
                      ["반론", p.counter],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted">{k}</dt>
                        <dd className="text-ink">{v}</dd>
                      </div>
                    ))}
                </dl>
                {p.verifyNote && (
                  <p className="mt-2 text-[11.5px] text-muted">
                    마지막 기록 {p.verifyAt?.slice(0, 10)} — {p.verifyNote}
                  </p>
                )}
                <ResearchVerifyForm id={p.id} status={p.verifyStatus} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {batches.length > 0 && (
        <Card>
          <CardTitle>탐색 배치 기록 (비공개)</CardTitle>
          <ul className="mt-3 space-y-3 text-[12px]">
            {batches.map((b) => (
              <li key={b.id}>
                <p className="text-muted">
                  {b.date} · {b.cadence ?? "—"} · <span className="font-mono">{b.id}</span>
                </p>
                {b.summary && <p className="mt-1 text-ink">{b.summary}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminShell>
  );
}
