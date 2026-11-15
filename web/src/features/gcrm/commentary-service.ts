/**
 * GCRM 조류 해설 초안 만들기 — **관리자 버튼과 06:00 예약 작업이 같이 쓰는 한 경로**(2026-11-15).
 *
 * 왜 뺐나: 11/15 운영자 「자동으로 만들어 주세요」. 초안은 버튼을 눌러야만 생겨서, 승인이 없는 날은
 * 홈 조류 해설이 비었다(홈은 최신 run의 승인 해설만 보인다 — 11/15 홈 HTML로 확인).
 * 버튼과 예약 작업이 각자 다른 코드를 가지면 언젠가 어긋난다 → 한 함수로.
 *
 * 흐름: 최신 run의 저장값 → 사실표 → AI 초안 → **서버 숫자 대조**(`verifyCommentary`) → 한 번 고쳐 쓰기 → DRAFT 또는 FAILED.
 * ⚠ 이 함수는 **공개하지 않는다.** 공개는 운영자 승인뿐이다(운영지침 §4 「조류 AI 해설」 · 「GCRM 해설 공개 순서」).
 * ⚠ 같은 run·같은 프롬프트 판에 살아 있는 초안(DRAFT·APPROVED)이 있으면 다시 만들지 않는다 — 06:00 자동 뒤 버튼을 눌러도 중복되지 않는다.
 * ⚠ 권한 확인은 부르는 쪽이 한다(버튼: requireAdmin · 예약 작업: CRON_SECRET).
 */
import { runAiTask } from "@/lib/ai/client";
import { loadAiConfig, loadProviderUsage, loadTaskModes, recordAiUsage } from "@/features/ai/repository";
import { resolveApiEnv } from "@/features/ai/credentials";
import { recordAdminLog } from "@/features/admin-log/repository";
import { buildCommentaryPrompt, buildRepairPrompt, COMMENTARY_PROMPT_VERSION, verifyCommentary } from "@/lib/gcrm/commentary";
import { liveNarrativeFor, loadCommentaryInput, saveNarrative } from "./commentary-repo";

export type CommentaryOutcome =
  | { outcome: "DRAFT"; runId: string; asOf: string }
  | { outcome: "FAILED"; runId: string; asOf: string; reason: string }
  | { outcome: "SKIP_EXISTING"; runId: string; asOf: string; status: string }
  | { outcome: "SKIP_NO_RUN" };

/** @param actor 관리자 로그에 남길 이름(관리자 이메일 또는 「예약 작업 06:00」) */
export async function generateCommentaryDraft(actor: string): Promise<CommentaryOutcome> {
  const input = await loadCommentaryInput().catch((error) => {
    console.error("[gcrm-commentary] 입력을 만들지 못했다", error);
    return undefined;
  });
  if (!input) {
    await recordAdminLog({ actor, action: "gcrm.commentary.skip", summary: "GCRM run을 읽지 못해 초안을 만들지 않았다" });
    return { outcome: "SKIP_NO_RUN" };
  }
  const live = await liveNarrativeFor(input.runId, COMMENTARY_PROMPT_VERSION);
  if (live) {
    await recordAdminLog({
      actor,
      action: "gcrm.commentary.skip",
      target: input.runId,
      summary: `같은 run·프롬프트 판에 ${live.status} 초안이 있어 다시 만들지 않았다`,
    });
    return { outcome: "SKIP_EXISTING", runId: input.runId, asOf: input.asOf, status: live.status };
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

  let result: CommentaryOutcome;
  const first = await call(prompt);
  if (!first.ok) {
    await saveNarrative({ input, promptVersion: COMMENTARY_PROMPT_VERSION, status: "FAILED", editor: "ai:—", problems: [first.reason, ...first.attempts.map((a) => `${a.providerLabel}(${a.modelId}): ${a.error ?? "실패"}`)] });
    result = { outcome: "FAILED", runId: input.runId, asOf: input.asOf, reason: first.reason };
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
    result = verdict.ok
      ? { outcome: "DRAFT", runId: input.runId, asOf: input.asOf }
      : { outcome: "FAILED", runId: input.runId, asOf: input.asOf, reason: `숫자 대조 실패: ${verdict.problems.slice(0, 2).join(" · ")}` };
  }
  await recordAdminLog({ actor, action: "gcrm.commentary.generate", target: input.runId, summary: `기준일 ${input.asOf} · ${result.outcome}` });
  return result;
}
