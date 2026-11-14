"use server";

/**
 * 인사이트 AI 초안 — 만들기 · 편집 저장 · 발행 · 반려(2026-11-14 · v3).
 * ⚠ 발행 조건: 운영자 「Woodsman의 시각」 한 문단(`OPERATOR_NOTE_MIN`자 이상). 공개는 주 2~3편(운영자 결정 · 화면이 이번 주 수를 보인다).
 * ⚠ 발행은 `Post`의 유일한 저장 경로로: body(마크다운) → `renderBody`(변환·정화) → `savePost`.
 * ⚠ 이 파일은 async 함수만 export한다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { runAiTask } from "@/lib/ai/client";
import { loadAiConfig, loadProviderUsage, loadTaskModes, recordAiUsage } from "@/features/ai/repository";
import { resolveApiEnv } from "@/features/ai/credentials";
import { recordAdminLog } from "@/features/admin-log/repository";
import { nextAvailableSlug } from "@/lib/slug";
import { suggestSlug, renderBody, deriveExcerpt } from "@/features/posts/schema";
import { savePost, takenSlugs } from "@/features/posts/repository";
import {
  buildInsightPrompt,
  composeInsightMarkdown,
  INSIGHT_PROMPT_VERSION,
  OPERATOR_NOTE_MIN,
  verifyInsightDraft,
} from "@/lib/insight/draft";
import { findInsightDraft, loadInsightInput, markInsightDraft, saveInsightDraft, saveInsightEdits } from "./draft-repo";

export async function generateInsightDraftAction(): Promise<void> {
  const admin = await requireAdmin("/admin/insight-drafts");
  const input = await loadInsightInput();
  if (input.news.length === 0) {
    await recordAdminLog({ actor: admin.email, action: "insight.draft.skip", summary: "기사 재료가 없어 만들지 않았다" });
    revalidatePath("/admin/insight-drafts");
    return;
  }
  const [usage, config, env, modes] = await Promise.all([loadProviderUsage(), loadAiConfig(), resolveApiEnv(), loadTaskModes()]);
  const prompt = buildInsightPrompt(input);
  const call = (user: string) =>
    runAiTask({
      task: "insight-draft",
      mode: modes["insight-draft"],
      user,
      env,
      usage,
      global: { tokensUsedThisMonth: config.tokensUsedThisMonth, globalMonthlyTokenCap: config.globalMonthlyTokenCap },
      // 2026-11-14: 3,000 → 2,500 — 첫 시도가 「모든 제공자가 실패」(Sonnet 60초 제한 추정). 목표 분량(900~1,600자)에 넉넉하다
      maxTokens: 2_500,
    });

  const first = await call(prompt);
  if (!first.ok) {
    await saveInsightDraft({ input, promptVersion: INSIGHT_PROMPT_VERSION, status: "FAILED", editor: "ai:—", problems: [first.reason, ...first.attempts.map((a) => `${a.providerLabel}(${a.modelId}): ${a.error ?? "실패"}`)] });
  } else {
    await recordAiUsage(first.result.apiKeyEnv, first.result.usage.inputTokens + first.result.usage.outputTokens);
    let verdict = verifyInsightDraft(first.result.text, input);
    let text = first.result.text;
    let editor = `ai:${first.result.modelId}`;
    // 조류 해설과 같이 한 번만 고쳐 쓴다 — 같은 대조
    if (!verdict.ok) {
      const repair = `${prompt}\n\n== 고쳐 쓰기 — 이전 초안이 서버 대조에서 떨어졌습니다 ==\n문제:\n${verdict.problems
        .map((p) => `- ${p}`)
        .join("\n")}\n\n이전 초안:\n${first.result.text.slice(0, 6000)}\n\n위 문제만 고쳐 같은 JSON 형식으로 다시 쓰십시오.`;
      const second = await call(repair);
      if (second.ok) {
        await recordAiUsage(second.result.apiKeyEnv, second.result.usage.inputTokens + second.result.usage.outputTokens);
        verdict = verifyInsightDraft(second.result.text, input);
        text = second.result.text;
        editor = `ai:${second.result.modelId} · 고쳐 씀 1회`;
      }
    }
    await saveInsightDraft({
      input,
      promptVersion: INSIGHT_PROMPT_VERSION,
      status: verdict.ok ? "DRAFT" : "FAILED",
      body: verdict.ok ? verdict.body : undefined,
      editor,
      problems: verdict.ok ? [] : [...verdict.problems, `AI 원문(앞부분): ${text.slice(0, 1500)}`],
    });
  }
  await recordAdminLog({ actor: admin.email, action: "insight.draft.generate", summary: `기사 ${input.news.length} · 블로그 ${input.blogs.length}` });
  revalidatePath("/admin/insight-drafts");
}

function editsFrom(formData: FormData) {
  return {
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    main: String(formData.get("main") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
  };
}

/** 편집 저장(발행하지 않음). */
export async function saveInsightEditsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/insight-drafts");
  const e = editsFrom(formData);
  const ok = await saveInsightEdits(e.id, e);
  await recordAdminLog({ actor: admin.email, action: "insight.draft.edit", target: e.id, summary: ok ? "저장" : "초안이 아니라 저장 안 함" });
  revalidatePath("/admin/insight-drafts");
}

