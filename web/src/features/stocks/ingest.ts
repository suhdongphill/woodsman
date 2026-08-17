/**
 * 종목 시세 가져오기 — Yahoo 차트 API에서 받아 D1에 **누적**한다.
 *
 * ## 왜 자동 수집인가
 * `docs/계획_2026-08-07_미세작업.md` C단계의 결정이다. 대표 포트폴리오처럼 수기로 가면
 * 보고서를 쓸 때마다 사람이 시세를 찾아 넣어야 하고, 그러면 보고서를 안 쓰게 된다.
 * ⚠ 다만 **실패했을 때 조용히 옛 값을 보여주지 않는다** — 마지막 기준일을 항상 함께 낸다.
 *
 * ## 규칙 (거시 수집에서 데이고 얻은 것)
 * - ⚠ **네트워크는 병렬, DB 쓰기는 순차.** 통째로 병렬 처리했다가 D1 연결이 끊겼다
 *   (`fetch failed`/ECONNRESET, 2026-08-06). 쓰기는 한 번에 하나씩 한다.
 * - ⚠ 종목 하나가 실패해도 나머지는 계속 간다. 다만 **반드시 기록**한다
 *   (`StockQuoteIngest.detail`). 조용히 옛 값을 보여주는 것이 이 프로젝트에서 가장 크게 데인 사고다.
 * - ⚠ 받은 값은 **원값 그대로** 넣는다. 등락·52주·Envelope는 읽을 때 `lib/quote/*`가 계산한다.
 */
import { fallbackSymbol, parseYahooQuotes, planSymbol } from "@/lib/quote/parse";
import type { QuotePoint } from "@/lib/quote/types";
import { normalizeQuotes, shiftDays } from "@/lib/quote/kpi";
import {
  finishQuoteIngest,
  loadMaxDates,
  startQuoteIngest,
  upsertQuotes,
  type QuoteIngestDetail,
} from "./repository";

/**
 * 처음 받을 때 얼마나 거슬러 올라갈지.
 * 2년이면 Envelope 20주(=약 5개월)와 52주 범위를 넉넉히 덮고, 밴드가 자리 잡는 과정도 보인다.
 */
const HISTORY_RANGE = "2y";
/** 이미 쌓여 있을 때 받는 구간. 되감기(아래)보다 넉넉해야 구멍이 안 생긴다. */
const REFRESH_RANGE = "3mo";

/**
 * 이미 가진 마지막 거래일에서 며칠까지 되돌려 다시 쓸 것인가.
 *
 * 종가는 액면분할·배당 조정으로 **사후에 바뀐다**. 새로 생긴 점만 쓰면 옛 값이 영원히
 * 틀린 채로 남는다. 반대로 매번 전 구간을 다시 쓰면 수집이 느려진다(거시에서 3분 34초를 겪었다).
 */
const REWRITE_BACK_DAYS = 30;

const FETCH_TIMEOUT_MS = 20_000;

export type QuoteTarget = {
  /** ⚠ 문자열 그대로. `005930`의 앞 0이 잘리면 종목이 바뀐다 */
  ticker: string;
  /** US | KR */
  market: string;
};

/** 응답이 안 오면 영원히 매달리지 않는다 — 한 종목이 전체 수집을 잡아먹는다. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo는 브라우저 UA가 아니면 막는 경우가 있다.
        "User-Agent": "Mozilla/5.0 (compatible; WoodsmanQuoteBot/1.0)",
        Accept: "application/json,*/*",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooDaily(symbol: string, range: string): Promise<QuotePoint[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=1d`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Yahoo ${symbol} 응답 ${res.status}`);
  return parseYahooQuotes(await res.json());
}

/**
 * 한 종목의 시세를 받는다.
 *
 * 국내 종목은 코스피(.KS)에서 비면 코스닥(.KQ)으로 한 번 되묻는다.
 * ⚠ 되물어도 비면 **던진다.** 빈 배열을 성공으로 처리하면 "수집됐는데 값이 없다"가 되어
 *    멈춘 수집과 구분이 안 된다.
 */
