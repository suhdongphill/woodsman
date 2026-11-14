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
import { buildCommentaryPrompt, buildRepairPrompt, COMMENTARY_PROMPT_VERSION, verifyCommentary } from "@/lib/gcrm/commentary";
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
  const prompt = buildCommentaryPrompt(input);
  const call = (user: string) =>
    runAiTask({
      task: "gcrm-commentary",
      mode: modes["gcrm-commentary"],
      user,
      env,
      usage,
      global: { tokensUsedThisMonth: config.tokensUsedThisMonth, globalMonthlyTokenCap: config.globalMonthlyTokenCap },
      maxTokens: 2_000,
    });

  const first = await call(prompt);
  if (!first.ok) {
    await saveNarrative({ input, promptVersion: COMMENTARY_PROMPT_VERSION, status: "FAILED", editor: "ai:—", problems: [first.reason] });
  } else {
    // ⚠ 사용량은 성공했을 때 반드시 센다 — 안 세면 월 상한이 걸리지 않는다.
    await recordAiUsage(first.result.apiKeyEnv, first.result.usage.inputTokens + first.result.usage.outputTokens);
    let verdict = verifyCommentary(first.result.text, input);
    let text = first.result.text;
    let editor = `ai:${first.result.modelId}`;
    const firstProblems = verdict.ok ? [] : verdict.problems;

    // 한 번만 고쳐 쓴다 — 같은 대조를 다시 지난다(2026-11-14)
    if (!verdict.ok) {
      const second = await call(buildRepairPrompt(prompt, first.result.text, verdict.problems));
      if (second.ok) {
        await recordAiUsage(second.result.apiKeyEnv, second.result.usage.inputTokens + second.result.usage.outputTokens);
        verdict = verifyCommentary(second.result.text, input);
        text = second.result.text;
        editor = `ai:${second.result.modelId} · 고쳐 씀 1회`;
      }
    }

    await saveNarrative({
      input,
      promptVersion: COMMENTARY_PROMPT_VERSION,
      status: verdict.ok ? "DRAFT" : "FAILED",
      body: verdict.ok ? verdict.body : undefined,
      editor,
      problems: verdict.ok
        ? firstProblems.length
          ? [`(첫 시도에서 고친 것) ${firstProblems.join(" · ")}`]
          : []
        : [...verdict.problems, ...(firstProblems.length && editor.includes("고쳐 씀") ? [`(첫 시도) ${firstProblems.join(" · ")}`] : []), `AI 원문(앞부분): ${text.slice(0, 1500)}`],
    });
  }
  await recordAdminLog({ actor: admin.email, action: "gcrm.commentary.generate", target: input.runId, summary: `기준일 ${input.asOf}` });
  revalidatePath("/admin/commentary");
}

export async function decideCommentaryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/commentary");
  const id = String(formData.get("id") ?? "");
  const raw = formData.get("decision");
  /**
   * ⚠ 2026-11-14 사고: 승인·반려를 한 폼의 두 버튼(`name="decision"`)으로 보냈는데 누른 버튼의 값이 오지 않았고,
   *    값이 없으면 REJECTED로 치던 기본값 때문에 **승인을 눌렀는데 반려로 저장됐다.** 이제 폼을 나눠 숨은 값으로 보내고,
   *    값이 둘 중 하나가 아니면 **아무것도 바꾸지 않는다**(결정을 기본값으로 만들지 않는다).
   */
  if (raw !== "APPROVED" && raw !== "REJECTED") {
    console.error("[gcrm-commentary] 결정 값이 없거나 이상하다 — 바꾸지 않는다", raw);
    await recordAdminLog({ actor: admin.email, action: "gcrm.commentary.decide-invalid", target: id, summary: `decision=${String(raw)}` });
    revalidatePath("/admin/commentary");
    return;
  }
  const decision = raw;
  const ok = await decideNarrative(id, decision, admin.email ?? "(알 수 없음)");
  await recordAdminLog({
    actor: admin.email,
    action: `gcrm.commentary.${decision === "APPROVED" ? "approve" : "reject"}`,
    target: id,
    summary: ok ? decision : "초안이 아니라 바꾸지 않았다",
  });
  revalidatePath("/admin/commentary");
}
