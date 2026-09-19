/**
 * GCRM v2 — 민감도 분석 (명세 §2-15). 순수 함수.
 *
 * ## 무엇을 재는가
 * 「이 숫자가 조금 달랐다면 판정이 바뀌었을까」. 바뀐다면 그 판정은 **가중치가 만든 것**이지
 * 데이터가 만든 것이 아니다.
 *
 * ⚠ 이 파일은 `provenance.ts`의 **D등급(근거 없음) 값들을 검증하는 자리**다.
 * 특히 기둥 간 가중치(`axisWeight`)는 지금 균등이고, 균등이 옳다는 근거도 없다 —
 * 여기서 「차등이면 얼마나 달라지나」를 재야 그 자리가 위험한지 알 수 있다.
 *
 * ## ⚠ 경고가 뜨면 가중치를 고치기 전에 **왜 떴는지 먼저 본다** (단계 10 지시)
 * 경고를 없애려고 가중치를 만지면, 모델이 아니라 **경고를 조정한 것**이 된다.
 */
import { AXIS_WEIGHTS, SENSITIVITY, AXES, type Axis } from "./config/model";
import type { PillarAxisResult } from "./pillar";

// ─────────────────────────────────────────────────────────────────────────
// 시간축 가중치 섭동 (§2-15)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 한 축을 `deltaPp`(퍼센트포인트)만큼 움직이고 **나머지 둘은 원래 비율대로 비례 재배분**한다.
 *
 * ```text
 * 예: tide 50 → 55일 때, wind:wave = 35:15 이므로
 *     wind = 45 × 35/50 = 31.5,  wave = 45 × 15/50 = 13.5
 * ```
 *
 * ⚠ 균등 차감이 아니다. 균등으로 빼면 작은 축이 상대적으로 더 깎여 **비율 자체가 바뀐다** —
 * 그러면 섭동이 「가중치 하나를 움직인 효과」가 아니라 「구조를 바꾼 효과」가 된다.
 */
export function redistributeAxisWeights(
  base: Record<Axis, number>,
  axis: Axis,
  deltaPp: number,
): Record<Axis, number> {
  const target = base[axis] + deltaPp / 100;
  const others = AXES.filter((a) => a !== axis);
  const otherSum = others.reduce((s, a) => s + base[a], 0);
  const remain = 1 - target;

  const out = { ...base } as Record<Axis, number>;
  out[axis] = target;
  for (const a of others) {
    // ⚠ 원래 비율(`base[a] / otherSum`)을 지킨다
    out[a] = otherSum === 0 ? remain / others.length : remain * (base[a] / otherSum);
  }
  return out;
}

export type AxisPerturbation = {
  axis: Axis;
  deltaPp: number;
  weights: Record<Axis, number>;
  overall?: number;
  /** 기준 대비 변화. `undefined`면 계산할 수 없었다 */
  shift?: number;
};

/**
 * 축 가중치를 ±5pp 흔들어 종합 점수가 얼마나 움직이는지 본다.
 *
 * ⚠ **축 가중치는 축 점수를 바꾸지 않는다** — `AXIS_WEIGHTS.core`는 종합 점수를 만들 때만 쓰인다.
 * 그래서 이 섭동으로는 정렬도·레짐이 바뀔 수 없고, `MODEL_FRAGILITY_WARNING`의 세 조건 중
 * **「overall 5점 이상 변동」만** 살아 있다. 나머지 둘을 흔드는 것은 창 가중치(`HORIZON_WEIGHTS`)이고,
 * 그건 파이프라인을 다시 돌려야 한다(`axisScoreSensitivity`).
 */
