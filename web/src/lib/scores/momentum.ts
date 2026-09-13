/**
 * 모멘텀 점수 — 순수 함수. Score Calculation Specification v1.0 §5.
 *
 * ```text
 * Momentum = 0.20 × Score(5D) + 0.35 × Score(20D) + 0.30 × Score(60D) + 0.15 × Score(Acceleration)
 * ```
 * 각 변화값도 **그 변화의 과거 분포**에서 robust z로 정규화한다.
 *
 * ## ⚠ 발표 주기가 느린 계열 — 명세가 정하지 않은 자리 (설계서 11장)
 * 5D/20D/60D는 일간 계열의 말이다. 월간 CPI에 「5일 변화」는 없다. 그래서 **달력 길이**로 옮긴다:
 * 5D ≈ 1주 · 20D ≈ 1개월 · 60D ≈ 3개월. 계열 주기보다 짧은 창은 **계산하지 않고 결측으로 센다**
 * (월간 계열의 1주 변화를 지어내지 않는다) — 남은 창으로 재정규화하고, 무엇이 빠졌는지 돌려준다.
 */
import type { SeriesPoint } from "../macro/series";
import { robustZ, zToScore, applyDirection } from "./normalize";
import type { ReleaseFreq } from "../macro/freshness";

/** 명세 §5 */
export const MOMENTUM_WEIGHTS = { d5: 0.2, d20: 0.35, d60: 0.3, acceleration: 0.15 } as const;

/** 창의 달력 길이(일). 5D≈7일 · 20D≈30일 · 60D≈91일(영업일 → 달력). */
const WINDOW_DAYS = { d5: 7, d20: 30, d60: 91 } as const;
/** 계열 주기 한 칸의 대략 길이(일) — 이보다 짧은 창은 만들 수 없다. */
const FREQ_DAYS: Record<ReleaseFreq, number> = { d: 1, w: 7, m: 30, q: 91 } as Record<ReleaseFreq, number>;

type WindowKey = keyof typeof WINDOW_DAYS;

function dayNum(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
}

/** 기준일에서 `days` 전 이하의 가장 최근 값. 없으면 undefined. */
function valueDaysBefore(sorted: SeriesPoint[], day: string, days: number): number | undefined {
  const target = dayNum(day) - days;
  let found: number | undefined;
  for (const p of sorted) {
    if (dayNum(p.date) <= target) found = p.value;
    else break;
  }
  return found;
}

/** 각 관측일마다의 `days` 변화 시계열(과거 분포용). */
function changeSeries(sorted: SeriesPoint[], days: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const p of sorted) {
    const prev = valueDaysBefore(sorted, p.date, days);
    if (prev !== undefined) out.push({ date: p.date, value: p.value - prev });
  }
  return out;
}

export type MomentumResult = {
  score?: number;
  /** 쓰인 창 · 빠진 창(이유) */
  used: string[];
  skipped: { window: string; reason: string }[];
};

/**
 * @param points 이미 **그날 알려진 값**만(부르는 쪽이 `valuesAsOf`로 거른다)
 * @param direction 변화의 좋고 나쁨도 수준과 같은 방향이다(스프레드가 **벌어지는** 것은 나쁘다)
 */
export function momentumScore(
  points: SeriesPoint[],
  asOf: string,
  freq: ReleaseFreq,
  direction: "HIGH_IS_POSITIVE" | "HIGH_IS_NEGATIVE",
): MomentumResult {
  const sorted = points.filter((p) => p.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  const used: string[] = [];
  const skipped: MomentumResult["skipped"] = [];
  const parts: { weight: number; score: number }[] = [];
  const last = sorted.at(-1);
  if (!last) return { score: undefined, used, skipped: [{ window: "all", reason: "NO_DATA" }] };

  const scoreOfChange = (days: number): number | undefined => {
    const series = changeSeries(sorted, days);
    const current = series.at(-1);
    if (!current || current.date !== last.date) return undefined;
    const rz = robustZ(current.value, series.map((s) => s.value));
    return rz.ok ? applyDirection(zToScore(rz.z), direction) : undefined;
  };

  for (const key of Object.keys(WINDOW_DAYS) as WindowKey[]) {
    if (WINDOW_DAYS[key] < FREQ_DAYS[freq]) {
      skipped.push({ window: key, reason: `계열 주기(${freq})보다 짧은 창` });
      continue;
    }
    const s = scoreOfChange(WINDOW_DAYS[key]);
    if (s === undefined) skipped.push({ window: key, reason: "변화 분포를 만들 수 없음" });
    else {
      parts.push({ weight: MOMENTUM_WEIGHTS[key], score: s });
      used.push(key);
    }
  }

  // 가속도 = 지금의 20D(또는 가능한 가장 짧은) 변화 − 한 창 전의 같은 변화
  const accelDays = WINDOW_DAYS.d20 >= FREQ_DAYS[freq] ? WINDOW_DAYS.d20 : WINDOW_DAYS.d60;
  const changes = changeSeries(sorted, accelDays);
  const accel = changeSeries(changes, accelDays);
  const cur = accel.at(-1);
  if (cur && cur.date === last.date) {
    const rz = robustZ(cur.value, accel.map((a) => a.value));
    if (rz.ok) {
      parts.push({ weight: MOMENTUM_WEIGHTS.acceleration, score: applyDirection(zToScore(rz.z), direction) });
      used.push("acceleration");
    } else skipped.push({ window: "acceleration", reason: rz.reason });
  } else skipped.push({ window: "acceleration", reason: "가속도 분포를 만들 수 없음" });

  const w = parts.reduce((s, p) => s + p.weight, 0);
  return {
    score: w > 0 ? parts.reduce((s, p) => s + p.weight * p.score, 0) / w : undefined,
    used,
    skipped,
  };
}
