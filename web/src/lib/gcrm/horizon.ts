/**
 * GCRM v2 — 시간축 합성 (명세 §2-4). 순수 함수.
 *
 * ## 하는 일
 * 지표 하나를 **조류 · 바람 · 파도** 세 점수로 만든다.
 *
 * ```text
 * h(창) = pct_rank( 지금 창의 평균,  과거 같은 길이 창 평균들의 분포 )
 *
 * tide = 0.35·h(1M) + 0.30·h(3M) + 0.20·h(6M) + 0.15·h(12M)
 * wind = 0.45·h(1W) + 0.35·h(4W) + 0.20·h(13W)
 * wave = 0.50·h(1D) + 0.30·h(3D) + 0.20·h(5D)
 * ```
 *
 * ## ⚠ `horizon_weight`는 **여기서만** 쓴다
 * `effective_weight = base_weight × staleness × evidence`에 다시 곱하지 않는다.
 * 명세 B-6이 지적한 이중 계산이고, 곱하면 짧은 창을 가진 지표가 기둥에서 두 번 할인된다.
 *
 * ## ⚠ 세 축은 인과가 아니라 **시간 창 분해**다 (§A-2)
 * 파도가 바람을 「일으킨」 것이 아니다. 같은 계열을 5일 창으로 보면 파도, 13주 창으로 보면 바람이다.
 * 그래서 승격은 「짧은 창의 부호가 긴 창에서도 같아졌는가」라는 **계산 가능한 질문**이 된다.
 *
 * ## ⚠ 저빈도 지표를 억지로 올리지 않는다
 * 분기·월간 지표는 **조류에만**, 주간 지표는 조류·바람에만 참여한다(`axesFor`).
 * 나머지 축에서는 0점이 아니라 `MISSING`이라, 기둥 집계의 **분모에서 빠진다.**
 */
import type { SeriesPoint } from "@/lib/macro/series";
import { workingSeries, pctRankOf, quantile, type NormalizeSpec } from "./normalize";
import { axesFor, type Freq } from "./config/indicators";
import {
  HORIZON_WEIGHTS,
  HORIZON_OBS,
  HORIZON_GUARD,
  type Axis,
  type HorizonKey,
} from "./config/model";

export type HorizonOutcome =
  | { key: HorizonKey; status: "OK"; weight: number; obs: number; windows: number; value: number }
  | { key: HorizonKey; status: "MISSING"; weight: number; reason: string };

export type AxisOutcome =
  | {
      status: "OK";
      /** 0~100. ⚠ **polarity 적용 전**이다 */
      pctRank: number;
      /** 0~100. polarity 적용 후 — 높을수록 자본에 우호 */
      score: number;
      /** 쓸 수 있었던 창들의 가중치 합(재정규화 전). 1.0이면 전부 썼다 */
      horizonCoverage: number;
      horizons: HorizonOutcome[];
      obsDate: string;
      obsCount: number;
    }
  | {
      status: "MISSING";
      reason: "NOT_APPLICABLE" | "NO_DATA" | "SHORT_HISTORY" | "THIN_WINDOWS";
      detail: string;
      horizons: HorizonOutcome[];
    };

/** 길이 `w`의 **이동 평균들**. 겹치는 창이다 — 개수가 아니라 독립성을 따로 본다. */
export function rollingMeans(values: number[], w: number): number[] {
  if (w <= 0 || values.length < w) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= w) sum -= values[i - w];
    if (i >= w - 1) out.push(sum / w);
  }
  return out;
}

/** winsor 절단된 작업 계열 값. 분포와 대상 값을 같은 경계로 자른다. */
function clippedValues(series: SeriesPoint[], spec: NormalizeSpec): number[] {
  const values = series.map((p) => p.value);
  const sorted = [...values].sort((a, b) => a - b);
  const lo = quantile(sorted, spec.winsor[0]);
  const hi = quantile(sorted, spec.winsor[1]);
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}

/**
 * 한 축의 점수.
 *
 * @param points 원시 계열. ⚠ **그날의 빈티지**여야 한다(`normalize.ts` 머리말).
 */
