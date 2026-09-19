/**
 * GCRM v2 — 정규화 엔진 (명세 §2-3). 순수 함수. React·DB·환경 의존 없음.
 *
 * ## 하는 일
 * ```text
 * 원시 계열 ──as_of로 자르기──→ 포털 변환 ──GCRM 변환──→ 창 자르기(maxWindow)
 *          ──winsor 절단──→ 백분위(또는 zscore_cdf) ──polarity──→ 0~100
 * ```
 * 결과는 **「자본에 우호적일수록 높다」** 한 축으로 통일된다(단계 0 원칙 2).
 *
 * ## ⚠ point-in-time — 이 파일의 존재 이유
 * **as_of 시점 이후의 데이터가 계산에 들어가면 백테스트 전체가 무효다.**
 * 그래서 가장 먼저 자른다. 변환보다 먼저 자르는 이유는 두 가지다.
 * 1. `applyTransform`은 과거만 보므로 자르는 순서가 결과를 바꾸지 않는다(테스트가 확인한다)
 * 2. 그래도 **먼저** 자른다 — 나중에 미래를 보는 변환이 추가되면 순서가 유일한 방어선이 된다
 *
 * ⚠ 여기서 막는 것은 **관측일 누수**다. 「그날 알려져 있던 값인가」(발표 지연·통계 수정)는
 *   한 층 위의 문제이고 `lib/macro/vintage.ts`의 `valuesAsOf`가 푼다. 부르는 쪽이 책임진다 —
 *   이 함수는 **받은 계열이 이미 그날의 빈티지**라고 믿는다. 경계를 흐리면 둘 다 안 지켜진다.
 *
 * ## ⚠ 왜 백분위가 기본인가
 * 금융 지표는 꼬리가 두껍다. z-score는 2008년 같은 구간에서 −6σ를 만들고, 그 하나가 기둥 전체를
 * 지배한다. 백분위는 상한·하한이 자연히 0과 100이라 그 지배가 **구조적으로 불가능**하다.
 * 대신 극단의 강도를 잃으므로, 급성 경보는 백분위가 아니라 **원시값 임계**로 따로 판정한다
 * (`config/promotion.ts`의 `ACUTE`).
 *
 * ## ⚠ 계산할 수 없으면 계산하지 않는다
 * 이력이 `minObs`에 못 미치거나 값이 한 번도 변하지 않았으면 **예외가 아니라 `MISSING`**을 돌려준다.
 * 50점으로 메우면 「평범하다」는 판정을 지어내는 것이다(포털 버블 모니터·v1 엔진과 같은 원칙).
 */
import { applyTransform } from "@/lib/macro/series";
import { dropFuturePoints } from "@/lib/macro/observed";
import type { SeriesPoint } from "@/lib/macro/series";
import type { MacroTransform } from "@/lib/macro/types";
import type { GcrmIndicator } from "./config/indicators";

/** 정규화에 필요한 것만. ⚠ `GcrmIndicator`를 그대로 받지 않는다 — 테스트가 지표 정의에 매이면 안 된다. */
export type NormalizeSpec = {
  /** 레지스트리가 거는 변환(원값 → 화면 값). */
  portalTransform: MacroTransform;
  /** 그 위에 GCRM이 **더** 거는 변환. 보통 `level`. */
  transform: "level" | "yoy" | "mom" | "diff" | "ratio";
  polarity: 1 | -1;
  scaler: "pct_rank" | "zscore_cdf";
  window: "expanding" | "rolling";
  minObs: number;
  maxWindow: number;
  winsor: [number, number];
};

/** 지표 정의에서 정규화 사양만 뽑는다. */
export function specOf(ind: GcrmIndicator): NormalizeSpec {
  return {
    portalTransform: ind.portalTransform as MacroTransform,
    transform: ind.transform,
    polarity: ind.polarity,
    scaler: ind.scaler,
    window: ind.window,
    minObs: ind.minObs,
    maxWindow: ind.maxWindow,
    winsor: ind.winsor,
  };
}

