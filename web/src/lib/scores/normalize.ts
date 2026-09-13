/**
 * 점수 정규화 — 순수 함수. Score Calculation Specification v1.0 §1~§3.
 * 원문: `docs/설계_점수계산명세_v1.md` · 우리 판정: `docs/설계_자본레짐엔진.md` 11장.
 *
 * ## 순서 (명세 머리말)
 * RAW → TRANSFORMATION → **NORMALIZATION → DIRECTION** → LEVEL/MOMENTUM → INDICATOR → SUB → COMPOSITE → REGIME
 * 이 파일은 굵은 두 칸이다.
 *
 * ## ⚠ 시점 기준(point-in-time)
 * 창은 **평가일 이전 값만** 쓴다. 전 구간 중앙값으로 과거를 채점하면 그때는 몰랐던 미래가 섞인다.
 * 수정이 잦은 계열은 부르는 쪽이 `lib/macro/vintage.ts`의 `valuesAsOf`로 **그날 알려진 값**을 넘긴다.
 *
 * ## ⚠ 계산할 수 없으면 계산하지 않는다
 * 역사가 5년이 안 되거나 MAD가 0이면(값이 한 번도 안 변했다) `undefined`와 **이유**를 돌려준다.
 * 50점으로 메우면 「평범하다」는 판정을 지어내는 것이다.
 */
import type { SeriesPoint } from "../macro/series";

/** 명세 §1 — 최근 10년, 최소 5년. */
export const ROLLING_YEARS = 10;
export const MIN_HISTORY_YEARS = 5;
/** 명세 §1 — ±3에서 자른다. */
export const Z_LIMIT = 3;
/** 명세 §1 — 정규분포에서 MAD를 표준편차로 맞추는 상수. */
export const MAD_SCALE = 1.4826;
/** 명세 §2 — z 1당 점수. 50 + 16.667·z. */
export const POINTS_PER_Z = 16.667;

export type ScoreDirection =
  /** 높을수록 좋다(생산성 · 준비금 · 신용 증가 · 민간 CAPEX) */
  | "HIGH_IS_POSITIVE"
  /** 높을수록 위험하다(HY OAS · MOVE · Engine Heat · SOFR−IORB · Capital Competition) */
  | "HIGH_IS_NEGATIVE"
  /** 가운데가 정상이다 — 목표 범위로부터의 거리로 채점 */
  | "NEUTRAL_CENTERED"
  /** 부호 자체가 뜻이다 — 0~100으로 억지로 바꾸지 않고 원값을 함께 낸다 */
  | "BIPOLAR";

export function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 명세 §1 — MAD = Median(|Xi − Median(X)|) */
export function mad(xs: number[]): number | undefined {
  const m = median(xs);
  if (m === undefined) return undefined;
  return median(xs.map((x) => Math.abs(x - m)));
}

function addYears(day: string, years: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export type WindowResult =
  | { ok: true; values: number[]; from: string; asOf: string }
  | { ok: false; reason: "NO_DATA" | "INSUFFICIENT_HISTORY"; firstDate?: string; asOf: string };

/**
 * 평가일 기준 10년 창. ⚠ 가장 오래된 점이 평가일로부터 5년이 안 되면 거절한다.
 * @param points 날짜 오름차순이 아니어도 된다(여기서 거른다).
 */
export function rollingWindow(
  points: SeriesPoint[],
  asOf: string,
  years = ROLLING_YEARS,
  minYears = MIN_HISTORY_YEARS,
): WindowResult {
  const known = points.filter((p) => p.date <= asOf && Number.isFinite(p.value));
  if (known.length === 0) return { ok: false, reason: "NO_DATA", asOf };
  const firstDate = known.reduce((min, p) => (p.date < min ? p.date : min), known[0].date);
  if (firstDate > addYears(asOf, -minYears)) {
    return { ok: false, reason: "INSUFFICIENT_HISTORY", firstDate, asOf };
  }
  const from = addYears(asOf, -years);
  return { ok: true, values: known.filter((p) => p.date >= from).map((p) => p.value), from, asOf };
}

export type RobustZ =
  | { ok: true; z: number; winsorized: boolean; median: number; mad: number }
  | { ok: false; reason: "EMPTY_WINDOW" | "ZERO_DISPERSION" };

/**
 * 명세 §1 — Robust Z = (현재 − 중앙값) / (1.4826 × MAD), ±3에서 자른다.
 * ⚠ MAD가 0이면(창 안의 값이 절반 넘게 같다) 흩어짐이 없어 z를 정할 수 없다 — 지어내지 않는다.
 */
export function robustZ(current: number, window: number[]): RobustZ {
  const m = median(window);
  const d = mad(window);
  if (m === undefined || d === undefined) return { ok: false, reason: "EMPTY_WINDOW" };
  if (d === 0) return { ok: false, reason: "ZERO_DISPERSION" };
  const raw = (current - m) / (MAD_SCALE * d);
  const z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, raw));
  return { ok: true, z, winsorized: z !== raw, median: m, mad: d };
}

/** 명세 §2 — 50 + 16.667·z, 0~100에서 자른다. */
export function zToScore(z: number): number {
  return Math.min(100, Math.max(0, 50 + POINTS_PER_Z * z));
}

/**
 * 명세 §3 — 방향을 입힌다. ⚠ BIPOLAR·NEUTRAL_CENTERED는 여기서 다루지 않는다(`centeredScore` · 원값 표시).
 */
export function applyDirection(normalized: number, direction: "HIGH_IS_POSITIVE" | "HIGH_IS_NEGATIVE"): number {
  return direction === "HIGH_IS_NEGATIVE" ? 100 - normalized : normalized;
}

/**
 * 명세 §3 NEUTRAL_CENTERED — 목표 범위 안이면 100, 벗어난 거리만큼 깎는다.
 * `penaltyPerUnit`는 범위를 한 단위 벗어날 때 깎는 점수 — 지표마다 설정에서 정한다(명세가 값을 정하지 않았다).
 */
export function centeredScore(value: number, target: { low: number; high: number }, penaltyPerUnit: number): number {
  const distance = value < target.low ? target.low - value : value > target.high ? value - target.high : 0;
  return Math.min(100, Math.max(0, 100 - distance * penaltyPerUnit));
}

export type LevelScore =
  | { ok: true; score: number; z: number; winsorized: boolean; window: { from: string; asOf: string; n: number } }
  | { ok: false; reason: string };

/**
 * 한 지표의 **수준 점수**(명세 §1~§3을 한 번에). BIPOLAR·NEUTRAL_CENTERED는 이 함수의 대상이 아니다.
 */
export function levelScore(
  points: SeriesPoint[],
  asOf: string,
  direction: "HIGH_IS_POSITIVE" | "HIGH_IS_NEGATIVE",
): LevelScore {
  const w = rollingWindow(points, asOf);
  if (!w.ok) return { ok: false, reason: w.reason };
  const current = [...points].filter((p) => p.date <= asOf).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!current) return { ok: false, reason: "NO_DATA" };
  const rz = robustZ(current.value, w.values);
  if (!rz.ok) return { ok: false, reason: rz.reason };
  return {
    ok: true,
    score: applyDirection(zToScore(rz.z), direction),
    z: rz.z,
    winsorized: rz.winsorized,
    window: { from: w.from, asOf: w.asOf, n: w.values.length },
  };
}
