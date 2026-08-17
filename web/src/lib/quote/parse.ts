/**
 * Yahoo 차트 응답 → 시세 시계열, 그리고 **시장별 심볼 규칙** — 순수 함수.
 *
 * ## ⚠ 왜 `macro/parse.parseYahooChart`를 그대로 쓰지 않나
 * 거시는 종가 하나면 되지만 종목은 **거래량이 함께 와야** 한다(설계서 §2-B의 거래량 배수).
 * 거시 파서를 고쳐 거래량을 얹으면 거시 쪽 `SeriesPoint`에 항상 비는 필드가 생긴다.
 * 그래서 **읽는 방식은 같고 담는 모양만 다른** 파서를 따로 둔다.
 *
 * ## ⚠ 시장 하나 = 어댑터 하나 (설계서 §5-2)
 * 지금 있는 것은 Yahoo 하나뿐이다. 국내 종목도 Yahoo가 `005930.KS`로 받아 주기는 하지만
 * **지연·결측이 있다**고 설계서가 못 박아 뒀다. 그래서 국내는 "받을 수 있다"가 아니라
 * **"덜 믿을 값"** 으로 표시해 내보낸다. KRX/네이버 어댑터가 붙으면 이 함수만 바뀐다.
 */
import type { QuotePoint } from "./types";

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: { close?: (number | null)[]; volume?: (number | null)[] }[];
      };
    }[];
    error?: unknown;
  };
};

/**
 * Yahoo 차트 응답을 일봉으로 읽는다.
 *
 * ⚠ 휴장일은 close가 null로 온다. 그대로 넣으면 차트에 0으로 꽂힌다 —
 *    거시 파서가 데인 그 자리다. 종가가 없는 점은 **버린다.**
 * ⚠ 거래량만 null인 것은 버리지 않는다. 종가는 쓸 수 있고, 거래량은 `undefined`로 남긴다.
 */
export function parseYahooQuotes(json: unknown): QuotePoint[] {
  const data = json as YahooChart;
  const result = data?.chart?.result?.[0];
  const stamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close;
  if (!stamps || !closes) return [];

  const volumes = quote?.volume;
  const out: QuotePoint[] = [];

  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;

    const stamp = stamps[i];
    if (!Number.isFinite(stamp)) continue;
    const date = new Date(stamp * 1000).toISOString().slice(0, 10);

    const volume = volumes?.[i];
    out.push({
      date,
      close,
      volume: volume != null && Number.isFinite(volume) ? volume : undefined,
    });
  }
  return out;
}

/** 지금 시세를 받을 수 있는 시장. ⚠ 늘어나면 어댑터를 나눈다(설계서 §5-2). */
export type QuoteMarket = "US" | "KR";

export type SymbolPlan = {
  /** Yahoo에 물어볼 심볼 */
  symbol: string;
  /**
   * ⚠ 이 시장의 값을 얼마나 믿을 수 있나.
   * `"delayed"`면 화면이 그 사실을 말해야 한다 — 조용히 같은 굵기로 보이면 안 된다.
   */
  reliability: "ok" | "delayed";
  /** 덜 믿을 값일 때 화면에 그대로 쓰는 한 문장 */
  caveat?: string;
};

/**
 * 티커 → Yahoo 심볼.
 *
 * ⚠ 국내 티커는 **6자리 숫자 문자열**이다. 앞의 0이 잘리면 종목이 바뀐다.
 *    그래서 여기서도 숫자로 만들지 않고 문자열 검사만 한다.
 */
export function planSymbol(ticker: string, market: string): SymbolPlan | undefined {
  const trimmed = ticker.trim();
  if (!trimmed) return undefined;

  if (market === "US") {
    // 알파벳·점·하이픈(BRK-B, BF.B)까지가 미국 티커의 모양이다.
    if (!/^[A-Za-z][A-Za-z.\-]*$/.test(trimmed)) return undefined;
    return { symbol: trimmed.toUpperCase(), reliability: "ok" };
  }

  if (market === "KR") {
    if (!/^\d{6}$/.test(trimmed)) return undefined;
    return {
      // 코스피(.KS)를 먼저 쓴다. 코스닥(.KQ)은 응답이 비면 되물어야 한다.
      symbol: `${trimmed}.KS`,
      reliability: "delayed",
      caveat:
        "국내 종목 시세는 Yahoo 경유라 지연·결측이 있습니다. 값을 그대로 믿지 마세요.",
    };
  }

  return undefined;
}

/**
 * 시세가 표시되는 통화 — **시장이 정한다.**
 *
 * ⚠ `StockReport.currency`를 쓰지 않는다. 그 컬럼은 **증권사 목표주가(컨센서스)의 통화**로
 *    쓰이고 있어서(`repository.ts`가 `consensusTarget.currency`를 그리로 넣는다),
 *    시세 통화로 갖다 쓰면 목표주가를 달러로 적은 국내 종목의 **현재가가 달러로 표시된다.**
 *    상장 시장이 통화를 결정하므로 여기서 낸다.
 */
export function currencyForMarket(market: string): string | undefined {
  if (market === "US") return "USD";
  if (market === "KR") return "KRW";
  // ⚠ 모르는 시장에 통화를 지어내지 않는다. 없으면 화면이 숫자만 적는다.
  return undefined;
}

/** 코스피에서 못 찾았을 때 되물을 심볼(코스닥). 미국은 되물을 것이 없다. */
export function fallbackSymbol(plan: SymbolPlan): string | undefined {
  return plan.symbol.endsWith(".KS") ? plan.symbol.replace(/\.KS$/, ".KQ") : undefined;
}
