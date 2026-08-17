/**
 * 시세에서 **§02 히어로 KPI**를 낸다 — 순수 계산.
 *
 * ## 무엇을 내는가
 * 설계서 §2-B가 요구한 넷이다: 현재가 · 당일 등락 · 52주 범위 · 시가총액.
 * 여기에 속보 박스가 쓰는 **거래량 배수**를 더한다.
 *
 * ## ⚠ 시가총액은 여기서 못 낸다
 * 발행주식수가 있어야 하는데 시세 시계열에는 없다. **없는 것을 지어내지 않는다**(R2).
 * `marketCap`은 밖에서 채워 주면 싣고, 없으면 `undefined`로 둔 채
 * 화면이 "미조회 + 조회처"를 적는다.
 *
 * ## ⚠ 여기서 매매를 지시하지 않는다
 * `WOODSMAN_DOCTRINE`이 금지한다. 위치까지만 말하고 "사라/팔아라"는 사람이 쓴다.
 */
import type { QuotePoint } from "./types";

/**
 * 자동 시세가 며칠 지나면 "묵었다"고 말할 것인가.
 *
 * ⚠ **수기 시세의 `STALE_AFTER_DAYS`(14일)와 일부러 다르다.**
 *    수기는 월 1회 리듬이라 2주가 절반이지만, 자동 시세는 **장 마감 후 하루 1회** 들어온다.
 *    연휴가 낀 주말(금요일 종가 → 다음 화요일)이 4일이므로 그보다 하루 넉넉한 5일을 넘겼다면
 *    수집이 **멈춘 것**이지 쉬는 날이 아니다. 14일을 쓰면 열흘 멈춘 수집을 정상으로 읽는다.
 *    ⚠ 문안 규칙은 `manual-price.ts`와 같다 — 값을 지우지 않고 **날짜를 붙인다.**
 */
export const QUOTE_STALE_AFTER_DAYS = 5;

/** 52주를 며칠로 볼 것인가. 달력 기준이다(거래일이 아니다). */
export const FIFTY_TWO_WEEK_DAYS = 365;

/** 거래량 배수를 낼 때 평균을 내는 구간(거래일). 분기 남짓이다. */
export const VOLUME_BASELINE_DAYS = 60;

/** 설계서 §2-B가 "속보 박스"를 띄우는 기준 — 일평균 대비 10배. */
export const VOLUME_SPIKE_MULTIPLE = 10;

export type QuoteChange = {
  /** 직전 거래일 종가 */
  previousClose: number;
  /** 차이(현재가 − 직전 종가) */
  diff: number;
  /** 변동률 % (소수 그대로. 반올림은 화면이 한다) */
  percent: number;
};

export type FiftyTwoWeekRange = {
  low: number;
  high: number;
  /**
   * 현재가가 밴드에서 어디쯤인가. 0=저점 · 100=고점.
   * ⚠ low === high(상장 직후 등)면 undefined다. 0으로 내면 "바닥"으로 읽힌다.
   */
  position?: number;
  /** 이 범위를 실제로 몇 개 점에서 냈나 — 적으면 화면이 그렇게 말한다 */
  samples: number;
};

export type VolumeSignal = {
  /** 최근 거래일의 거래량 */
  latest: number;
  /** 직전 구간의 일평균 */
  average: number;
  /** 평균 대비 배수 */
  multiple: number;
  /** 10배를 넘겼나 — 속보 박스를 띄울 자리 */
  spike: boolean;
};

export type QuoteKpi = {
  /** 최근 종가 */
  price: number;
  /** 그 종가의 거래일 (YYYY-MM-DD) */
  asOf: string;
  change?: QuoteChange;
  range?: FiftyTwoWeekRange;
  volume?: VolumeSignal;
  /** 최근 흐름을 그릴 종가 배열(오래된 것 → 최근) */
  spark: number[];
};

