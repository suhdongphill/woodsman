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
  /** 우선 경보 3종이 모두 2점인가 */
  priorityFired: boolean;
  priorityText: string;
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
    priorityFired,
    priorityText: PRIORITY_ALERT.text,
  };
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
