"use server";

/**
 * AI 지표값 추출 — **읽어 오게 하고, 사람이 저장한다.**
 *
 * ## 흐름
 *   관리자가 지표와 출처 URL을 고른다
 *     → ⚠ **서버가** 그 페이지를 받아 온다(모델이 URL을 고르지 않는다)
 *     → 본문 텍스트만 모델에 준다(`lib/indicator-extract.ts`)
 *     → ⚠ 모델이 낸 인용문을 **원문과 대조**한다. 없으면 버린다
 *     → 화면에 후보로 띄운다
 *     → **Woodsman이 「이 값으로 저장」을 누르면** `MacroPoint`에 `source: "AI"`로 들어간다
 *
 * ## ⚠ 규칙
 * - **자동 지표에는 쓰지 않는다.** FRED·Yahoo·ECOS·네이버가 주는 값을 모델로 덮으면,
 *   다음 수집에서 다시 덮이고 그 사이 화면은 두 값을 오간다.
 * - **아무 주소나 받지 않는다.** http(s)만, 그리고 관리자만 부를 수 있다 —
 *   이 액션은 서버가 임의의 주소를 대신 두드리는 문이다(SSRF).
 * - 저장된 값의 출처는 **`AI`로 남는다.** 사람 손을 거친 값과 구분되지 않으면 이 기능은
 *   신뢰를 갉아먹는다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { seoulDay } from "@/lib/kst";
import { runAiTask } from "@/lib/ai/client";
import { resolveApiEnv } from "@/features/ai/credentials";
import { loadAiConfig, loadProviderUsage, recordAiUsage } from "@/features/ai/repository";
import { recordAdminLog } from "@/features/admin-log/repository";
import { findIndicator } from "@/lib/macro/catalog";
import { htmlToText } from "@/lib/html-text";
import { buildExtractPrompt, parseExtract } from "@/lib/indicator-extract";
import { upsertPoints } from "./repository";
import { emptyExtractState, type ExtractState } from "./extract-state";

/** 한 페이지를 받아 오는 데 쓰는 제한 시간. 느린 곳 하나가 화면을 잡지 않게 한다. */
const FETCH_TIMEOUT_MS = 20_000;

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** ⚠ 서버가 대신 두드리는 주소다. 사설망·다른 스킴으로 새지 않게 좁힌다. */
function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("주소 형식이 아닙니다.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("http(s) 주소만 받습니다.");
  }
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(url.hostname)) {
    throw new Error("내부 주소는 받지 않습니다.");
  }
  return url;
}

export async function extractIndicatorAction(
  _prev: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const admin = await requireAdmin("/admin/macro");

  const key = text(formData, "indicatorKey");
  const indicator = findIndicator(key);
  if (!indicator) return { error: "알 수 없는 지표입니다." };

  // ⚠ 자동으로 들어오는 지표를 모델 값으로 덮지 않는다.
  if (indicator.source !== "MANUAL") {
    return {
      error: `${indicator.name}은(는) ${indicator.source}에서 자동으로 들어옵니다. 모델로 덮지 않습니다.`,
    };
  }

  let url: URL;
  try {
    url = assertPublicHttpUrl(text(formData, "url"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "주소를 확인하세요." };
  }

  // ── 1. 본문은 서버가 받아 온다 ──────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let pageText: string;
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WoodsmanBot/1.0)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
    if (!res.ok) return { error: `그 주소가 ${res.status}로 답했습니다.`, url: url.toString() };
    pageText = htmlToText(await res.text());
  } catch (error) {
    console.error("[extract] 페이지를 받지 못했습니다", error);
    return { error: "페이지를 받아 오지 못했습니다.", url: url.toString() };
  } finally {
    clearTimeout(timer);
  }

  if (pageText.length < 200) {
    // ⚠ 자바스크립트로 그리는 페이지가 여기로 온다. 조용히 "못 찾음"으로 넘기지 않는다.
    return {
      error: "본문이 거의 비어 있습니다 — 자바스크립트로 그리는 페이지일 수 있습니다.",
      url: url.toString(),
    };
  }

  // ── 2. 모델은 그 본문 안에서만 찾는다 ────────────────────────
  const today = seoulDay(new Date().toISOString());
  const [usage, config, env] = await Promise.all([
    loadProviderUsage(),
    loadAiConfig(),
    resolveApiEnv(),
  ]);

  const run = await runAiTask({
    task: "indicator-extract",
    user: buildExtractPrompt({
      indicatorName: indicator.name,
      unit: indicator.unit,
      what: indicator.what,
      url: url.toString(),
      pageText,
      today,
    }),
    env,
    usage,
    global: {
      tokensUsedThisMonth: config.tokensUsedThisMonth,
      globalMonthlyTokenCap: config.globalMonthlyTokenCap,
    },
    maxTokens: 800,
  });

  if (!run.ok) return { error: run.reason, url: url.toString(), indicatorKey: key };

  await recordAiUsage(
    run.result.apiKeyEnv,
    run.result.usage.inputTokens + run.result.usage.outputTokens,
  );

  // ── 3. 인용문을 원문과 대조한다 ─────────────────────────────
  const parsed = parseExtract(run.result.text, { pageText, today });

  await recordAdminLog({
    actor: admin.email,
    action: "macro.extract",
    target: key,
    summary: parsed.ok
      ? `${run.result.providerLabel} · ${parsed.point.value} (${parsed.point.date})`
      : `${run.result.providerLabel} · 버림 — ${parsed.reason}`,
  });

  const common = {
    indicatorKey: key,
    indicatorName: indicator.name,
    url: url.toString(),
    provider: run.result.providerLabel,
    model: run.result.modelId,
  };

  if (!parsed.ok) return { ...common, rejected: parsed.reason };

  return {
    ...common,
    value: parsed.point.value,
    date: parsed.point.date,
    quote: parsed.point.quote,
    note: parsed.point.note,
  };
}

/**
 * 후보를 채택한다 — ⚠ 이 클릭이 사람의 몫이다.
 * ⚠ 넘어온 값을 다시 검증한다. 화면에서 온 값은 화면이 만든 값이 아닐 수 있다.
 */
export async function adoptExtractAction(
  _prev: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const admin = await requireAdmin("/admin/macro");

  const key = text(formData, "indicatorKey");
  const indicator = findIndicator(key);
  if (!indicator || indicator.source !== "MANUAL") return { error: "저장할 수 없는 지표입니다." };

  const value = Number(text(formData, "value"));
  const date = text(formData, "date");
  if (!Number.isFinite(value)) return { error: "값이 숫자가 아닙니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "기준일이 날짜 형식이 아닙니다." };

  try {
    // ⚠ 출처를 "AI"로 남긴다 — 사람이 넣은 값과 구분되지 않으면 안 된다.
    await upsertPoints(key, "AI", [{ date, value }]);
  } catch (error) {
    console.error("[extract] 저장 실패", error);
    return { error: "저장하지 못했습니다." };
  }

  await recordAdminLog({
    actor: admin.email,
    action: "macro.extract.adopt",
    target: key,
    summary: `${value} (${date}) · 출처 AI`,
  });

  for (const path of ["/", "/macro", `/macro/${indicator.group}`, "/admin/macro"]) {
    revalidatePath(path);
  }

  return { ...emptyExtractState, saved: `${indicator.name} ${value} (${date} 기준)` };
}