/** 날짜 오름차순으로 정렬하고 같은 날짜는 뒤엣것을 남긴다(수정치가 나중에 온다). */
export function normalizeQuotes(points: QuotePoint[]): QuotePoint[] {
  const byDate = new Map<string, QuotePoint>();
  for (const p of points) {
    if (!Number.isFinite(p.close)) continue;
    byDate.set(p.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** YYYY-MM-DD 두 날짜의 간격(일). 형식이 아니면 undefined. */
export function quoteAgeDays(asOf: string | undefined, today: string): number | undefined {
  if (!asOf) return undefined;
  const from = Date.parse(`${asOf}T00:00:00.000Z`);
  const to = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  return Math.round((to - from) / 86_400_000);
}

/** 자동 시세가 묵었나. 기준일이 없으면 판단하지 않는다(undefined). */
export function isQuoteStale(asOf: string | undefined, today: string): boolean | undefined {
  const age = quoteAgeDays(asOf, today);
  if (age == null) return undefined;
  return age > QUOTE_STALE_AFTER_DAYS;
}

/**
 * 히어로 KPI 계산.
 *
 * ⚠ 점이 하나도 없으면 **undefined**를 낸다. 0원짜리 KPI를 만들지 않는다.
 * ⚠ 점이 하나뿐이면 등락·52주 범위는 없는 채로 나간다. 있는 것만 말한다.
 */
export function buildQuoteKpi(
  points: QuotePoint[],
  options?: { sparkDays?: number },
): QuoteKpi | undefined {
  const sorted = normalizeQuotes(points);
  if (sorted.length === 0) return undefined;

  const latest = sorted[sorted.length - 1];
  const sparkDays = options?.sparkDays ?? 60;

  return {
    price: latest.close,
    asOf: latest.date,
    change: buildChange(sorted),
    range: buildRange(sorted, latest),
    volume: buildVolume(sorted),
    spark: sorted.slice(-sparkDays).map((p) => p.close),
  };
}

function buildChange(sorted: QuotePoint[]): QuoteChange | undefined {
  if (sorted.length < 2) return undefined;
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  // ⚠ 직전 종가가 0이면 변동률이 무한대다. 값을 내지 않는다.
  if (prev.close === 0) return undefined;
  const diff = latest.close - prev.close;
  return { previousClose: prev.close, diff, percent: (diff / prev.close) * 100 };
}

function buildRange(sorted: QuotePoint[], latest: QuotePoint): FiftyTwoWeekRange | undefined {
  const cutoff = shiftDays(latest.date, -FIFTY_TWO_WEEK_DAYS);
  const window = cutoff ? sorted.filter((p) => p.date >= cutoff) : sorted;
  if (window.length < 2) return undefined;

  const closes = window.map((p) => p.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  // ⚠ 밴드 폭이 0이면 위치를 내지 않는다. 0%로 내면 "52주 저점"이라는 거짓말이 된다.
  const position = high > low ? ((latest.close - low) / (high - low)) * 100 : undefined;

  return { low, high, position, samples: window.length };
}

function buildVolume(sorted: QuotePoint[]): VolumeSignal | undefined {
  const latest = sorted[sorted.length - 1];
  if (latest.volume == null || !Number.isFinite(latest.volume)) return undefined;

  // 당일은 평균에서 뺀다. 자기 자신을 평균에 넣으면 배수가 눌린다.
  const baseline = sorted
    .slice(-(VOLUME_BASELINE_DAYS + 1), -1)
    .map((p) => p.volume)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (baseline.length === 0) return undefined;

  const average = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  if (average === 0) return undefined;

  const multiple = latest.volume / average;
  return { latest: latest.volume, average, multiple, spike: multiple >= VOLUME_SPIKE_MULTIPLE };
}

/** YYYY-MM-DD를 n일 옮긴다. 형식이 아니면 undefined. */
export function shiftDays(date: string, days: number): string | undefined {
  const base = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(base)) return undefined;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}