export function axisWeightSensitivity(
  axisScores: Record<Axis, number | undefined>,
  base: Record<Axis, number> = AXIS_WEIGHTS.core,
): { baseline?: number; runs: AxisPerturbation[] } {
  const overallOf = (w: Record<Axis, number>) => {
    let sum = 0;
    for (const a of AXES) {
      const s = axisScores[a];
      if (s === undefined) return undefined;
      sum += w[a] * s;
    }
    return sum;
  };

  const baseline = overallOf(base);
  const runs: AxisPerturbation[] = [];
  for (const axis of AXES) {
    for (const deltaPp of [SENSITIVITY.axisDeltaPp, -SENSITIVITY.axisDeltaPp]) {
      const weights = redistributeAxisWeights(base, axis, deltaPp);
      const overall = overallOf(weights);
      runs.push({
        axis,
        deltaPp,
        weights,
        overall,
        shift: overall !== undefined && baseline !== undefined ? overall - baseline : undefined,
      });
    }
  }
  return { baseline, runs };
}

// ─────────────────────────────────────────────────────────────────────────
// 지표 가중치 섭동 (§2-15)
// ─────────────────────────────────────────────────────────────────────────

export type IndicatorPerturbation = {
  indicator: string;
  pillar: string;
  axis: Axis;
  baseWeight: number;
  /** +10% 했을 때의 기둥 점수 */
  up?: number;
  /** −10% 했을 때 */
  down?: number;
  /** 두 방향 중 큰 이동폭 */
  maxShift: number;
  /** ⚠ 한 지표가 기둥을 이만큼 움직이면 지배적이다 */
  dominant: boolean;
};

/**
 * 기둥 안에서 지표 하나의 `base_weight`를 ±10% 흔든다.
 *
 * ⚠ 파이프라인을 다시 돌리지 않는다. 기둥 점수가
 * `Σ(점수 × eff) / Σ(eff)`이므로, 이미 계산된 기여도만으로 **정확히** 다시 낼 수 있다.
 * (근사가 아니다 — 같은 식을 다시 푸는 것이다.)
 *
 * ## ⚠ 명세의 지배 판정은 **뜰 수 없는 임계**다 (2026-09-20 확인)
 * 명세 §2-15: 「어느 한 지표의 섭동이 기둥 점수를 **3점 이상** 움직이면 `DOMINANT_INDICATOR_WARNING`」.
 *
 * 그런데 기둥 점수가 가중평균이므로 한 지표를 ±10% 흔들었을 때의 이동폭은
 * `(0.1w / (1 ∓ 0.1w)) × |점수 − 기둥점수|`로 묶이고, 이 값은 **최대 2.63점**이다
 * (가중치 0.51, 나머지가 정반대 극단일 때). 즉 **3점에 닿을 수 없다.**
 *
 * `minNonOverlap = 3`과 같은 종류의 죽은 임계다 — 붙어 있지만 아무 일도 하지 않는다.
 * 그래서 지배 판정은 **빼고 재는 방식**(`leaveOneOutSensitivity`)으로 옮겼다.
 * ±10% 섭동 자체는 명세대로 남겨 둔다 — 「얼마나 안 움직이는가」도 사실이다.
 */
export function indicatorSensitivity(pillar: PillarAxisResult): IndicatorPerturbation[] {
  if (pillar.status !== "OK" || pillar.contributions.length === 0) return [];

  const cs = pillar.contributions;
  const totalW = cs.reduce((s, c) => s + c.effWeight, 0);
  const totalWS = cs.reduce((s, c) => s + c.effWeight * c.score, 0);
  const baseScore = totalWS / totalW;

  const out: IndicatorPerturbation[] = [];
  for (const c of cs) {
    const shifted = (ratio: number) => {
      const dw = c.effWeight * ratio - c.effWeight;
      const w = totalW + dw;
      if (w <= 0) return undefined;
      return (totalWS + dw * c.score) / w;
    };
    const up = shifted(1 + SENSITIVITY.indicatorDeltaRatio);
    const down = shifted(1 - SENSITIVITY.indicatorDeltaRatio);
    const maxShift = Math.max(
      up === undefined ? 0 : Math.abs(up - baseScore),
      down === undefined ? 0 : Math.abs(down - baseScore),
    );
    out.push({
      indicator: c.indicator,
      pillar: pillar.pillar,
      axis: pillar.axis,
      baseWeight: c.baseWeight,
      up,
      down,
      maxShift,
      // ⚠ 명세의 「±10%가 기둥을 3점 이상 움직이면」은 **어떤 경우에도 뜰 수 없다**(위 머리말).
      //    지배 판정은 `leaveOneOutSensitivity()`가 한다. 여기서는 항상 false다.
      dominant: false,
    });
  }
  return out.sort((a, b) => b.maxShift - a.maxShift);
}

