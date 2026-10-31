"use server";

/**
 * 오늘의 브리핑 — 올리기(규칙 정리 → AI 다듬기 → 초안) · 공개 · 내리기 · 지우기.
 *
 * ## 왜 세 단계인가 (운영자 10/31 「관리자 화면에서 올리면 AI로 재편집해서 등록」)
 * 1. **규칙**(`lib/briefing/article.ts`) — SNS 출처·채널 평가·내부 칸을 지운다. 매번 같은 결과.
 * 2. **AI**(`lib/briefing/rewrite.ts`) — 문장만 기사체로. 숫자가 바뀐 문장은 원문으로 되돌린다.
 * 3. **사람** — 초안 미리보기를 보고 「공개」를 누른다. ⚠ AI 결과가 바로 나가지 않는다.
 *
 * ⚠ AI를 못 쓰면(키 없음·상한·실패) **규칙 정리본으로 초안을 만들고 그 이유를 화면에 말한다** — 조용히 넘어가지 않는다.
 * ⚠ 이 파일은 async 함수만 export한다(상태 타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { runAiTask } from "@/lib/ai/client";
import { loadAiConfig, loadProviderUsage, loadTaskModes, recordAiUsage } from "@/features/ai/repository";
import { resolveApiEnv } from "@/features/ai/credentials";
import { recordAdminLog } from "@/features/admin-log/repository";
import {
  articleProblems,
  briefingHtmlToMarkdown,
  dateFromFileName,
  parseBriefingMarkdown,
} from "@/lib/briefing/article";
import { applyRewrite, buildRewritePrompt, editableItems, parseRewriteResponse } from "@/lib/briefing/rewrite";
import { deleteBriefing, saveBriefingDraft, setBriefingStatus } from "./repository";
import type { BriefingUploadState } from "./form-state";

/** 원고 크기 상한 — 정기분이 14KB(md)·46KB(html)다. 넉넉히 잡되 끝없이 받지는 않는다. */
const MAX_BYTES = 512 * 1024;

function revalidateAll(date?: string) {
  for (const path of ["/briefing", "/admin/briefing", "/sitemap.xml"]) revalidatePath(path);
  if (date) {
    revalidatePath(`/briefing/${date}`);
    revalidatePath(`/admin/briefing/${date}`);
  }
}

export async function uploadBriefingAction(
  _prev: BriefingUploadState,
  formData: FormData,
): Promise<BriefingUploadState> {
  const admin = await requireAdmin("/admin/briefing");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "원고 파일(.md 또는 .html)을 고르세요." };
  if (file.size > MAX_BYTES) return { error: `파일이 너무 큽니다(${Math.round(file.size / 1024)}KB · 상한 512KB).` };

  const raw = await file.text();
  const isHtml = /\.html?$/i.test(file.name) || /^\s*<(!doctype|html|body|p|div)/i.test(raw);
  const dateField = String(formData.get("date") ?? "").trim();
  const date = dateField || dateFromFileName(file.name);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "날짜를 알 수 없습니다. 파일 이름을 2026-10-31.md 꼴로 하거나 날짜 칸을 채우세요." };
  }

  // 1. 규칙 정리
  const ruled = parseBriefingMarkdown(isHtml ? briefingHtmlToMarkdown(raw) : raw, date);
  const ruleProblems = articleProblems(ruled);
  if (ruleProblems.length) return { error: `원고를 기사로 옮기지 못했습니다 — ${ruleProblems.join(" · ")}` };

  // 2. AI 다듬기(선택)
  let article = ruled;
  let editor = "rules";
  let accepted = 0;
  let rejected: BriefingUploadState["rejected"] = [];
  let aiSkipped: string | undefined;

  if (formData.get("useAi") === "on") {
    const [usage, config, env, modes] = await Promise.all([
      loadProviderUsage(),
      loadAiConfig(),
      resolveApiEnv(),
      loadTaskModes(),
    ]);
    const run = await runAiTask({
      task: "briefing-edit",
      mode: modes["briefing-edit"],
      user: buildRewritePrompt(editableItems(ruled)),
      env,
      usage,
      global: {
        tokensUsedThisMonth: config.tokensUsedThisMonth,
        globalMonthlyTokenCap: config.globalMonthlyTokenCap,
      },
      maxTokens: 12_000,
    });
    if (!run.ok) {
      aiSkipped = run.reason;
    } else {
      // ⚠ 사용량은 성공했을 때 반드시 센다 — 안 세면 월 상한이 걸리지 않는다.
      await recordAiUsage(run.result.apiKeyEnv, run.result.usage.inputTokens + run.result.usage.outputTokens);
      const edits = parseRewriteResponse(run.result.text);
      if (!edits) {
        aiSkipped = `${run.result.providerLabel} 답을 JSON으로 읽지 못했습니다 — 규칙 정리본으로 저장했습니다.`;
      } else {
        const applied = applyRewrite(ruled, edits);
        // ⚠ 다듬은 뒤에도 같은 관문을 지난다.
        if (articleProblems(applied.article).length === 0) {
          article = applied.article;
          editor = `ai:${run.result.modelId}`;
          accepted = applied.accepted;
          rejected = applied.rejected;
        } else {
          aiSkipped = "다듬은 글이 관문(SNS·빈 제목)을 통과하지 못해 규칙 정리본으로 저장했습니다.";
        }
      }
    }
  }

  await saveBriefingDraft({ article, editor, editNote: rejected ?? [], sourceName: file.name });
  await recordAdminLog({
    actor: admin.email,
    action: "briefing.upload",
    target: date,
    summary: `${file.name} · ${editor}${editor !== "rules" ? ` · 다듬음 ${accepted} · 되돌림 ${rejected?.length ?? 0}` : ""}${aiSkipped ? ` · AI 건너뜀: ${aiSkipped.slice(0, 80)}` : ""}`,
  });
  revalidateAll(date);

  return { savedDate: date, editor, accepted, rejected, aiSkipped };
}

function dateOf(formData: FormData): string | null {
  const d = String(formData.get("date") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export async function publishBriefingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/briefing");
  const date = dateOf(formData);
  if (!date) return;
  await setBriefingStatus(date, "PUBLISHED");
  await recordAdminLog({ actor: admin.email, action: "briefing.publish", target: date });
  revalidateAll(date);
}

export async function unpublishBriefingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/briefing");
  const date = dateOf(formData);
  if (!date) return;
  await setBriefingStatus(date, "DRAFT");
  await recordAdminLog({ actor: admin.email, action: "briefing.unpublish", target: date });
  revalidateAll(date);
}

export async function deleteBriefingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/briefing");
  const date = dateOf(formData);
  if (!date) return;
  await deleteBriefing(date);
  await recordAdminLog({ actor: admin.email, action: "briefing.delete", target: date });
  revalidateAll(date);
}
