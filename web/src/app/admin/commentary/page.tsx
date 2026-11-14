import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { buildFacts, COMMENTARY_PROMPT_VERSION } from "@/lib/gcrm/commentary";
import { loadNarratives } from "@/features/gcrm/commentary-repo";
import { loadResearch } from "@/features/research/repository";
import { decideCommentaryAction, generateCommentaryAction } from "@/features/gcrm/commentary-actions";

export const metadata: Metadata = { title: "조류 해설" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "emerald" | "danger" | "warn" }> = {
  DRAFT: { label: "초안", tone: "neutral" },
  APPROVED: { label: "승인", tone: "emerald" },
  REJECTED: { label: "반려", tone: "warn" },
  FAILED: { label: "대조 실패", tone: "danger" },
};

/**
 * 조류 해설(2026-11-14 · v3) — AI 초안 → 서버 숫자 대조 → 운영자 승인.
 * ⚠ 근거 숫자는 AI 글이 아니라 **저장된 사실표 값**으로 그린다. 공개 화면 연결은 다음 조각(승인된 것 · 최신 run과 같은 것만).
 */
export default async function AdminCommentaryPage() {
  await requireAdmin("/admin/commentary");
  const [rows, research] = await Promise.all([loadNarratives(30), loadResearch().catch(() => [])]);
  const researchById = new Map(research.map((r) => [r.id, r]));

  return (
    <AdminShell>
      <AdminPageHeader
        title="조류 해설"
        description={`GCRM 최신 계산으로 AI가 초안을 쓰고, 서버가 모든 숫자를 사실표와 대조합니다. 통과한 초안만 「초안」이 되고, 운영자가 승인해야 공개 대상이 됩니다(프롬프트 ${COMMENTARY_PROMPT_VERSION}).`}
      />

      <Card className="mb-6">
        <CardTitle>초안 만들기</CardTitle>
        <p className="mt-2 text-[12px] text-muted">
          최신 run에 이미 초안·승인·반려가 있으면 다시 만들지 않습니다(대조 실패는 다시 시도할 수 있습니다). 결과는 아래 목록과 활동 로그에 남습니다.
        </p>
        <form action={generateCommentaryAction} className="mt-3">
          <button type="submit" className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent">
            최신 계산으로 초안 만들기
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">아직 만든 초안이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((n) => {
            const facts = n.facts?.pillars ? new Map(buildFacts(n.facts).map((f) => [f.id, f])) : new Map();
            const st = STATUS[n.status] ?? STATUS.FAILED;
            return (
              <Card key={n.id}>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span>기준일 {n.asOf}</span>
                  <span>· 모델 {n.modelVersion}</span>
                  <span>· 판정 {n.facts?.regimeLabel ?? "자료 없음"}</span>
                  <span>· {n.editor}</span>
                  <span>· 만든 시각 {n.createdAt.slice(0, 16).replace("T", " ")} UTC</span>
                </div>

                {n.body ? (
                  <div className="mt-3 space-y-3 text-[13px] text-ink">
                    <p className="leading-relaxed">{n.body.summary}</p>
                    <div>
                      <p className="text-[11px] text-muted">수치 근거 — 오른쪽 값은 저장된 사실표</p>
                      <ul className="mt-1 space-y-1">
                        {n.body.evidence.map((e, i) => (
                          <li key={i} className="text-[12.5px]">
                            {e.text}
                            <span className="ml-2 text-[11px] text-muted">
                              {e.factIds.map((id) => `${facts.get(id)?.label ?? id}: ${facts.get(id)?.text ?? "?"}`).join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[12.5px] text-muted">{n.body.interpretation}</p>
                    <ul className="list-disc pl-5 text-[12.5px]">
                      {n.body.nextChecks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    {n.body.researchIds.length > 0 && (
                      <ul className="text-[11.5px] text-muted">
                        {n.body.researchIds.map((id) => {
                          const r = researchById.get(id);
                          return (
                            <li key={id}>
                              연구 {id} · {r ? r.title : "(라이브러리에 없음)"}
                              {r?.limit ? ` — 한계: ${r.limit}` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}

                {n.problems.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-[12px] text-red-400">
                    {n.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}

                {n.status === "DRAFT" && (
                  <form action={decideCommentaryAction} className="mt-4 flex gap-2">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      name="decision"
                      value="APPROVED"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                    >
                      승인
                    </button>
                    <button name="decision" value="REJECTED" className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-ink">
                      반려
                    </button>
                  </form>
                )}
                {n.decidedAt && (
                  <p className="mt-2 text-[11px] text-muted">
                    {n.decidedAt.slice(0, 16).replace("T", " ")} UTC · {n.decidedBy}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