export type LeaveOneOut = {
  indicator: string;
  pillar: string;
  axis: Axis;
  /** 이 지표를 빼면 기둥 점수가 얼마가 되는가 */
  without?: number;
  /** 기준 대비 이동폭 */
  shift: number;
  /** 유효 가중치 비중 */
  weightShare: number;
  /** ⚠ 이 하나가 기둥을 대표하고 있다 */
  dominant: boolean;
};

/**
 * **빼고 재기** — 지표 하나를 빼면 기둥 점수가 얼마나 움직이는가.
 *
 * ⚠ 명세의 ±10% 섭동이 구조적으로 3점에 닿을 수 없어(위 참조) 지배 판정을 이쪽으로 옮겼다.
 * 이 질문이 원래 물으려던 것에 더 가깝기도 하다 — 「이 지표가 없으면 기둥이 달라지는가」.
 *
 * ⚠ 마지막 한 개를 빼면 기둥이 사라진다. 그때는 `without`이 `undefined`이고,
 *   이동폭을 지어내지 않는다 — **대신 그 사실 자체가 지배의 증거**이므로 `dominant`는 참이다.
 */
export function leaveOneOutSensitivity(pillar: PillarAxisResult): LeaveOneOut[] {
  if (pillar.status !== "OK" || pillar.contributions.length === 0) return [];

  const cs = pillar.contributions;
  const totalW = cs.reduce((s, c) => s + c.effWeight, 0);
  const totalWS = cs.reduce((s, c) => s + c.effWeight * c.score, 0);
  const baseScore = totalWS / totalW;

  return cs
    .map((c) => {
      const w = totalW - c.effWeight;
      const without = w <= 0 ? undefined : (totalWS - c.effWeight * c.score) / w;
      const shift = without === undefined ? Infinity : Math.abs(without - baseScore);
      return {
        indicator: c.indicator,
        pillar: pillar.pillar,
        axis: pillar.axis,
        without,
        shift,
        weightShare: c.effWeight / totalW,
        dominant: without === undefined || shift >= SENSITIVITY.dominantPillarDelta,
      };
    })
    .sort((a, b) => b.shift - a.shift);
}

// ─────────────────────────────────────────────────────────────────────────
// 기둥 간 가중치 섭동 — ⚠ 명세에 없다. `provenance.ts`의 D-1 검증 계획이 요구한다
// ─────────────────────────────────────────────────────────────────────────

export type PillarWeightComparison = {
  /** 비교한 이름 (예: `균등` vs `차등`) */
  label: string;
  weights: Record<string, number>;
  overall?: number;
  shift?: number;
};

/**
 * 기둥 간 가중치를 바꿔 종합 점수가 얼마나 움직이는지 본다.
 *
 * ⚠ **이것이 `provenance.ts`의 `axis_weight_pillars`(D등급)를 검증하는 자리**다.
 * 지금은 균등(각 0.10)이고 균등이 옳다는 근거도 없다 —
 * 차등이 결과를 크게 바꾼다면 그 자리는 **근거를 만들기 전에는 화면에 낼 수 없다.**
 *
 * @param pillarOri 기둥 코드 → **우호 방향** 점수(집계용). `INSUFFICIENT`면 넣지 않는다
 */
