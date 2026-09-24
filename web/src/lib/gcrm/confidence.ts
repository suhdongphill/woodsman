/**
 * GCRM v2 — 신뢰도 (명세 §2-7). 순수 함수.
 *
 * ```text
 * confidence = 100 × ( 0.360·coverage
 *                    + 0.225·mean(staleness)
 *                    + 0.180·mean(evidence)
 *                    + 0.135·channel_breadth
 *                    + 0.100·mean(depth) )
 *
 * channel_breadth = min(1, 확인된 서로 다른 채널 수 / 4)
 * depth           = min(1, 쓴 관측 수 / 창이 요구하는 관측 수)   ← 2026-09-24 추가
 * ```
 *
 * ## ⚠ `depth`는 커버리지가 못 잡는 것을 잡는다
 * 커버리지는 **값이 있으면 켜진 것으로 센다** — 3.2년짜리 지표도 온전히 1로 들어간다.
 * 창을 20년으로 통일한 뒤(`WINDOW_OBS`)에도 소급이 불가능해 못 채우는 지표가 남으므로,
 * **「말한 창을 얼마나 채웠나」**를 따로 센다. ⚠ 못 채운 것을 **빼지 않는다** — 쓰되 신뢰도를 깎는다.
 * 빼면 커버리지가 떨어져 게이트에 걸리고, 그러면 **짧은 자료를 가진 기둥이 통째로 사라진다.**
 *
 * ## ⚠ 점수와 신뢰도를 **절대 곱하지 않는다**
 * 나란히 표시할 뿐이다. 곱하면 「자료가 부족한 위험 신호」가 「위험이 작다」로 읽힌다 —
 * 대부분의 대시보드가 여기서 실패한다(명세 Part 5 ②).
 *
 * ## ⚠ 화면에는 퍼센트가 아니라 **밴드**로 적는다 (§D-1)
 * 같은 사이트의 버블 모니터가 「0·1·2 세 칸으로만 채점합니다. 지표 절반이 숫자가 아니라 판단이라,
 * 소수점을 붙이면 없는 정밀도가 생깁니다」라고 써 놓았다.
 * 그 옆에서 `신뢰도 91%`를 띄우면 **한 사이트 안에 정밀도 철학이 두 개**가 된다.
 *
 * ## ⚠ 결측은 평균에서 빠진다
 * 신선도·근거 계수의 평균은 **실제로 쓴 지표**로만 낸다. 못 쓴 지표를 0으로 넣으면
 * 커버리지가 이미 센 것을 두 번 세게 된다.
 */
import { CONFIDENCE_WEIGHTS, CONFIDENCE_BANDS } from "./config/model";
import { CHANNEL_BREADTH_DENOMINATOR } from "./config/channels";
import type { ChannelCode } from "./config/indicators";

export type ConfidenceInput = {
  /** 0~1 */
  coverage: number;
  /** ⚠ **쓴 지표의** 신선도 계수들. 빈 배열이면 평균을 내지 않는다 */
  stalenessFactors: number[];
  /** ⚠ **쓴 지표의** 근거 계수들 */
  evidenceFactors: number[];
  /** 확인된 채널(중복 무관 — 서로 다른 것만 센다) */
  channels: ChannelCode[];
  /**
   * ⚠ **쓴 지표의** 창 충족 비율(0~1). 빈 배열이면 평균을 내지 않는다.
   * 부르는 쪽이 `min(1, obsCount / maxWindow)`로 만들어 넘긴다 — 이 함수는 설정을 읽지 않는다.
   */
  depthFactors: number[];
};

export type ConfidenceResult = {
  /** 0~100. ⚠ 내부 저장용이다. 화면은 `band`를 쓴다 */
  value: number;
  band: string;
  parts: {
    coverage: number;
    staleness: number;
    evidence: number;
    channelBreadth: number;
    depth: number;
  };
};

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

export function channelBreadth(channels: ChannelCode[]): number {
  return Math.min(1, new Set(channels).size / CHANNEL_BREADTH_DENOMINATOR);
}

export function confidenceOf(input: ConfidenceInput): ConfidenceResult {
  const coverage = Math.min(1, Math.max(0, input.coverage));
  const staleness = mean(input.stalenessFactors);
  const evidence = mean(input.evidenceFactors);
  const breadth = channelBreadth(input.channels);
  const depth = mean(input.depthFactors);

  const value =
    100 *
    (CONFIDENCE_WEIGHTS.coverage * coverage +
      CONFIDENCE_WEIGHTS.staleness * staleness +
      CONFIDENCE_WEIGHTS.evidence * evidence +
      CONFIDENCE_WEIGHTS.channelBreadth * breadth +
      CONFIDENCE_WEIGHTS.depth * depth);

  return {
    value,
    band: confidenceBand(value),
    parts: { coverage, staleness, evidence, channelBreadth: breadth, depth },
  };
}

export function confidenceBand(value: number): string {
  for (const b of CONFIDENCE_BANDS) if (value >= b.min) return b.label;
  return CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1].label;
}

/**
 * 화면용 점수 표기 — **5점 단위 정수** (§D-1 · `DISPLAY.roundToNearest`).
 * ⚠ 내부 저장은 소수 2자리다. 이 함수는 **보여 줄 때만** 쓴다.
 */
export function displayScore(value: number, roundTo = 5): number {
  return Math.round(value / roundTo) * roundTo;
}