export type MissingReason =
  /** as_of까지 관측이 하나도 없다 */
  | "NO_DATA"
  /** 이력이 minObs에 못 미친다 */
  | "SHORT_HISTORY"
  /** ⚠ 값이 한 번도 변하지 않았다 — 백분위에 뜻이 없다 */
  | "ZERO_VARIANCE";

export type NormalizedPoint =
  | {
      status: "OK";
      /** 작업 계열의 as_of 시점 값. **winsor 적용 전**이다 — 화면이 보여 주는 것은 이 값이다 */
      rawValue: number;
      /** winsor로 자른 뒤의 값. 순위를 매긴 것은 이쪽이다 */
      clippedValue: number;
      /** 0~100. ⚠ **polarity 적용 전**이다 */
      pctRank: number;
      /** 0~100. polarity 적용 후 — 높을수록 자본에 우호 */
      score: number;
      /** 이 값의 관측일. ⚠ as_of와 다를 수 있다(일간 계열도 T+1이다) */
      obsDate: string;
      /** 분포를 이룬 관측 수 */
      obsCount: number;
      historyStart: string;
      /** winsor가 실제로 잘랐는가 */
      clipped: boolean;
    }
  | {
      status: "MISSING";
      reason: MissingReason;
      /** ⚠ 화면과 커버리지 보고가 이 문장을 그대로 쓴다. 「없다」와 「못 쟀다」가 같아 보이면 안 된다 */
      detail: string;
      obsCount: number;
    };

/**
 * GCRM이 추가로 거는 변환. ⚠ 전부 **과거만** 본다.
 *
 * ⚠ `yoy`는 **1년 전**과 비교한다 — 바로 앞 점이 아니다.
 *   처음에 `mom`과 같은 가지에 넣어 두었는데, 그러면 일간 계열의 「전년비」가 **전일비**가 된다.
 *   날짜를 맞춰 1년 전을 찾는 일은 `lib/macro/series.ts`의 `applyTransform`이 이미 한다
 *   (주간 계열이 1년 전 같은 요일이 아니어서 통째로 비던 2026-09-14 버그까지 거기서 고쳐져 있다).
 *   같은 판단을 두 곳에 두지 않는다.
 */
function gcrmTransform(points: SeriesPoint[], tf: NormalizeSpec["transform"]): SeriesPoint[] {
  if (tf === "level") return points;
  if (tf === "yoy") return applyTransform(points, "yoy");
  const out: SeriesPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].value;
    const cur = points[i].value;
    if (tf === "diff") out.push({ date: points[i].date, value: cur - prev });
    else if (tf === "ratio" && prev !== 0) out.push({ date: points[i].date, value: cur / prev });
    else if (tf === "mom" && prev !== 0)
      out.push({ date: points[i].date, value: ((cur - prev) / Math.abs(prev)) * 100 });
  }
  return out;
}

/**
 * 작업 계열(working series)을 만든다 — 정규화 직전까지.
 *
 * ⚠ 순서가 규칙이다: **자르기 → 포털 변환 → GCRM 변환 → 창 상한**.
 */
export function workingSeries(points: SeriesPoint[], spec: NormalizeSpec, asOf: string): SeriesPoint[] {
  // ⚠ 오름차순을 전제하는 변환이 뒤에 온다. repository가 정렬해 주지만 믿고 넘어가지 않는다.
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const { kept } = dropFuturePoints(sorted, asOf);
  const transformed = gcrmTransform(applyTransform(kept, spec.portalTransform), spec.transform);
  // `expanding`도 상한이 있다(명세 §2-3의 max_window). 최근 N개만 남긴다.
  return transformed.length > spec.maxWindow ? transformed.slice(-spec.maxWindow) : transformed;
}

/** `q` 분위수. 선형 보간(R의 type 7 · numpy 기본과 같다). ⚠ 입력은 **정렬돼 있어야** 한다. */
export function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

