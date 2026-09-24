/**
 * GCRM v2 — 계산 파이프라인 (명세 §2-2). **순수 함수.** DB·환경 의존 없음.
 *
 * ```text
 * [0] 원시 계열        MacroPoint / MacroObservation (부르는 쪽이 읽어 온다)
 *      ↓ normalize.ts · horizon.ts
 * [1] 지표 × 시간축     0–100, polarity 적용 완료
 *      ↓ weights.ts · pillar.ts
 * [2] 기둥 × 시간축     + coverage + 게이트
 *      ↓ ① 요약 가중치        ② 기둥 간 가중치
 * [3a] 기둥 스칼라       화면용(raw) · 레짐용(slow — ⚠ 파도 제외)
 * [3b] 축 점수          tide / wind / wave
 *      ↓ alignment.ts · confidence.ts
 * [4] overall · rte · alignment
 *      ↓ signals.ts · regime.ts
 * [5] active_regime
 * ```
 *
 * ## ⚠ 이 파일이 순수한 이유
 * `pms regime verify`가 **같은 함수로 다시 계산해** 저장값과 대조한다.
 * DB를 읽는 코드가 섞이면 「재계산」이 「다시 읽기」가 되어 재현성 검증이 무의미해진다.
 *
 * ## ⚠ 빈티지는 부르는 쪽 책임이다
 * 이 함수는 받은 계열이 **그날 알려져 있던 값**이라고 믿는다(`normalize.ts` 머리말).
 * L1(`MacroObservation`)에서 `valuesAsOf`로 되살리는 일은 repository가 한다.
 */
import type { SeriesPoint } from "@/lib/macro/series";
import { enabledIndicators, axesFor, GCRM_INDICATOR_BY_CODE } from "./config/indicators";
import { GCRM_PILLARS } from "./config/pillars";
import { AXIS_WEIGHTS, AXES, DISPLAY, type Axis } from "./config/model";
import { specOf } from "./normalize";
import { axisScore, type AxisOutcome } from "./horizon";
import { stalenessOf, effectiveWeight, type Staleness } from "./weights";
import { computePillarAxis, computeAxis, type IndicatorInput, type PillarAxisResult, type AxisResult } from "./pillar";
import { directionOf, alignmentOf, alignmentState, type Direction, type AlignmentResult, type StateResult } from "./alignment";
import { confidenceOf, type ConfidenceResult } from "./confidence";
import { acuteWatch, type RawReading, type AcuteResult } from "./signals";
import {
  evaluateRegimeTransition,
  slowSummary,
  rteOf,
  type RegimeState,
  type SignalContext,
  type RegimeTransitionResult,
} from "./regime";

export type IndicatorAxisRow = {
  indicator: string;
  axis: Axis;
  status: "OK" | "MISSING" | "NOT_APPLICABLE";
  score?: number;
  pctRank?: number;
  obsDate?: string;
  obsCount?: number;
  staleness?: number;
  evidence: number;
  /** 왜 없는지 */
  reason?: string;
};

export type PillarScalar = {
  pillar: string;
  nameKo: string;
  /** 화면용 — 원래 방향. ⚠ 파도를 포함한 요약 */
  raw?: number;
  /** 집계용 — 우호 방향 */
  ori?: number;
  /** ⚠ 레짐 조건이 보는 값 — **파도를 뺀** raw (§2-11·§2-13 충돌 해소) */
  slowRaw?: number;
  status: "OK" | "INSUFFICIENT";
};

export type PipelineInput = {
  asOf: string;
  /** 지표 코드 → 원시 계열. ⚠ **그날의 빈티지**여야 한다 */
  series: Map<string, SeriesPoint[]>;
  /** 방향 판정용 과거 축 점수 — `asOf` 오름차순, 영업일 간격 */
  axisHistory: { asOf: string; tide?: number; wind?: number; wave?: number }[];
  /** 승격·해제에 쓰는 신호 상태 */
  signals: SignalContext;
  /** 급성 경보용 원시값 관측 */
  rawReadings: RawReading[];
  prev: RegimeState;
};

