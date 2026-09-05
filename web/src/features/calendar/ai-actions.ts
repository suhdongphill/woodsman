"use server";

/**
 * AI 일정 초안 — **제안까지만** 하는 서버 액션.
 *
 * ## 왜 두 단계인가 (받기 → 채택)
 * 일정을 사람이 매번 손으로 넣는 한, 캘린더는 결국 비게 된다. 자동 수집이 사람의 기억에
 * 걸려 있어 환율이 열흘 늙었던 것과 같은 자리다(2026-09-01). 그래서 목록은 AI가 가져온다.
 *
 * ⚠ **그러나 AI가 캘린더에 직접 쓰지는 않는다.** 날짜는 이 사이트에서 가장 위험한 값이고,
 *    틀린 날짜는 화면에서 멀쩡해 보인다. 받은 것은 후보로만 뜨고, **채택은 Woodsman이 한다.**
 *    한 번에 전부 채택할 수도 있지만, 그 클릭은 사람의 것이다.
 *
 * ⚠ 검증은 `lib/calendar-draft.ts` 한 곳에서만 한다 — 받을 때와 채택할 때 **같은 함수**를
 *    쓴다. 판단을 두 번 구현하면 두 결과가 갈린다(운영지침 §1).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { seoulDay } from "@/lib/kst";
import { runAiTask } from "@/lib/ai/client";
import { loadAiConfig, loadProviderUsage, recordAiUsage } from "@/features/ai/repository";
import { resolveApiEnv } from "@/features/ai/credentials";
import { recordAdminLog } from "@/features/admin-log/repository";
import { buildDraftPrompt, draftAt, parseDraft } from "@/lib/calendar-draft";
import { createEvent, loadEvents } from "./repository";
import { emptyCalendarDraftState, type CalendarDraftState } from "./draft-state";

function revalidateAll() {
  for (const path of ["/", "/macro", "/macro/calendar", "/calendar.ics", "/admin/calendar"]) {
    revalidatePath(path);
  }
}

/**
 * 초안을 받아 온다. ⚠ **저장하지 않는다.** 화면에 후보로만 돌려준다.
 */
export async function draftEventsAction(
  _prev: CalendarDraftState,
  _formData: FormData,
): Promise<CalendarDraftState> {
  const admin = await requireAdmin("/admin/calendar");

  const today = seoulDay(new Date().toISOString());
  const existing = await loadEvents();

  // ⚠ 키는 보관함(암호화 DB) → env 순서로 온다. process.env만 보면 화면에서 등록한 키가 무시된다.
  const [usage, config, env] = await Promise.all([
    loadProviderUsage(),
    loadAiConfig(),
    resolveApiEnv(),
  ]);

  const run = await runAiTask({
    task: "calendar-draft",
    user: buildDraftPrompt({ today, existing }),
    env,
    usage,
    global: {
      tokensUsedThisMonth: config.tokensUsedThisMonth,
      globalMonthlyTokenCap: config.globalMonthlyTokenCap,
    },
  });

  if (!run.ok) {
    // ⚠ 왜 못 했는지 그대로 보여준다. "키가 없다"와 "모델이 실패했다"는 다른 상태다.
    return { ...emptyCalendarDraftState, error: run.reason, attempts: run.attempts };
  }

  // ⚠ 사용량은 **성공했을 때 반드시** 기록한다. 안 세면 월 상한이 걸리지 않는다.
  await recordAiUsage(
    run.result.apiKeyEnv,
    run.result.usage.inputTokens + run.result.usage.outputTokens,
  );

  const { items, rejected } = parseDraft(run.result.text, { today, existing });

  await recordAdminLog({
    actor: admin.email,
    action: "calendar.draft",
    target: today,
    summary: `${run.result.providerLabel} · 후보 ${items.length}건 · 버림 ${rejected.length}건`,
  });

  return {
    items,
    rejected,
    provider: run.result.providerLabel,
    model: run.result.modelId,
    attempts: run.attempts,
    ranAt: new Date().toISOString(),
  };
}

/**
 * 고른 후보를 캘린더에 넣는다.
 *
 * ⚠ 넘어온 값을 **다시 검증한다.** 화면에서 온 값은 화면이 만든 값이 아닐 수 있다.
 * ⚠ `timeKnown: false` — AI는 시각을 모른다. 화면이 시각을 지운다.
 * ⚠ `source: "AI"` — 사람이 넣은 일정과 구분한다. 나중에 수집기가 덮지 않게 하는 자리다.
 */
export async function adoptDraftsAction(
  _prev: CalendarDraftState,
  formData: FormData,
): Promise<CalendarDraftState> {
  const admin = await requireAdmin("/admin/calendar");

  const rows = formData
    .getAll("pick")
    .map((v) => String(v))
    .filter((v) => v.length > 0);

  if (rows.length === 0) return { error: "채택할 일정을 고르세요." };

  const today = seoulDay(new Date().toISOString());
  const existing = await loadEvents();

  // ⚠ 받을 때와 **같은 검증기**를 쓴다. 여기서만 통하는 규칙을 새로 만들지 않는다.
  const { items, rejected } = parseDraft(`{"events":[${rows.join(",")}]}`, { today, existing });

  let adopted = 0;
  let skipped = rejected.length;

  for (const item of items) {
    try {
      await createEvent({
        at: draftAt(item.day),
        title: item.title,
        kind: item.kind,
        country: item.country,
        importance: item.importance,
        note: item.note || undefined,
        timeKnown: false,
        source: "AI",
        externalId: item.externalId,
      });
      adopted += 1;
    } catch (error) {
      // ⚠ 삼키지 않는다. 같은 일정을 두 번 넣으려 한 경우(고유 제약)도 여기로 온다.
      console.error("[calendar] 초안 채택 실패", error);
      skipped += 1;
    }
  }

  await recordAdminLog({
    actor: admin.email,
    action: "calendar.adopt",
    target: today,
    summary: `채택 ${adopted}건 · 건너뜀 ${skipped}건`,
  });

  revalidateAll();
  return { adopted, skipped, ranAt: new Date().toISOString() };
}
