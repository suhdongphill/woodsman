/**
 * 구성요소를 **어떻게 재나** — 계열 · 측정(수준/변화) · 방향 · 종류. Score Calculation Specification v1.0 §3·§4.
 *
 * ## 세 파일의 역할
 * - `config.ts` — 명세의 식(무엇을 얼마나 합치나). 가중치.
 * - `inputs.ts` — 우리 데이터로 채울 수 있나 없나, 없으면 왜.
 * - **이 파일** — 채울 수 있는 구성요소를 **실제로 어떤 숫자로** 재나. ⚠ 명세가 정하지 않은 자리라 **Woodsman 설계 v0**이다.
 *
 * ## ⚠ 이 파일의 판단은 우리가 정한 가정이다 — 설계서 12장에 이유와 함께 적는다
 * - 「Impulse」「Release」「Change」라고 적힌 구성요소는 **91일 변화**로 잰다(주간·일간 계열의 한 분기).
 * - 명세 §17 「단순 10Y yield level을 그대로 negative 처리하지 않는다」 → 실질금리는 **수준이 아니라 변화**로 잰다.
 * - ⚠ **상태에 따라 뜻이 뒤집히는 계열**은 조건을 건다(`guard`) — 국내 역레포는 고갈 구간(약 1,000억 달러 미만)이면
 *   「감소 = 유동성 공급」이 성립하지 않으므로 **점수를 내지 않는다**(지표 카드의 stateDependency와 같은 문장).
 *
 * ⚠ 이 파일에 적힌 계열은 `inputs.ts`에서 그 구성요소가 `available`로 적힌 계열이어야 한다(테스트가 대조한다).
 */
import type { ScoreKey } from "./config";

export type Measure =
  /** 최신 값 그대로 */
  | "level"
  /** 최신 값 − 91일 전 값(그보다 이전 중 가장 가까운 점) */
  | "change91d";

export type IndicatorMeasure = {
  indicator: string;
  measure: Measure;
  direction: "HIGH_IS_POSITIVE" | "HIGH_IS_NEGATIVE";
  /** 명세 §4 — 스트레스 지표는 수준 0.60 · 모멘텀 0.40 */
  kind: "general" | "stress";
  /**
   * 이 조건이면 **점수를 내지 않는다**(결측 + 이유). 최신 수준값을 받는다.
   * ⚠ 뜻이 뒤집히는 구간에서 숫자를 계속 내면, 점수가 반대 방향을 가리킨다.
   */
  guard?: { below: number; reason: string };
};

/** 점수 → 구성요소 → 측정 목록(여러 계열이면 **평균**한다). */
export const SCORE_MEASURES: Partial<Record<ScoreKey, Record<string, IndicatorMeasure[]>>> = {
  fed_liquidity: {
    reserve_balances: [{ indicator: "reserves", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    fed_balance_sheet_impulse: [{ indicator: "fed_assets", measure: "change91d", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    rrp_release: [
      {
        indicator: "rrp",
        measure: "change91d",
        // 역레포가 **줄면** 그 돈이 시장으로 나간 것이다 — 감소가 유동성 공급.
        direction: "HIGH_IS_NEGATIVE",
        kind: "general",
        guard: {
          below: 0.1,
          reason: "국내 역레포가 고갈 구간(1,000억 달러 미만)이다 — 이 구간의 감소는 유동성 공급이 아니라 완충장치 소멸이라 점수를 내지 않는다",
        },
      },
    ],
    funding_stability: [{ indicator: "sofr_iorb", measure: "level", direction: "HIGH_IS_NEGATIVE", kind: "stress" }],
  },

  treasury_liquidity: {
    // TGA가 **줄면** 재무부가 돈을 쓴 것이다 — 감소가 유동성에 우호적.
    inverted_tga_change: [{ indicator: "tga", measure: "change91d", direction: "HIGH_IS_NEGATIVE", kind: "general" }],
    auction_quality: [{ indicator: "auction10y_btc", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
  },

  funding: {
    inverted_sofr_iorb: [{ indicator: "sofr_iorb", measure: "level", direction: "HIGH_IS_NEGATIVE", kind: "stress" }],
  },

  credit_liquidity: {
    inverted_hy_oas: [{ indicator: "baa_spread", measure: "level", direction: "HIGH_IS_NEGATIVE", kind: "stress" }],
    bank_credit_growth: [{ indicator: "bank_credit_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    credit_availability: [{ indicator: "sloos_ci", measure: "level", direction: "HIGH_IS_NEGATIVE", kind: "general" }],
  },

  rate_liquidity: {
    // ⚠ 명세 §17 — 금리 수준을 그대로 나쁘다고 치지 않는다. **빠르게 오르는 것**을 스트레스로 본다.
    real_yield_condition: [{ indicator: "real10", measure: "change91d", direction: "HIGH_IS_NEGATIVE", kind: "general" }],
    term_premium_condition: [{ indicator: "term_premium", measure: "level", direction: "HIGH_IS_NEGATIVE", kind: "general" }],
    // ⚠ 가정: 곡선이 깊게 역전될수록 금리시장 기능이 긴장돼 있다고 본다(Woodsman v0).
    curve_functioning: [{ indicator: "t10y2y", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
  },

  global_liquidity: {
    // 달러가 **빠르게 강해지면** 해외 달러 조달이 빡빡해진다.
    global_dollar: [{ indicator: "dxy", measure: "change91d", direction: "HIGH_IS_NEGATIVE", kind: "general" }],
  },

  engine_heat: {
    core_cpi: [{ indicator: "core_cpi_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    core_pce: [{ indicator: "core_pce_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    ppi: [{ indicator: "ppi_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    wage_pressure: [{ indicator: "wages_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    ulc: [{ indicator: "ulc_yoy", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
    energy: [
      { indicator: "brent", measure: "change91d", direction: "HIGH_IS_POSITIVE", kind: "general" },
      { indicator: "natgas", measure: "change91d", direction: "HIGH_IS_POSITIVE", kind: "general" },
    ],
    inflation_expectations: [
      { indicator: "bei10", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" },
      { indicator: "infl_exp_5y", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" },
    ],
    real_yield_pressure: [{ indicator: "real10", measure: "level", direction: "HIGH_IS_POSITIVE", kind: "general" }],
  },
};