export type PipelineResult = {
  asOf: string;
  indicators: IndicatorAxisRow[];
  pillars: PillarAxisResult[];
  pillarScalars: PillarScalar[];
  axes: Record<Axis, AxisResult>;
  directions: Record<Axis, Direction | undefined>;
  confidence: Record<Axis, ConfidenceResult>;
  /** 종합 점수(우호 방향). 축이 하나라도 부족하면 `undefined` */
  overall?: number;
  /** 레짐 전이 증거. ⚠ 파도가 들어가지 않는다 */
  rte?: number;
  alignment?: AlignmentResult;
  alignmentState: StateResult;
  acute: AcuteResult;
  regime: RegimeTransitionResult;
  /** 화면에 낼 값 — 5점 단위 반올림 (§D-1) */
  display: { overall?: number; axes: Record<Axis, number | undefined> };
};

/** 지표 한 개 × 한 축. */
function scoreIndicatorAxis(
  code: string,
  series: SeriesPoint[] | undefined,
  axis: Axis,
  asOf: string,
): { row: IndicatorAxisRow; input: IndicatorInput } {
  const ind = GCRM_INDICATOR_BY_CODE.get(code)!;
  const evidenceKind = ind.evidence;
  const applicable = axesFor(ind.freq).includes(axis);

  const base: IndicatorAxisRow = {
    indicator: code,
    axis,
    status: "MISSING",
    evidence: effectiveWeight(1, { status: "MISSING", cycles: 0, ageDays: 0, detail: "" }, evidenceKind)
      .presenceWeight,
  };

  if (!applicable) {
    return {
      row: { ...base, status: "NOT_APPLICABLE", reason: `${ind.freq} 주기 지표는 ${axis}에 참여하지 않는다` },
      input: { code, applicable: false, polarity: ind.polarity, evidence: evidenceKind, staleness: { status: "MISSING", cycles: 0, ageDays: 0, detail: "참여하지 않음" }, enabled: true },
    };
  }

  if (!series || series.length === 0) {
    return {
      row: { ...base, reason: "계열이 없다" },
      input: {
        code,
        polarity: ind.polarity,
        evidence: evidenceKind,
        staleness: { status: "MISSING", cycles: 0, ageDays: 0, detail: "계열이 없다" },
        missingReason: "계열이 없다",
        enabled: true,
      },
    };
  }

  const outcome: AxisOutcome = axisScore(series, specOf(ind), ind.freq, axis, asOf);
  if (outcome.status !== "OK") {
    return {
      row: { ...base, reason: outcome.detail },
      input: {
        code,
        polarity: ind.polarity,
        evidence: evidenceKind,
        staleness: { status: "MISSING", cycles: 0, ageDays: 0, detail: outcome.detail },
        missingReason: outcome.detail,
        enabled: true,
      },
    };
  }

  const staleness: Staleness = stalenessOf(ind.freq, outcome.obsDate, asOf);
  return {
    row: {
      indicator: code,
      axis,
      status: staleness.status === "OK" ? "OK" : "MISSING",
      score: outcome.score,
      pctRank: outcome.pctRank,
      obsDate: outcome.obsDate,
      obsCount: outcome.obsCount,
      staleness: staleness.status === "OK" ? staleness.factor : undefined,
      evidence: effectiveWeight(1, staleness, evidenceKind).presenceWeight,
      ...(staleness.status === "MISSING" ? { reason: staleness.detail } : {}),
    },
    input: {
      code,
      score: outcome.score,
      polarity: ind.polarity,
      evidence: evidenceKind,
      staleness,
      enabled: true,
      obsCount: outcome.obsCount,
    },
  };
}

