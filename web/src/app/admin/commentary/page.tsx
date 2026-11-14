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
        description={`GCRM 최신 계산으로 AI가 브리핑 초안(판정 · 본문 · 단서 · 다시 볼 조건 · 카드)을 쓰고, 서버가 모든 숫자를 사실표와 대조합니다. ⚠ 점수 방향(높을수록 좋은지)이 맞는지는 서버가 못 잡습니다 — 승인 전에 꼭 봐 주세요. 통과한 초안만 「초안」이 되고, 운영자가 승인해야 공개 대상이 됩니다(프롬프트 ${COMMENTARY_PROMPT_VERSION}).`}
      />

      <Card className="mb-6">
        <CardTitle>초안 만들기</CardTitle>
        <p className="mt-2 text-[12px] text-muted">
          최신 계산에 초안이나 승인된 해설이 있으면 다시 만들지 않습니다. 반려했거나 대조에 실패했으면 다시 만들 수 있습니다. 결과는 아래 목록과 활동 로그에 남습니다.
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

                {n.body?.paragraphs ? (
                  <div className="mt-3 space-y-3 text-[13px] text-ink">
                    <p className="text-[14px] font-semibold">{n.body.verdict}</p>
                    {n.body.paragraphs.map((p, i) => (
                      <p key={i} className="leading-relaxed">
                        {p}
                      </p>
                    ))}
                    <div>
                      <p className="text-[11px] font-semibold text-muted">단서</p>
                      <p className="leading-relaxed text-[12.5px]">{n.body.caveat}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted">이렇게 되면 다시 봅니다</p>
                      <ul className="list-disc pl-5 text-[12.5px]">
                        {n.body.triggers.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-[11.5px] text-muted">근거 숫자 — 저장된 사실표 값</summary>
                      <ul className="mt-1 space-y-0.5 text-[12px]">
                        {n.body.evidenceFactIds.map((id) => (
                          <li key={id}>
                            {facts.get(id)?.label ?? id}: <span className="text-ink">{facts.get(id)?.text ?? "?"}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="rounded-lg border border-border bg-bg px-3 py-2">
                      <p className="text-[11px] text-muted">카드(홈용)</p>
                      <p className="text-[12.5px]">{n.body.card}</p>
                    </div>
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
                ) : n.body ? (
                  // v1 판(gcrm-commentary-v1) 초안 — 모양이 달라 요약·다음 확인만 보인다. ⚠ v2부터 공개 대상
                  <div className="mt-3 space-y-2 text-[13px] text-ink">
                    <p className="text-[11px] text-muted">이전 판({n.promptVersion}) — 요약만 표시</p>
                    <p className="leading-relaxed">{(n.body as unknown as { summary?: string }).summary}</p>
                    <ul className="list-disc pl-5 text-[12.5px]">
                      {((n.body as unknown as { nextChecks?: string[] }).nextChecks ?? []).map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {n.problems.length > 0 && (
                  <ul className={`mt-3 list-disc pl-5 text-[12px] ${n.status === "FAILED" ? "text-red-400" : "text-muted"}`}>
                    {n.problems.map((p) => (
                      <li key={p} className="whitespace-pre-wrap break-words">
                        {p}
                      </li>
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
