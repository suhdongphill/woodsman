/**
 * 바꾼 것과 반응을 잇는 판정 — 순수 모듈.
 *
 * ## 무엇을 하나
 * 릴리스(배포) 시점을 기준으로 **전 N일 vs 후 N일**의 지표 합계를 비교한다.
 *
 * ## ⚠ 이 파일의 절반은 "말하지 않기"다
 * 이 사이트는 방문이 적다. **적은 표본에서 그럴듯한 결론을 내는 것이 가장 큰 위험**이고,
 * 한 번 그렇게 내린 결론은 다음 결정을 통째로 오염시킨다. 그래서 판정은 네 갈래이고
 * 그중 셋이 **"아직 말할 수 없다"** 이다.
 *
 * 1. `too-early` — 후 기간이 아직 안 찼다
 * 2. `too-few` — 표본이 너무 적다
 * 3. `overlapping` — 같은 창에 다른 릴리스가 겹쳤다. **무엇 때문인지 모른다**
 * 4. `measured` — 여기서만 숫자를 말한다
 *
 * ⚠ **인과가 아니라 동시 발생이다.** 검색 유입 급변·시장 이벤트 같은 외부 요인은 알 수 없다.
 *    문구도 "덕분에 올랐다"가 아니라 "그 기간에 이렇게 달라졌다"로 적는다.
 */

/** 전후 비교 창(일). 요일 효과가 작지 않아 7의 배수로 둔다. */
export const EFFECT_WINDOW_DAYS = 14;

/**
 * 판정을 시작하는 최소 표본(전+후 합계).
 * ⚠ 이 값을 낮추고 싶은 유혹을 참는다 — 낮추면 숫자가 나오지만 그 숫자가 거짓이 된다.
 */
export const MIN_TOTAL_SAMPLE = 20;

export type EffectInput = {
  /** 릴리스 전 창의 합계 */
  before: number;
  /** 릴리스 후 창의 합계 */
  after: number;
  /** 릴리스 이후 실제로 지난 일수 */
  daysSinceRelease: number;
  /** ⚠ 같은 창 안에 들어온 **다른** 릴리스 수 */
  overlappingReleases: number;
  windowDays?: number;
  minTotalSample?: number;
};

export type EffectVerdict =
  | { kind: "too-early"; message: string }
  | { kind: "too-few"; message: string }
  | { kind: "overlapping"; message: string; changePct: number }
  | { kind: "measured"; message: string; changePct: number };

/** 변화율(%). 앞이 0이면 비율을 만들지 않는다 — 0에서 늘어난 것은 배율로 말할 수 없다. */
export function changePct(before: number, after: number): number | null {
  if (before <= 0) return null;
  return ((after - before) / before) * 100;
}

/**
 * 판정.
 *
 * ⚠ 순서가 의미를 갖는다. **못 말하는 이유를 먼저** 걸러야 한다 —
 *    표본이 모자라는데 "겹쳤다"고 말하면 다음에 표본이 차도 같은 말을 반복하게 된다.
 */
export function judgeEffect(input: EffectInput): EffectVerdict {
  const days = input.windowDays ?? EFFECT_WINDOW_DAYS;
  const minSample = input.minTotalSample ?? MIN_TOTAL_SAMPLE;
  const total = input.before + input.after;
  const pct = changePct(input.before, input.after);

  if (input.daysSinceRelease < days) {
    const left = days - input.daysSinceRelease;
    return {
      kind: "too-early",
      message: `아직 ${left}일 더 봐야 합니다 (전후 각 ${days}일 기준).`,
    };
  }

  if (total < minSample) {
    return {
      kind: "too-few",
      message: `표본이 적어 판정하지 않습니다 (전+후 ${total}건 · 최소 ${minSample}건).`,
    };
  }

  if (input.overlappingReleases > 0) {
    return {
      kind: "overlapping",
      changePct: pct ?? 0,
      message: `같은 기간에 다른 변경이 ${input.overlappingReleases}건 있었습니다. 무엇 때문인지 가릴 수 없습니다.`,
    };
  }

  if (pct === null) {
    return {
      kind: "too-few",
      message: "이전 기간이 0건이라 비율로 말할 수 없습니다.",
    };
  }

  const dir = pct > 0 ? "늘었습니다" : pct < 0 ? "줄었습니다" : "그대로입니다";
  return {
    kind: "measured",
    changePct: pct,
    // ⚠ "덕분에"라고 쓰지 않는다. 외부 요인을 알 수 없으므로 동시 발생으로만 적는다.
    message: `그 기간에 ${Math.abs(pct).toFixed(1)}% ${dir} (${input.before} → ${input.after}건).`,
  };
}

/**
 * 날짜별 값에서 릴리스 전후 합계를 낸다.
 *
 * ⚠ 릴리스 **당일은 후 기간에 넣는다.** 그날 배포됐으므로 그날의 반응은 이미 새 화면의 것이다.
 * ⚠ 날짜 문자열(YYYY-MM-DD)은 사전순 비교가 곧 시간순 비교다 — 파싱하지 않는다.
 */
export function sumAround(
  daily: { date: string; count: number }[],
  releaseDay: string,
  windowDays = EFFECT_WINDOW_DAYS,
): { before: number; after: number } {
  const start = shiftDay(releaseDay, -windowDays);
  const end = shiftDay(releaseDay, windowDays - 1);

  let before = 0;
  let after = 0;
  for (const d of daily) {
    if (d.date >= start && d.date < releaseDay) before += d.count;
    else if (d.date >= releaseDay && d.date <= end) after += d.count;
  }
  return { before, after };
}

/** YYYY-MM-DD를 일 단위로 민다. */
export function shiftDay(day: string, delta: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return day;
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}

/** 릴리스 이후 지난 일수(당일=0). */
export function daysSince(releaseDay: string, today: string): number {
  const a = Date.parse(`${releaseDay}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