export async function fetchQuotes(
  target: QuoteTarget,
  full: boolean,
): Promise<{ points: QuotePoint[]; symbol: string; caveat?: string }> {
  const plan = planSymbol(target.ticker, target.market);
  if (!plan) {
    throw new Error(`티커 ${target.ticker}가 시장 ${target.market}의 모양이 아닙니다`);
  }

  const range = full ? HISTORY_RANGE : REFRESH_RANGE;

  let points = await fetchYahooDaily(plan.symbol, range);
  let symbol = plan.symbol;

  if (points.length === 0) {
    const alt = fallbackSymbol(plan);
    if (alt) {
      points = await fetchYahooDaily(alt, range);
      symbol = alt;
    }
  }

  if (points.length === 0) throw new Error(`Yahoo ${symbol} 응답에 값이 없습니다`);
  return { points: normalizeQuotes(points), symbol, caveat: plan.caveat };
}

/**
 * 무엇을 쓸지 고른다 — `pointsToWrite`(거시)와 같은 판단이다.
 *
 * 처음이면 전부. 이미 있으면 **마지막 거래일에서 30일 전부터**만 쓴다.
 */
export function quotesToWrite(
  points: QuotePoint[],
  known: string | undefined,
): { toWrite: QuotePoint[]; added: number } {
  if (!known) return { toWrite: points, added: points.length };

  const from = shiftDays(known, -REWRITE_BACK_DAYS);
  if (!from) return { toWrite: points, added: points.length };

  return {
    toWrite: points.filter((p) => p.date >= from),
    added: points.filter((p) => p.date > known).length,
  };
}

export type QuoteIngestResult = {
  runId: string;
  okCount: number;
  failCount: number;
  addedPoints: number;
  detail: QuoteIngestDetail[];
};

/**
 * 종목들의 시세를 받아 누적한다.
 *
 * 한 번에 여러 개를 병렬로 받되 동시 수를 제한한다 — 한 번에 수십 개를 던지면 Yahoo가 막는다.
 */
export async function ingestQuotes(
  targets: QuoteTarget[],
  options: { trigger?: string; concurrency?: number } = {},
): Promise<QuoteIngestResult> {
  const { trigger = "MANUAL", concurrency = 4 } = options;

  const runId = await startQuoteIngest(trigger);
  const maxDates = await loadMaxDates();
  const detail: QuoteIngestDetail[] = [];
  let addedPoints = 0;

  for (let i = 0; i < targets.length; i += concurrency) {
    const wave = targets.slice(i, i + concurrency);

    // 네트워크는 병렬로.
    const fetched = await Promise.all(
      wave.map(async (target) => {
        try {
          const known = maxDates.get(target.ticker);
          const result = await fetchQuotes(target, !known);
          return { target, ...result, known };
        } catch (error) {
          // ⚠ 실패를 삼키지 않는다. 로그와 이력 양쪽에 남긴다.
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[stocks] ${target.ticker} 시세 받기 실패`, error);
          detail.push({ ticker: target.ticker, ok: false, error: message });
          return null;
        }
      }),
    );

    // 쓰기는 순차로.
    for (const item of fetched) {
      if (!item) continue;
      try {
        const { toWrite, added } = quotesToWrite(item.points, item.known);
        await upsertQuotes(item.target.ticker, "YAHOO", toWrite);
        addedPoints += added;
        detail.push({
          ticker: item.target.ticker,
          ok: true,
          added,
          total: item.points.length,
          latest: item.points[item.points.length - 1]?.date,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[stocks] ${item.target.ticker} 시세 저장 실패`, error);
        detail.push({
          ticker: item.target.ticker,
          ok: false,
          error: `저장 실패: ${message}`,
        });
      }
    }
  }

  const okCount = detail.filter((d) => d.ok).length;
  const failCount = detail.length - okCount;
  await finishQuoteIngest(runId, { okCount, failCount, addedPoints, detail });

  return { runId, okCount, failCount, addedPoints, detail };
}