/**
 * 백분위 순위 — **중간 순위(midrank)**를 쓴다.
 *
 * ```text
 * pct_rank = (작은 값의 수 + 0.5 × 같은 값의 수) / 전체 × 100
 * ```
 * ⚠ 「작은 값의 수 / 전체」를 쓰면 최솟값이 0, 최댓값이 `(n−1)/n`이 되어 **위아래가 비대칭**이 된다.
 * 중간 순위는 1..n 균등분포에서 최솟값 `0.5/n`, 최댓값 `(n−0.5)/n`으로 대칭이고,
 * 같은 값이 여럿일 때도 한쪽으로 쏠리지 않는다.
 */
export function pctRankOf(values: number[], value: number): number {
  const n = values.length;
  if (n === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return ((below + 0.5 * equal) / n) * 100;
}

/**
 * 표준정규 누적분포 Φ(z).
 * Abramowitz–Stegun 26.2.17 (|오차| < 7.5e-8). ⚠ 근사이므로 소수 6자리까지만 믿는다.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** 평균·표본표준편차. */
function meanSd(values: number[]): { mean: number; sd: number } {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance) };
}

/**
 * 한 지표의 as_of 시점 점수.
 *
 * @param points 원시 계열(`MacroPoint`). ⚠ **그날의 빈티지**여야 한다(위 머리말 참조).
 * @param asOf   `YYYY-MM-DD`
 */
export function normalize(points: SeriesPoint[], spec: NormalizeSpec, asOf: string): NormalizedPoint {
  const series = workingSeries(points, spec, asOf);

  if (series.length === 0) {
    return { status: "MISSING", reason: "NO_DATA", detail: `${asOf}까지 관측이 없다`, obsCount: 0 };
  }

  // ⚠ minObs는 **실제 계열 길이**로 판정한다. 설정의 `points`는 조사 시점의 스냅숏이라
  //   판정에 쓰면 오래된 사실로 오늘을 재게 된다(설정에는 표시·경고용으로만 둔다).
  if (series.length < spec.minObs) {
    return {
      status: "MISSING",
      reason: "SHORT_HISTORY",
      detail: `이력 ${series.length}점이 최소 ${spec.minObs}점에 못 미친다 — 분포를 만들 수 없다`,
      obsCount: series.length,
    };
  }

  const values = series.map((p) => p.value);
  const sorted = [...values].sort((a, b) => a - b);

  if (sorted[0] === sorted[sorted.length - 1]) {
    return {
      status: "MISSING",
      reason: "ZERO_VARIANCE",
      detail: "값이 한 번도 변하지 않았다 — 백분위에 뜻이 없다. 50점으로 메우지 않는다",
      obsCount: series.length,
    };
  }

  // winsor — 분포와 대상 값을 **같은 경계로** 자른다. 한쪽만 자르면 순위가 어긋난다.
  const [loQ, hiQ] = spec.winsor;
  const lo = quantile(sorted, loQ);
  const hi = quantile(sorted, hiQ);
  const clip = (v: number) => Math.min(hi, Math.max(lo, v));
  const clippedValues = values.map(clip);

  const last = series[series.length - 1];
  const rawValue = last.value;
  const clippedValue = clip(rawValue);

  let pctRank: number;
  if (spec.scaler === "zscore_cdf") {
    const { mean, sd } = meanSd(clippedValues);
    // ⚠ 자른 뒤에도 분산이 0이면 z를 만들 수 없다. 위에서 걸러지지만 방어로 둔다.
    pctRank = sd === 0 ? NaN : normalCdf((clippedValue - mean) / sd) * 100;
    if (!Number.isFinite(pctRank)) {
      return {
        status: "MISSING",
        reason: "ZERO_VARIANCE",
        detail: "절단 후 분산이 0이다 — z를 만들 수 없다",
        obsCount: series.length,
      };
    }
  } else {
    pctRank = pctRankOf(clippedValues, clippedValue);
  }

  // ⚠ polarity는 **마지막**이다. 뒤집은 뒤에는 raw와 섞지 않는다(단계 0 원칙 2).
  const score = spec.polarity === -1 ? 100 - pctRank : pctRank;

  return {
    status: "OK",
    rawValue,
    clippedValue,
    pctRank,
    score,
    obsDate: last.date,
    obsCount: series.length,
    historyStart: series[0].date,
    clipped: clippedValue !== rawValue,
  };
}