/** 과거 축 점수에서 `lag`만큼 뒤의 값을 고른다. ⚠ 없으면 지어내지 않는다. */
function pastAxisScore(
  history: PipelineInput["axisHistory"],
  axis: Axis,
  lag: number,
): number | undefined {
  const idx = history.length - 1 - lag;
  if (idx < 0) return undefined;
  return history[idx][axis];
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const { asOf, series, axisHistory, signals, rawReadings, prev } = input;
  const indicators: IndicatorAxisRow[] = [];
  const pillars: PillarAxisResult[] = [];

  // [1] 지표 × 시간축 → [2] 기둥 × 시간축
  const axes = {} as Record<Axis, AxisResult>;
  const perAxisInputs = new Map<Axis, Map<string, IndicatorInput>>();

  for (const axis of AXES) {
    const inputs = new Map<string, IndicatorInput>();
    for (const ind of enabledIndicators()) {
      const { row, input: ii } = scoreIndicatorAxis(ind.code, series.get(ind.series), axis, asOf);
      indicators.push(row);
      inputs.set(ind.code, ii);
    }
    perAxisInputs.set(axis, inputs);
    for (const p of GCRM_PILLARS) pillars.push(computePillarAxis(p, axis, inputs));
  }

  for (const axis of AXES) axes[axis] = computeAxis(GCRM_PILLARS, pillars, axis);

  // [3a] 기둥 스칼라 — 화면용(raw, 파도 포함)과 레짐용(slow, 파도 제외)
  const pillarScalars: PillarScalar[] = GCRM_PILLARS.map((p) => {
    const byAxis: Partial<Record<Axis, PillarAxisResult>> = {};
    for (const axis of AXES) byAxis[axis] = pillars.find((r) => r.pillar === p.code && r.axis === axis);

    const rawByAxis: { tide?: number; wind?: number; wave?: number } = {};
    const oriByAxis: { tide?: number; wind?: number; wave?: number } = {};
    for (const axis of AXES) {
      const r = byAxis[axis];
      if (r?.status === "OK") {
        rawByAxis[axis] = r.scoreRaw;
        oriByAxis[axis] = r.scoreOri;
      }
    }
    // 화면용은 세 축을 summaryWeights로 접는다(파도 포함)
    const foldAll = (v: typeof rawByAxis) => {
      let w = 0;
      let s = 0;
      for (const axis of AXES) {
        if (v[axis] === undefined) continue;
        w += p.summaryWeights[axis];
        s += p.summaryWeights[axis] * v[axis]!;
      }
      return w === 0 ? undefined : s / w;
    };
    const raw = foldAll(rawByAxis);
    return {
      pillar: p.code,
      nameKo: p.nameKo,
      raw,
      ori: foldAll(oriByAxis),
      // ⚠ 레짐 조건이 보는 값 — 파도를 뺀다
      slowRaw: slowSummary({ tide: rawByAxis.tide, wind: rawByAxis.wind }, p.summaryWeights),
      status: raw === undefined ? "INSUFFICIENT" : "OK",
    };
  });

  // [4] 방향 · 정렬도 · 신뢰도
  const directions = {} as Record<Axis, Direction | undefined>;
  const confidence = {} as Record<Axis, ConfidenceResult>;
  for (const axis of AXES) {
    const cur = axes[axis].score;
    const lag = { tide: 63, wind: 20, wave: 5 }[axis];
    directions[axis] = directionOf(axis, cur, pastAxisScore(axisHistory, axis, lag));

    const used = [...(perAxisInputs.get(axis) ?? new Map()).values()].filter(
      (i) => i.score !== undefined && i.staleness.status === "OK",
    );
    confidence[axis] = confidenceOf({
      coverage: axes[axis].coverage,
      stalenessFactors: used.map((i) => (i.staleness.status === "OK" ? i.staleness.factor : 0)),
      evidenceFactors: used.map((i) => GCRM_INDICATOR_BY_CODE.get(i.code)!.evidence).map((k) =>
        ({ official: 1, market: 0.95, manual: 0.9, judgment: 0.7 })[k],
      ),
      channels: signals.confirmedChannels as never[],
      /**
       * ⚠ **창을 얼마나 채웠나**. 설정의 `points`(조사 시점 스냅숏)가 아니라 **이번 계산이 실제로 쓴 수**다 —
       * 설정을 읽으면 오래된 사실로 오늘을 재게 된다(`normalize.ts`가 `minObs`에 대해 같은 말을 한다).
       */
      depthFactors: used.map((i) =>
        Math.min(1, (i.obsCount ?? 0) / GCRM_INDICATOR_BY_CODE.get(i.code)!.maxWindow),
      ),
    });
  }

  const allOk = AXES.every((a) => axes[a].status === "OK" && axes[a].score !== undefined);
  const overall = allOk
    ? AXES.reduce((s, a) => s + AXIS_WEIGHTS.core[a] * axes[a].score!, 0)
    : undefined;

  const alignment =
    allOk
      ? alignmentOf(
          { tide: axes.tide.score!, wind: axes.wind.score!, wave: axes.wave.score! },
          directions,
        )
      : undefined;

  const stateResult = alignmentState({
    alignment: alignment?.alignment ?? 0,
    dirs: directions,
    anyAxisInsufficient: !allOk,
    windPersistenceWeeks: signals.windPersistenceWeeks,
  });

  // ⚠ RTE에는 파도가 들어가지 않는다
  const rte =
    axes.tide.score !== undefined && axes.wind.score !== undefined
      ? rteOf(axes.tide.score, axes.wind.score)
      : undefined;

  // [5] 급성 경보 · 레짐
  const acute = acuteWatch(rawReadings);

  const pillarsSlow: Record<string, number | undefined> = {};
  for (const s of pillarScalars) pillarsSlow[s.pillar] = s.slowRaw;

  // ⚠ 총점 커버리지는 **조류·바람**으로 본다. 파도가 레짐 전이의 문을 여닫으면 안 된다.
  const overallCoverage = (axes.tide.coverage + axes.wind.coverage) / 2;

  const regime = evaluateRegimeTransition({
    asOf,
    tide: { score: axes.tide.score, coverage: axes.tide.coverage, status: axes.tide.status },
    wind: { score: axes.wind.score, coverage: axes.wind.coverage, status: axes.wind.status },
    pillarsSlow,
    signals,
    prev,
    overallCoverage,
  });

  const round = (v: number | undefined) =>
    v === undefined ? undefined : Math.round(v / DISPLAY.roundToNearest) * DISPLAY.roundToNearest;

  return {
    asOf,
    indicators,
    pillars,
    pillarScalars,
    axes,
    directions,
    confidence,
    overall,
    rte,
    alignment,
    alignmentState: stateResult,
    acute,
    regime,
    display: {
      overall: round(overall),
      axes: { tide: round(axes.tide.score), wind: round(axes.wind.score), wave: round(axes.wave.score) },
    },
  };
}

