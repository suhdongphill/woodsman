/**
 * 점수를 **언제 기준으로 계산해 무엇을 남기나** — 순수 함수. 저장은 `features/scores/repository.ts`.
 *
 * ## 평가일 셋 — 오늘 · 4주 전 · 13주 전
 * 운영자 원칙 ⑤(2026-09-14): 거시 데이터로 **조류의 방향**을 알려 줘야 독자가 파도를 읽는다. 점수 하나로는 방향이 없다 —
 * 지금 점수와 **4주 전 · 13주 전** 점수를 나란히 둬야 「넉넉해지는 쪽인가 빡빡해지는 쪽인가」가 보인다.
 * 날마다 쌓이기를 기다리면 석 달 동안 방향을 못 낸다. 그래서 수집할 때마다 셋을 함께 계산한다.
 *
 * ## ⚠ LIVE와 RECOMPUTED를 섞어 말하지 않는다
 * - **LIVE** — 그날 수집 직후 그날 알려진 값으로 계산했다. 이후 통계 수정이 섞이지 않는다.
 * - **RECOMPUTED** — 지금의 값(수정치 포함)으로 과거 평가일을 계산했다. ⚠ 그날 실제로 알 수 있던 점수가 **아니다.**
 *   같은 평가일에 LIVE가 생기면 LIVE가 이긴다(저장 SQL). 화면은 RECOMPUTED로 방향을 낼 때 그 사실을 적는다.
 */
import type { ScoreResult } from "./engine";

export type ScoreBasis = "LIVE" | "RECOMPUTED";

/** 방향을 재는 과거 평가일(일). 4주 · 13주. */
export const LOOKBACK_DAYS = [28, 91] as const;

function addDays(day: string, days: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 오늘(LIVE) → 4주 전 → 13주 전(RECOMPUTED). ⚠ 마지막이 가장 이른 평가일이다. */
export function evaluationDates(today: string): { asOf: string; basis: ScoreBasis }[] {
  return [{ asOf: today, basis: "LIVE" }, ...LOOKBACK_DAYS.map((d) => ({ asOf: addDays(today, -d), basis: "RECOMPUTED" as const }))];
}

export type ScoreRow = {
  scoreKey: string;
  asOf: string;
  modelVersion: string;
  basis: ScoreBasis;
  /** ⚠ 발행하지 않은 점수는 null — 0점이 아니다 */
  value: number | null;
  coverage: number;
  state: string;
  /** 구성요소 · 기여도 · 결측 이유 JSON */
  detail: string;
};

const r1 = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.round(n * 10) / 10);
const r4 = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.round(n * 10_000) / 10_000);

/**
 * 결과 → 저장 행. ⚠ 결측 이유는 **문장 그대로** 남긴다 — 화면이 「왜 비었나」를 다시 지어내지 않게.
 */
export function toScoreRow(result: ScoreResult, basis: ScoreBasis): ScoreRow {
  const detail = {
    oldestInput: result.oldestInput,
    components: result.components.map((c) => ({
      key: c.key,
      weight: c.weight,
      score: r1(c.score),
      missingReason: c.missingReason,
      subScore: c.subScore,
      indicators: c.indicators.map((i) => ({
        indicator: i.indicator,
        measure: i.measure,
        score: r1(i.score),
        latest: r4(i.latest),
        latestDate: i.latestDate,
        momentumUsed: i.momentumUsed,
        missingReason: i.missingReason,
      })),
    })),
    contributions: result.contributions.map((c) => ({
      key: c.key,
      effectiveWeight: r4(c.effectiveWeight),
      points: r1(c.points),
    })),
  };
  return {
    scoreKey: result.scoreKey,
    asOf: result.asOf,
    modelVersion: result.modelVersion,
    basis,
    value: result.score ?? null,
    coverage: result.coverage,
    state: result.state,
    detail: JSON.stringify(detail),
  };
}
