"use server";

/**
 * GCRM 조류 해설 — 초안 만들기 · 승인 · 반려(2026-11-14 · v3).
 *
 * 흐름: 최신 run의 저장값 → 사실표 → AI 초안 → **서버 숫자 대조**(`verifyCommentary`) → DRAFT(통과) 또는 FAILED(사유와 함께).
 * ⚠ 공개는 운영자가 승인한 것만(운영지침 §4 「GCRM 해설 공개 순서」 · 운영자 「b로」). 이 파일은 공개 화면을 바꾸지 않는다.
 * ⚠ 같은 run·같은 프롬프트 판에 살아 있는 초안이 있으면 다시 만들지 않는다(중복 발행 방지). 실패는 다시 시도할 수 있다.
 * ⚠ 이 파일은 async 함수만 export한다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { runAiTask } from "@/lib/ai/client";
import { loadAiConfig, loadProviderUsage, loadTaskModes, recordAiUsage } from "@/features/ai/repository";
import { resolveApiEnv } from "@/features/ai/credentials";
import { recordAdminLog } from "@/features/admin-log/repository";
import { buildCommentaryPrompt, COMMENTARY_PROMPT_VERSION, verifyCommentary } from "@/lib/gcrm/commentary";
import { decideNarrative, liveNarrativeFor, loadCommentaryInput, saveNarrative } from "./commentary-repo";

export async function generateCommentaryAction(): Promise<void> {
  const admin = await requireAdmin("/admin/commentary");
  const input = await loadCommentaryInput().catch((error) => {
    console.error("[gcrm-commentary] 입력을 만들지 못했다", error);
    return undefined;
  });
  if (!input) {
    await recordAdminLog({ actor: admin.email, action: "gcrm.commentary.skip", summary: "GCRM run을 읽지 못해 초안을 만들지 않았다" });
    revalidatePath("/admin/commentary");
    return;
  }
  const live = await liveNarrativeFor(input.runId, COMMENTARY_PROMPT_VERSION);
  if (live) {
    await recordAdminLog({
      actor: admin.email,
      action: "gcrm.commentary.skip",
      target: input.runId,
      summary: `같은 run·프롬프트 판에 ${live.status} 초안이 있어 다시 만들지 않았다`,
    });
    revalidatePath("/admin/commentary");
    return;
  }

  const [usage, config, env, modes] = await Promise.all([loadProviderUsage(), loadAiConfig(), resolveApiEnv(), loadTaskModes()]);
  const run = await runAiTask({
    task: "gcrm-commentary",
    mode: modes["gcrm-commentary"],
    user: buildCommentaryPrompt(input),
    env,
    usage,
    global: { tokensUsedThisMonth: config.tokensUsedThisMonth, globalMonthlyTokenCap: config.globalMonthlyTokenCap },
    maxTokens: 2_000,
  });

  if (!run.ok) {
    await saveNarrative({ input, promptVersion: COMMENTARY_PROMPT_VERSION, status: "FAILED", editor: "ai:—", problems: [run.reason] });
  } else {
    // ⚠ 사용량은 성공했을 때 반드시 센다 — 안 세면 월 상한이 걸리지 않는다.
    await recordAiUsage(run.result.apiKeyEnv, run.result.usage.inputTokens + run.result.usage.outputTokens);
    const verdict = verifyCommentary(run.result.text, input);
    await saveNarrative({
      input,
      promptVersion: COMMENTARY_PROMPT_VERSION,
      status: verdict.ok ? "DRAFT" : "FAILED",
      body: verdict.ok ? verdict.body : undefined,
      editor: `ai:${run.result.modelId}`,
      problems: verdict.ok ? [] : verdict.problems,
    });
  }
  await recordAdminLog({ actor: admin.email, action: "gcrm.commentary.generate", target: input.runId, summary: `기준일 ${input.asOf}` });
  revalidatePath("/admin/commentary");
}

export async function decideCommentaryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/commentary");
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  const ok = await decideNarrative(id, decision, admin.email ?? "(알 수 없음)");
  await recordAdminLog({
    actor: admin.email,
    action: `gcrm.commentary.${decision === "APPROVED" ? "approve" : "reject"}`,
    target: id,
    summary: ok ? decision : "초안이 아니라 바꾸지 않았다",
  });
  revalidatePath("/admin/commentary");
}
