"use server";

/**
 * 티커 조회 액션 — 종목을 넣기 **전에** 신원을 확인한다.
 *
 * ## 왜 생겼나 (2026-08-17)
 * 대표 포트폴리오 종목 폼에 조회가 없어서 이름·시장·통화·현재가를 전부 손으로 쳤다.
 * 그래서 **티커만 치고 Enter를 누르면 나머지가 텅 빈 종목이 그대로 등록됐다.**
 * 이제 조회로 칸을 채우고, 채워지기 전에는 등록 버튼이 눌리지 않는다.
 *
 * ⚠ `"use server"` 파일은 **async 함수만** export한다(상수·타입은 `lookup-form-state.ts`).
 * ⚠ `requireAdmin`을 먼저 부른다 — 조회도 외부 요청을 일으키므로 아무나 두드리게 두지 않는다.
 * ⚠ 판단·파싱은 `lib/quote/{parse,lookup}`이 한다. 여기서는 받아 오기만 한다.
 */
import { requireAdmin } from "@/lib/session";
import { planSymbol, currencyForMarket } from "@/lib/quote/parse";
import { isUsableProfile, parseTickerProfile, type TickerProfile } from "@/lib/quote/lookup";
import type { LookupResult } from "./lookup-form-state";

const FETCH_TIMEOUT_MS = 15_000;

async function fetchMeta(symbol: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WoodsmanQuoteBot/1.0)",
          Accept: "application/json,*/*",
        },
      },
    );
    if (!res.ok) throw new Error(`Yahoo ${symbol} 응답 ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 티커로 종목을 조회한다.
 *
 * 국내는 코스피(.KS)에서 못 찾으면 코스닥(.KQ)으로 한 번 되묻는다.
 * ⚠ 실패를 삼키지 않는다 — 왜 못 찾았는지 화면이 그대로 말한다.
 */
export async function lookupTickerAction(
  ticker: string,
  market: string,
): Promise<LookupResult> {
  await requireAdmin("/admin/model-portfolio");

  const trimmed = (ticker ?? "").trim();
  if (!trimmed) return { ok: false, error: "티커를 입력하세요." };

  const plan = planSymbol(trimmed, market);
  if (!plan) {
    return {
      ok: false,
      error:
        market === "KR"
          ? "국내 종목은 6자리 숫자 티커여야 합니다(예: 005930)."
          : "미국 종목은 영문 티커여야 합니다(예: NVDA).",
    };
  }

  const candidates = [plan.symbol];
  if (plan.symbol.endsWith(".KS")) candidates.push(plan.symbol.replace(/\.KS$/, ".KQ"));

  let lastError = "";
  for (const symbol of candidates) {
    try {
      const profile = parseTickerProfile(await fetchMeta(symbol));
      if (isUsableProfile(profile)) {
        return { ok: true, symbol, profile: withFallbackCurrency(profile, market), caveat: plan.caveat };
      }
      lastError = `${symbol}에서 값을 읽지 못했습니다.`;
    } catch (error) {
      // ⚠ 로그를 남기고 다음 후보로 간다. 조용히 넘어가지 않는다.
      console.error(`[portfolio] ${symbol} 조회 실패`, error);
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { ok: false, error: `종목을 찾지 못했습니다 — ${lastError}` };
}

/**
 * 통화가 안 왔으면 **시장에서** 채운다.
 *
 * ⚠ 임의로 USD를 넣지 않는다. 모르는 시장이면 비워 두고 사람이 고르게 한다 —
 *    통화를 잘못 정하면 비중이 통째로 틀린다(2026-08-02에 겪었다).
 */
function withFallbackCurrency(profile: TickerProfile, market: string): TickerProfile {
  if (profile.currency) return profile;
  return { ...profile, currency: currencyForMarket(market) };
}