export function pillarWeightSensitivity(
  pillarOri: Record<string, number>,
  candidates: { label: string; weights: Record<string, number> }[],
): PillarWeightComparison[] {
  const overallOf = (w: Record<string, number>) => {
    let sum = 0;
    let used = 0;
    for (const [code, score] of Object.entries(pillarOri)) {
      const weight = w[code];
      if (weight === undefined) continue;
      sum += weight * score;
      used += weight;
    }
    // ⚠ 자료 부족 기둥은 분모에서 빠진다(§2-6) — 0으로 넣지 않는다
    return used === 0 ? undefined : sum / used;
  };

  const baseline = candidates[0] ? overallOf(candidates[0].weights) : undefined;
  return candidates.map((c) => {
    const overall = overallOf(c.weights);
    return {
      label: c.label,
      weights: c.weights,
      overall,
      shift: overall !== undefined && baseline !== undefined ? overall - baseline : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 경고
// ─────────────────────────────────────────────────────────────────────────

export type FragilityInput = {
  baseline: { overall?: number; regimeCode: string; alignmentState: string };
  perturbed: { overall?: number; regimeCode: string; alignmentState: string };
  label: string;
};

export type FragilityWarning = {
  code: "MODEL_FRAGILITY_WARNING";
  label: string;
  /** 어느 조건이 걸렸는가 */
  triggers: string[];
};

/**
 * `MODEL_FRAGILITY_WARNING` — 셋 중 하나라도 해당하면 경고 (§2-15).
 * 1. 레짐 코드가 바뀐다
 * 2. overall 점수가 5점 이상 변한다
 * 3. alignment 상태가 바뀐다
 */
export function fragility(input: FragilityInput): FragilityWarning | null {
  const t: string[] = [];
  const { baseline: b, perturbed: p } = input;

  if (b.regimeCode !== p.regimeCode) t.push(`레짐 ${b.regimeCode} → ${p.regimeCode}`);
  if (b.overall !== undefined && p.overall !== undefined) {
    const d = Math.abs(p.overall - b.overall);
    if (d >= SENSITIVITY.fragileOverallDelta) t.push(`종합 ${d.toFixed(1)}점 변동`);
  }
  if (b.alignmentState !== p.alignmentState) t.push(`정렬 상태 ${b.alignmentState} → ${p.alignmentState}`);

  return t.length === 0 ? null : { code: "MODEL_FRAGILITY_WARNING", label: input.label, triggers: t };
}

export type DominantWarning = {
  code: "DOMINANT_INDICATOR_WARNING";
  indicator: string;
  pillar: string;
  axis: Axis;
  shift: number;
  /** ⚠ 고치기 전에 읽을 문장 */
  advice: string;
};

/**
 * ⚠ 경고를 없애려고 가중치를 만지면 모델이 아니라 **경고를 조정한 것**이 된다.
 * ⚠ 입력은 `leaveOneOutSensitivity()`의 결과다 — ±10% 섭동으로는 지배를 잡을 수 없다(위 참조).
 */
export function dominantWarnings(leaveOneOut: LeaveOneOut[]): DominantWarning[] {
  return leaveOneOut
    .filter((p) => p.dominant)
    .map((p) => ({
      code: "DOMINANT_INDICATOR_WARNING" as const,
      indicator: p.indicator,
      pillar: p.pillar,
      axis: p.axis,
      shift: p.shift,
      advice:
        (p.without === undefined
          ? "이 지표를 빼면 기둥이 사라진다 — 혼자 기둥을 이고 있다. "
          : `이 지표를 빼면 기둥이 ${p.shift.toFixed(1)}점 움직인다(비중 ${(p.weightShare * 100).toFixed(0)}%). `) +
        "⚠ 가중치를 낮추기 전에 **왜 그런지** 먼저 본다 — " +
        "쓸 수 있는 지표가 적어 이 하나가 기둥을 대표하고 있는 것일 수 있다. " +
        "그렇다면 고칠 것은 가중치가 아니라 **빠진 지표**다.",
    }));
}