/**
 * 발행 — 편집을 저장하고, 운영자 문단이 있으면 인사이트(Post)로 공개한다.
 * ⚠ 문단이 짧으면 발행하지 않고 저장만 한다(로그에 이유).
 */
export async function publishInsightDraftAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/insight-drafts");
  const e = editsFrom(formData);
  const draft = await findInsightDraft(e.id);
  if (!draft || draft.status !== "DRAFT" || !draft.body) {
    await recordAdminLog({ actor: admin.email, action: "insight.draft.publish-skip", target: e.id, summary: "초안이 아니다" });
    revalidatePath("/admin/insight-drafts");
    return;
  }
  await saveInsightEdits(e.id, e);
  const md = composeInsightMarkdown(draft.body, draft.input, e.note, e.main);
  if (!md || e.note.length < OPERATOR_NOTE_MIN) {
    await recordAdminLog({
      actor: admin.email,
      action: "insight.draft.publish-skip",
      target: e.id,
      summary: `「Woodsman의 시각」이 ${e.note.length}자 — ${OPERATOR_NOTE_MIN}자 이상이어야 발행`,
    });
    revalidatePath("/admin/insight-drafts");
    return;
  }
  const title = e.title || draft.body.title;
  // 한글 제목이면 주소 후보가 비어 나온다 — 날짜 주소로(겹치면 -2, -3)
  const wanted = suggestSlug(title) || `insight-${draft.input.today || new Date().toISOString().slice(0, 10)}`;
  const slug = nextAvailableSlug(wanted, await takenSlugs(wanted));
  const bodyHtml = renderBody(md, "MARKDOWN");
  const postId = await savePost({
    slug,
    type: "INSIGHT",
    section: "INSIGHT",
    title,
    excerpt: deriveExcerpt(undefined, bodyHtml),
    body: md,
    format: "MARKDOWN",
    bodyHtml,
    source: "SELF",
    tags: "AI 초안,운영자 편집",
    commentsEnabled: true,
    published: true,
  });
  await markInsightDraft(e.id, "PUBLISHED", admin.email ?? "(알 수 없음)", postId);
  await recordAdminLog({ actor: admin.email, action: "insight.draft.publish", target: postId, summary: `${title} · /insights/${slug}` });
  for (const p of ["/admin/insight-drafts", "/insights", `/insights/${slug}`, "/", "/sitemap.xml"]) revalidatePath(p);
}

export async function rejectInsightDraftAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/insight-drafts");
  const id = String(formData.get("id") ?? "");
  await markInsightDraft(id, "REJECTED", admin.email ?? "(알 수 없음)");
  await recordAdminLog({ actor: admin.email, action: "insight.draft.reject", target: id });
  revalidatePath("/admin/insight-drafts");
}