export function axisScore(
  points: SeriesPoint[],
  spec: NormalizeSpec,
  freq: Freq,
  axis: Axis,
  asOf: string,
): AxisOutcome {
  // ⚠ 참여 규칙이 먼저다. 분기 지표를 파도로 만들려고 시도조차 하지 않는다.
  if (!axesFor(freq).includes(axis)) {
    return {
      status: "MISSING",
      reason: "NOT_APPLICABLE",
      detail: `${freq} 주기 지표는 ${axis}에 참여하지 않는다 — 억지로 올리지 않는다`,
      horizons: [],
    };
  }

  const series = workingSeries(points, spec, asOf);
  if (series.length === 0) {
    return { status: "MISSING", reason: "NO_DATA", detail: `${asOf}까지 관측이 없다`, horizons: [] };
  }
  if (series.length < spec.minObs) {
    return {
      status: "MISSING",
      reason: "SHORT_HISTORY",
      detail: `이력 ${series.length}점이 최소 ${spec.minObs}점에 못 미친다`,
      horizons: [],
    };
  }

  const values = clippedValues(series, spec);
  const obsForFreq = HORIZON_OBS[freq];
  const weights = HORIZON_WEIGHTS[axis] as Record<string, number>;

  const horizons: HorizonOutcome[] = [];
  let usedWeight = 0;
  let weighted = 0;

  for (const [key, weight] of Object.entries(weights) as [HorizonKey, number][]) {
    const w = obsForFreq[key];
    if (w === undefined) {
      horizons.push({
        key,
        status: "MISSING",
        weight,
        reason: `${freq} 주기에는 ${key} 창이 없다`,
      });
      continue;
    }
    const means = rollingMeans(values, w);
    if (means.length < HORIZON_GUARD.minWindows) {
      horizons.push({
        key,
        status: "MISSING",
        weight,
        reason: `창이 ${means.length}개뿐이다(최소 ${HORIZON_GUARD.minWindows})`,
      });
      continue;
    }
    // ⚠ 겹친 창은 거의 같은 값이다. 개수가 아니라 **겹치지 않는 창의 수**를 본다.
    const nonOverlap = Math.floor(values.length / w);
    if (nonOverlap < HORIZON_GUARD.minNonOverlap) {
      horizons.push({
        key,
        status: "MISSING",
        weight,
        reason:
          `겹치지 않는 창이 ${nonOverlap}개뿐이다(최소 ${HORIZON_GUARD.minNonOverlap}) — ` +
          "창이 많아 보여도 독립 관측은 이만큼이다",
      });
      continue;
    }
    const value = pctRankOf(means, means[means.length - 1]);
    horizons.push({ key, status: "OK", weight, obs: w, windows: means.length, value });
    usedWeight += weight;
    weighted += weight * value;
  }

  if (usedWeight < HORIZON_GUARD.minHorizonCoverage) {
    return {
      status: "MISSING",
      reason: "THIN_WINDOWS",
      detail:
        `쓸 수 있는 창의 가중치가 ${usedWeight.toFixed(2)}뿐이다(최소 ${HORIZON_GUARD.minHorizonCoverage}) — ` +
        "남은 창으로 축을 대표할 수 없다",
      horizons,
    };
  }

  // ⚠ 남은 창으로 **재정규화**한다. 못 쓴 창을 0으로 치면 점수가 아래로 끌린다.
  const pctRank = weighted / usedWeight;
  const score = spec.polarity === -1 ? 100 - pctRank : pctRank;

  return {
    status: "OK",
    pctRank,
    score,
    horizonCoverage: usedWeight,
    horizons,
    obsDate: series[series.length - 1].date,
    obsCount: series.length,
  };
}

/** 세 축을 한 번에. 쓰지 않는 축은 `NOT_APPLICABLE`로 채워진다. */
export function allAxes(
  points: SeriesPoint[],
  spec: NormalizeSpec,
  freq: Freq,
  asOf: string,
): Record<Axis, AxisOutcome> {
  return {
    tide: axisScore(points, spec, freq, "tide", asOf),
    wind: axisScore(points, spec, freq, "wind", asOf),
    wave: axisScore(points, spec, freq, "wave", asOf),
  };
}