/**
 * 설명 — 기둥 하나의 기여도와 **제외 사유**.
 *
 * ⚠ 무엇이 빠졌는지 보이지 않으면 설명이 아니다(단계 8 지시).
 */
export function explainPillar(result: PipelineResult, pillar: string, axis: Axis) {
  const r = result.pillars.find((x) => x.pillar === pillar && x.axis === axis);
  if (!r) return undefined;
  const scalar = result.pillarScalars.find((s) => s.pillar === pillar);
  return {
    pillar,
    axis,
    status: r.status,
    scoreRaw: r.scoreRaw,
    scoreOri: r.scoreOri,
    summary: scalar,
    coverage: r.coverage,
    used: `${r.nUsed}/${r.nTotal}`,
    /** 기여도 내림차순 */
    contributions: r.contributions.map((c) => ({
      indicator: c.indicator,
      nameKo: GCRM_INDICATOR_BY_CODE.get(c.indicator)?.nameKo ?? c.indicator,
      path: c.path,
      score: c.score,
      effWeight: c.effWeight,
      share: c.share,
      polarityFlipped: c.polarityFlipped,
    })),
    /** ⚠ 제외된 지표와 사유 */
    excluded: r.excluded.map((e) => ({
      indicator: e.indicator,
      nameKo: e.indicator ? (GCRM_INDICATOR_BY_CODE.get(e.indicator)?.nameKo ?? e.indicator) : null,
      path: e.path,
      kind: e.kind,
      weight: e.presenceWeight,
      reason: e.reason,
    })),
    /** 이 축에 참여하지 않아 분모에서도 뺀 지표 */
    notApplicable: r.notApplicable,
  };
}
