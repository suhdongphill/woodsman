import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { seoulDay, seoulTime } from "@/lib/kst";
import { draftMainMarkdown, INSIGHT_PROMPT_VERSION, OPERATOR_NOTE_MIN } from "@/lib/insight/draft";
import { countPublishedSince, loadInsightDrafts } from "@/features/insight/draft-repo";
import {
  generateInsightDraftAction,
  publishInsightDraftAction,
  rejectInsightDraftAction,
  saveInsightEditsAction,
} from "@/features/insight/draft-actions";

export const metadata: Metadata = { title: "인사이트 초안" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "emerald" | "danger" | "warn" }> = {
  DRAFT: { label: "초안", tone: "neutral" },
  PUBLISHED: { label: "발행", tone: "emerald" },
  REJECTED: { label: "반려", tone: "warn" },
  FAILED: { label: "대조 실패", tone: "danger" },
};

/** 이번 주 월요일 00:00 KST(UTC ISO) */
function mondayKstIso(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const day = (kst.getUTCDay() + 6) % 7; // 월=0
  const monday = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day) - 9 * 3600_000;
  return new Date(monday).toISOString();
}

/**
 * 인사이트 초안(2026-11-14 · v3) — 재료(파도 기사 · 최근 블로그 · 브리핑 · 조류)로 AI가 초안 → 서버 대조 → 운영자가 고치고
 * 「Woodsman의 시각」 한 문단을 보태 발행. ⚠ 운영자 결정: 공개는 주 2~3편 · 문단 없이는 발행되지 않는다.
 */
export default async function AdminInsightDraftsPage() {
  await requireAdmin("/admin/insight-drafts");
  const [rows, thisWeek] = await Promise.all([loadInsightDrafts(20), countPublishedSince(mondayKstIso())]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="인사이트 초안"
        description={`파도 기사 · 최근 블로그 · 브리핑 · 조류 점수로 AI가 초안을 쓰고, 서버가 숫자·날짜·링크를 재료와 대조합니다. 고친 뒤 「Woodsman의 시각」(${OPERATOR_NOTE_MIN}자 이상)을 적어야 발행됩니다(프롬프트 ${INSIGHT_PROMPT_VERSION}).`}
      />

      <Card className="mb-6">
        <CardTitle>
          초안 만들기 <span className="text-[12px] font-normal text-muted">· 이번 주 발행 {thisWeek}편(목표 2~3편)</span>
        </CardTitle>
        <form action={generateInsightDraftAction} className="mt-3">
          <button type="submit" className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent">
            오늘 재료로 초안 만들기
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">아직 만든 초안이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => {
            const st = STATUS[d.status] ?? STATUS.FAILED;
            return (
              <Card key={d.id}>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span>{seoulDay(d.createdAt)} {seoulTime(d.createdAt)} KST</span>
                  <span>· {d.editor}</span>
                  <span>
                    · 재료 기사 {d.input.news.length} · 블로그 {d.input.blogs.length}
                    {d.input.briefing ? ` · 브리핑 ${d.input.briefing.date}` : ""} · 조류 사실 {d.input.facts.length}
                  </span>
                  {d.postId && <span>· 발행됨</span>}
                </div>

                {d.body && d.status === "DRAFT" && (
                  <form className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={d.id} />
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-muted">제목</span>
                      <input
                        name="title"
                        defaultValue={d.editedTitle ?? d.body.title}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-muted">본문(마크다운 · 고쳐도 됩니다)</span>
                      <textarea
                        name="main"
                        rows={16}
                        defaultValue={d.editedMain ?? draftMainMarkdown(d.body)}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-muted">
                        Woodsman의 시각 — 운영자 한 문단({OPERATOR_NOTE_MIN}자 이상 · 없으면 발행되지 않습니다)
                      </span>
                      <textarea
                        name="note"
                        rows={5}
                        defaultValue={d.operatorNote ?? ""}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink"
                      />
                    </label>
                    <p className="text-[11px] text-muted">
                      발행하면 끝에 「참고한 자료」(기사 원문 · 블로그는 /go 경유 · 브리핑)와 「AI 초안 · 운영자 편집」 고지가 붙습니다.
                      불러온 기사 {d.body.newsIds.length} · 블로그 {d.body.blogIds.length}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        formAction={saveInsightEditsAction}
                        className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-ink"
                      >
                        저장만
                      </button>
                      <button
                        type="submit"
                        formAction={publishInsightDraftAction}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                      >
                        저장하고 발행
                      </button>
                    </div>
                  </form>
                )}
                {d.body && d.status === "DRAFT" && (
                  <form action={rejectInsightDraftAction} className="mt-2">
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="text-[11.5px] text-muted underline">
                      반려
                    </button>
                  </form>
                )}
                {d.body && d.status !== "DRAFT" && <p className="mt-2 text-[13px] font-semibold text-ink">{d.editedTitle ?? d.body.title}</p>}

                {d.problems.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-[12px] text-red-400">
                    {d.problems.map((p) => (
                      <li key={p} className="whitespace-pre-wrap break-words">
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
