/**
 * 버블 점수 계산 — 순수 함수.
 *
 * 설계서의 식 그대로다:
 *   레이어 평균점(0~2) × 가중치 → **결측 제외 정규화** → 0~100
 *
 * ## 결측을 어떻게 다루나 (⚠ 핵심)
 * 값이 없는 지표는 **분모에서도 뺀다.** 0점으로 치면 "아직 안 본 것"이 "괜찮은 것"이 되고,
 * 2점으로 치면 공포를 지어낸다. 대신 **coverage(몇 개 중 몇 개를 봤나)를 항상 같이 낸다** —
 * 커버리지가 낮은 점수는 그만큼 덜 믿어야 한다는 걸 화면이 말할 수 있게.
 *
 * 지표가 하나도 없는 레이어는 가중치 자체를 빼고 정규화한다.
 */
import { BUBBLE_LAYERS, PRIORITY_ALERT, SCORE_BANDS } from "./catalog";
import type { BubbleLayer, BubblePoints, BubbleReading, BubbleScale, ScoreBand } from "./types";

/** 숫자 값을 눈금에 대어 0·1·2로. 값이 없으면 undefined. */
export function scoreByScale(
  scale: BubbleScale | undefined,
  value: number | undefined,
): BubblePoints | undefined {
  if (!scale || value === undefined || !Number.isFinite(value)) return undefined;

  if (scale.op === "gt") {
    if (value > scale.t2) return 2;
    if (value > scale.t1) return 1;
    return 0;
  }
  if (value < scale.t2) return 2;
  if (value < scale.t1) return 1;
  return 0;
}

export type LayerScore = {
  layer: BubbleLayer;
  /** 채점된 지표 수 */
  scored: number;
  total: number;
  /** 0~2 평균. 채점된 게 없으면 undefined */
  average?: number;
  readings: (BubbleReading | undefined)[];
};

export type BubbleScore = {
  layers: LayerScore[];
  /** 0~100. 채점된 게 하나도 없으면 undefined — 0으로 내지 않는다(0은 "안전"으로 읽힌다). */
  score?: number;
  band?: ScoreBand;
  coverage: { scored: number; total: number; pct: number };
  /**
   * 이 점수가 **언제 기준인가**.
   * ⚠ 한 날짜로 뭉갤 수 없다 — 지표마다 기준일이 다르고, 분기 갱신(`/bubble-review`)이라
   *   몇 달 묵은 판정이 섞여 있는 것이 정상이다. 그러니 화면은 **가장 오래된 것**까지 말해야
   *   "이 숫자가 얼마나 묵었는지"를 읽는 사람이 스스로 판단할 수 있다.
   */
  asOf: ScoreAsOf;
  /** 우선 경보 3종이 모두 2점인가 */
  priorityFired: boolean;
  priorityText: string;
};

export type ScoreAsOf = {
  /** 채점된 것 중 가장 오래된 기준일(YYYY-MM-DD) */
  oldest?: string;
  /** 가장 최근 기준일 */
  newest?: string;
  /** ⚠ 기준일 없이 채점된 건수 — 날짜 없는 판정이 섞여 있으면 범위가 실제보다 좁아 보인다 */
  undated: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function bandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score <= b.max) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

/**
 * 전체 점수.
 * `readings`는 지표 키 → 판정. 없는 키는 결측으로 본다.
 */
export function scoreBubble(readings: Map<string, BubbleReading>): BubbleScore {
  const layers: LayerScore[] = BUBBLE_LAYERS.map((layer) => {
    const rs = layer.indicators.map((i) => readings.get(i.key));
    const scored = rs.filter((r): r is BubbleReading => !!r);
    return {
      layer,
      scored: scored.length,
      total: layer.indicators.length,
      average: scored.length
        ? scored.reduce((sum, r) => sum + r.points, 0) / scored.length
        : undefined,
      readings: rs,
    };
  });

  const active = layers.filter((l) => l.average !== undefined);
  const weightSum = active.reduce((sum, l) => sum + l.layer.weight, 0);

  // 레이어 평균(0~2)을 가중 평균한 뒤 100점 만점으로 편다.
  const score =
    weightSum > 0
      ? round1(
          (active.reduce((sum, l) => sum + l.average! * l.layer.weight, 0) / weightSum / 2) * 100,
        )
      : undefined;

  const scoredCount = layers.reduce((sum, l) => sum + l.scored, 0);
  const totalCount = layers.reduce((sum, l) => sum + l.total, 0);

  const priorityFired = PRIORITY_ALERT.keys.every((k) => readings.get(k)?.points === 2);

  return {
    layers,
    score,
    band: score === undefined ? undefined : bandFor(score),
    coverage: {
      scored: scoredCount,
      total: totalCount,
      pct: totalCount ? Math.round((scoredCount / totalCount) * 100) : 0,
    },
    asOf: asOfRange(layers),
    priorityFired,
    priorityText: PRIORITY_ALERT.text,
  };
}

/**
 * 채점에 쓰인 기준일의 범위.
 * ⚠ 카탈로그에 있는 지표만 센다 — 화면에 안 나오는 옛 판정이 기준일을 끌고 가면 안 된다.
 */
function asOfRange(layers: LayerScore[]): ScoreAsOf {
  const dates: string[] = [];
  let undated = 0;

  for (const layer of layers) {
    for (const r of layer.readings) {
      if (!r) continue;
      if (r.asOf) dates.push(r.asOf);
      else undated += 1;
    }
  }

  if (dates.length === 0) return { undated };
  // YYYY-MM-DD는 사전순이 곧 시간순이다.
  const sorted = [...dates].sort();
  return { oldest: sorted[0], newest: sorted[sorted.length - 1], undated };
}

/**
 * 게이지 아래에 낼 기준일 한 줄. 없으면 null(빈 칸을 지어내지 않는다).
 *
 * ⚠ 하루로 뭉치지 않는다. "2026-08-14 기준"이라고 적으면 다섯 달 묵은 판정까지
 *   그날 잰 것처럼 읽힌다 — 그게 이 화면에서 가장 비싼 거짓말이다.
 */
export function asOfNotice(asOf: ScoreAsOf): string | null {
  const tail = asOf.undated > 0 ? ` · ⚠ 기준일 없는 판정 ${asOf.undated}건` : "";

  if (!asOf.oldest || !asOf.newest) {
    return asOf.undated > 0 ? `채점에 기준일이 하나도 적혀 있지 않습니다(${asOf.undated}건).` : null;
  }
  if (asOf.oldest === asOf.newest) return `${asOf.newest} 기준${tail}`;
  return `${asOf.newest} 기준 · 가장 오래된 판정은 ${asOf.oldest}${tail}`;
}

/** 커버리지가 낮으면 점수를 그대로 믿지 말라고 화면이 말해야 한다. */
export function coverageNotice(coverage: { scored: number; total: number; pct: number }): string {
  if (coverage.scored === 0) {
    return "아직 채점한 지표가 없습니다. 관리자 화면에서 값을 넣으면 점수가 계산됩니다.";
  }
  if (coverage.pct < 60) {
    return `${coverage.total}개 중 ${coverage.scored}개만 채점됐습니다(${coverage.pct}%). 빠진 지표가 많아 점수가 실제보다 한쪽으로 치우칠 수 있습니다.`;
  }
  return `${coverage.total}개 중 ${coverage.scored}개 채점(${coverage.pct}%). 결측은 분모에서 빼고 계산했습니다.`;
}
