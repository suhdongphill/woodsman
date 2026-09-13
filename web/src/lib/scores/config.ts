/**
 * 점수 정의 — **가중치는 여기에만 있다.** Score Calculation Specification v1.0 §6~§41 · §46.
 *
 * ## 명세 §54와 다르게 한 것 — 그리고 왜
 * 명세는 `/config/scores.yaml` + Python을 권한다. 이 사이트는 **Cloudflare Workers + TypeScript**이고,
 * Worker는 실행 중에 파일을 읽지 못한다(`wrangler.jsonc`를 못 읽는 것과 같은 이유 — CLAUDE.md §2-1).
 * 그래서 **뜻은 그대로 지키고 형식만 바꿨다**:
 * - ⭐ 가중치·임계값은 **이 데이터 파일 한 곳**에만 있다. 계산 코드(`composite.ts` 등)는 숫자를 모른다.
 * - ⭐ 가중치를 바꾸면 `MODEL_VERSION`을 올린다 — 옛 점수는 옛 버전으로 남고 조용히 다시 계산하지 않는다.
 * - ⚠ 테스트가 **점수마다 가중치 합 = 1.00**을 강제한다. 명세의 식을 옮기다 틀리면 여기서 깨진다.
 *
 * ## ⚠ 이 파일은 「무엇을 합치나」까지다
 * 각 구성요소를 **어느 계열로 채우는가**(그리고 못 채우는가)는 `inputs.ts`가 정한다. 여기서 구성요소 이름이 있다고
 * 데이터가 있다는 뜻이 아니다 — 못 채우면 결측으로 세고 커버리지가 떨어진다(명세 §44).
 */

export const MODEL_VERSION = "v1.0";

export type ScoreKey =
  | "ai_demand"
  | "ai_productivity"
  | "capital_formation"
  | "private_credit"
  | "fiscal_transmission"
  | "global_liquidity"
  | "fed_liquidity"
  | "treasury_liquidity"
  | "funding"
  | "credit_liquidity"
  | "rate_liquidity"
  | "rate_absorption"
  | "rate_breakout_shock"
  | "rate_adaptation"
  | "long_rate_discipline"
  | "capital_competition"
  | "engine_heat"
  | "market_stress"
  | "geopolitical_stress"
  | "market_risk_geopolitical"
  | "risk_transmission"
  | "capital_engine"
  | "ai_capital_sustainability"
  | "circular_financing_risk"
  | "fiscal_dominance_pressure"
  | "monetary_discipline"
  | "debasement_expectation"
  | "dollar_network"
  | "crypto_flow";

export type ScoreDefinition = {
  /** 명세 절 번호 */
  spec: string;
  label: string;
  /** 높을수록 무엇인가 — 화면이 점수 옆에 적는다 */
  highMeans: string;
  /** 구성요소 → 가중치. ⚠ 합은 1.00(테스트) */
  components: Record<string, number>;
  /**
   * 구성요소가 **다른 점수**인 경우 그 키. 합성 순서를 정할 때 쓴다(하위 점수부터).
   * 예: global_liquidity.fed_system → "fed_liquidity"
   */
  subScores?: Record<string, ScoreKey>;
};

export const SCORE_DEFINITIONS: Record<ScoreKey, ScoreDefinition> = {
  ai_demand: {
    spec: "§6",
    label: "AI Demand Pressure",
    highMeans: "AI 투자수요 압력이 강하다",
    components: {
      hyperscaler_capex: 0.25,
      data_center_construction: 0.15,
      semiconductor_capex: 0.15,
      power_grid_demand: 0.15,
      ai_corporate_financing: 0.1,
      ai_equipment_price_pressure: 0.1,
      ai_labor_demand: 0.1,
    },
  },
  ai_productivity: {
    spec: "§7",
    label: "AI Productivity Supply",
    highMeans: "AI 투자가 실제 공급능력으로 전환되고 있다",
    components: {
      nonfarm_productivity: 0.25,
      inverted_ulc: 0.2,
      output_per_hour: 0.15,
      real_output_per_worker: 0.15,
      ai_adoption: 0.1,
      tfp_proxy: 0.1,
      bottleneck_relief: 0.05,
    },
  },
  capital_formation: {
    spec: "§9",
    label: "Productive Capital Formation",
    highMeans: "생산적 자본형성이 활발하다",
    components: {
      business_fixed_investment: 0.25,
      equipment_investment: 0.15,
      ip_investment: 0.15,
      data_center_investment: 0.15,
      semiconductor_fab_investment: 0.1,
      power_infrastructure_investment: 0.1,
      r_and_d: 0.1,
    },
  },
  private_credit: {
    spec: "§10",
    label: "Private Credit Creation",
    highMeans: "민간 신용창출이 활발하다",
    components: {
      ci_loan_growth: 0.25,
      corporate_bond_issuance: 0.2,
      private_credit_growth: 0.15,
      deposit_growth: 0.15,
      inverted_lending_standards: 0.15,
      credit_impulse: 0.1,
    },
  },
  fiscal_transmission: {
    spec: "§11",
    label: "Fiscal Transmission",
    highMeans: "재정이 민간 생산능력으로 전달되고 있다",
    components: {
      fiscal_impulse: 0.2,
      government_procurement: 0.15,
      infrastructure_spending: 0.15,
      private_income_growth: 0.1,
      corporate_profit_growth: 0.1,
      deposit_growth: 0.1,
      private_capex_response: 0.2,
    },
  },
  global_liquidity: {
    spec: "§12",
    label: "Global Liquidity Score",
    highMeans: "시스템 유동성이 넉넉하다",
    components: {
      fed_system: 0.25,
      treasury: 0.2,
      funding: 0.15,
      credit: 0.15,
      rates_market: 0.15,
      global_dollar: 0.1,
    },
    subScores: {
      fed_system: "fed_liquidity",
      treasury: "treasury_liquidity",
      funding: "funding",
      credit: "credit_liquidity",
      rates_market: "rate_liquidity",
    },
  },
  fed_liquidity: {
    spec: "§13",
    label: "Fed System Liquidity",
    highMeans: "연준 쪽 시스템 유동성이 넉넉하다",
    components: {
      reserve_balances: 0.35,
      fed_balance_sheet_impulse: 0.2,
      rrp_release: 0.15,
      srf_availability: 0.1,
      funding_stability: 0.1,
      emergency_liquidity_adjustment: 0.1,
    },
  },
  treasury_liquidity: {
    spec: "§14",
    label: "Treasury Liquidity",
    highMeans: "재무부 쪽 흐름이 유동성에 우호적이다",
    components: {
      inverted_tga_change: 0.3,
      bill_coupon_mix: 0.2,
      net_issuance_pressure: 0.15,
      buyback_market_support: 0.1,
      auction_quality: 0.1,
      treasury_market_functioning: 0.15,
    },
  },
  funding: {
    spec: "§15",
    label: "Funding Liquidity",
    highMeans: "단기 자금시장이 안정적이다",
    components: {
      inverted_sofr_iorb: 0.35,
      repo_stability: 0.2,
      cross_currency_basis: 0.2,
      srf_utilization_condition: 0.15,
      funding_volatility: 0.1,
    },
  },
  credit_liquidity: {
    spec: "§16",
    label: "Credit Liquidity",
    highMeans: "신용시장이 열려 있다",
    components: {
      inverted_hy_oas: 0.35,
      inverted_ig_oas: 0.2,
      corporate_issuance: 0.15,
      bank_credit_growth: 0.15,
      credit_availability: 0.15,
    },
  },
  rate_liquidity: {
    spec: "§17",
    label: "Rates / Market Liquidity",
    highMeans: "국채시장 기능이 원활하다",
    components: {
      inverted_move: 0.25,
      treasury_market_depth: 0.2,
      real_yield_condition: 0.2,
      term_premium_condition: 0.15,
      auction_quality: 0.1,
      curve_functioning: 0.1,
    },
  },
  rate_absorption: {
    spec: "§18",
    label: "Rate Absorption Capacity",
    highMeans: "경제·기업이 지금 금리를 감당할 수익과 생산성을 만들고 있다",
    components: {
      earnings_yield_spread: 0.25,
      productivity_real_yield: 0.2,
      nominal_growth_10y: 0.15,
      eps_growth: 0.15,
      roic_funding_spread: 0.1,
      credit_stability: 0.1,
      breadth_recovery: 0.05,
    },
  },
  rate_breakout_shock: {
    spec: "§23",
    label: "Rate Breakout Shock",
    highMeans: "시장이 새 금리 수준을 소화하지 못하고 있다",
    components: {
      yield_breakout_magnitude: 0.3,
      move_response: 0.25,
      equity_drawdown: 0.2,
      credit_spread_response: 0.15,
      dollar_response: 0.1,
    },
  },
  rate_adaptation: {
    spec: "§24",
    label: "Rate Adaptation",
    highMeans: "시장이 새 금리를 흡수해 가고 있다",
    components: {
      equity_recovery: 0.25,
      eps_estimate_stability: 0.2,
      credit_spread_normalization: 0.2,
      vix_move_normalization: 0.15,
      breadth_recovery: 0.1,
      funding_stability: 0.1,
    },
  },
  long_rate_discipline: {
    spec: "§28",
    label: "Long-Rate Discipline",
    highMeans: "장기금리가 경제의 수익성과 균형을 이루고 있다",
    components: {
      rate_absorption_capacity: 0.25,
      productivity_real_yield: 0.2,
      growth_funding_spread: 0.15,
      inverted_term_premium_stress: 0.15,
      inverted_move: 0.1,
      corporate_funding_spread: 0.1,
      mortgage_stress: 0.05,
    },
    subScores: { rate_absorption_capacity: "rate_absorption" },
  },
  capital_competition: {
    spec: "§29",
    label: "Capital Competition",
    highMeans: "자본 조달 경쟁(crowding-out) 위험이 크다",
    components: {
      treasury_net_issuance_pressure: 0.25,
      coupon_supply: 0.15,
      corporate_bond_supply: 0.15,
      ai_corporate_financing: 0.15,
      real_yield: 0.1,
      term_premium: 0.1,
      auction_stress: 0.1,
    },
  },
  engine_heat: {
    spec: "§30",
    label: "Engine Heat",
    highMeans: "물가 압력이 뜨겁다",
    components: {
      core_cpi: 0.15,
      core_pce: 0.15,
      ppi: 0.1,
      wage_pressure: 0.1,
      ulc: 0.1,
      energy: 0.15,
      ai_resource_heat: 0.1,
      inflation_expectations: 0.1,
      real_yield_pressure: 0.05,
    },
  },
  market_stress: {
    spec: "§31",
    label: "Market Stress",
    highMeans: "금융시장 스트레스가 크다",
    components: {
      vix_stress: 0.2,
      move_stress: 0.2,
      credit_stress: 0.2,
      funding_stress: 0.15,
      tail_risk: 0.1,
      equity_breadth_stress: 0.1,
      fx_funding_stress: 0.05,
    },
  },
  geopolitical_stress: {
    spec: "§31",
    label: "Geopolitical Stress",
    highMeans: "지정학 스트레스가 크다",
    components: {
      gpr: 0.35,
      oil_shock: 0.3,
      shipping_supply_disruption: 0.15,
      safe_haven_flow: 0.1,
      persistence: 0.1,
    },
  },
  market_risk_geopolitical: {
    spec: "§31",
    label: "Market Risk & Geopolitical Stress",
    highMeans: "시장·지정학 위험이 크다",
    components: { market_stress: 0.7, geopolitical_stress: 0.3 },
    subScores: { market_stress: "market_stress", geopolitical_stress: "geopolitical_stress" },
  },
  risk_transmission: {
    spec: "§32",
    label: "Risk Transmission",
    highMeans: "충격이 여러 시장으로 번지고 있다",
    components: {
      shock_origin: 0.2,
      inflation_transmission: 0.2,
      rate_transmission: 0.15,
      credit_transmission: 0.15,
      equity_transmission: 0.1,
      funding_transmission: 0.1,
      persistence_breadth: 0.1,
    },
  },
  capital_engine: {
    spec: "§33",
    label: "Capital Engine",
    highMeans: "자본 엔진이 생산적으로 돌고 있다",
    components: {
      productive_capital_formation: 0.2,
      private_credit_creation: 0.15,
      ai_productivity_supply: 0.2,
      fiscal_transmission: 0.1,
      global_liquidity: 0.15,
      long_rate_discipline: 0.1,
      financial_stability: 0.1,
    },
    subScores: {
      productive_capital_formation: "capital_formation",
      private_credit_creation: "private_credit",
      ai_productivity_supply: "ai_productivity",
      fiscal_transmission: "fiscal_transmission",
      global_liquidity: "global_liquidity",
      long_rate_discipline: "long_rate_discipline",
    },
  },
  ai_capital_sustainability: {
    spec: "§34",
    label: "AI Capital Sustainability",
    highMeans: "AI 투자가 스스로 굴러갈 수익 기반이 있다",
    components: {
      revenue_growth: 0.2,
      fcf_growth: 0.15,
      roic: 0.15,
      utilization: 0.15,
      ai_monetization: 0.1,
      interest_coverage: 0.1,
      inverted_debt_dependence: 0.1,
      power_availability: 0.05,
    },
  },
  circular_financing_risk: {
    spec: "§35",
    label: "Circular Financing Risk",
    highMeans: "순환 금융 위험이 크다",
    components: {
      vendor_financing: 0.2,
      strategic_cross_investment: 0.2,
      gpu_backed_debt: 0.15,
      project_debt: 0.15,
      private_credit_dependence: 0.15,
      customer_concentration: 0.15,
    },
  },
  fiscal_dominance_pressure: {
    spec: "§36",
    label: "Fiscal Dominance Pressure",
    highMeans: "재정이 금융조건에 가하는 압력이 크다(연준 종속을 뜻하지 않는다)",
    components: {
      deficit_pressure: 0.25,
      net_treasury_supply: 0.2,
      interest_expense: 0.15,
      term_premium: 0.15,
      debt_service_ratio: 0.1,
      auction_stress: 0.1,
      foreign_demand_weakness: 0.05,
    },
  },
  monetary_discipline: {
    spec: "§37",
    label: "Monetary Discipline Pressure",
    highMeans: "통화 긴축 압력이 크다",
    components: {
      inflation_persistence: 0.25,
      core_inflation: 0.15,
      wage_ulc_pressure: 0.15,
      real_yield: 0.15,
      fed_reaction_function: 0.15,
      inflation_expectations: 0.1,
      energy_shock: 0.05,
    },
  },
  debasement_expectation: {
    spec: "§38",
    label: "Debasement Expectation",
    highMeans: "통화가치 하락 기대가 크다",
    components: {
      fiscal_deterioration: 0.2,
      real_rate_condition: 0.15,
      monetary_expansion: 0.15,
      currency_weakness: 0.1,
      inflation_expectations: 0.1,
      gold_confirmation: 0.1,
      btc_confirmation: 0.1,
      central_bank_gold_demand: 0.1,
    },
  },
  dollar_network: {
    spec: "§39",
    label: "Dollar Network Power",
    highMeans: "달러 네트워크의 구조적 우위가 강하다",
    components: {
      global_reserve_share: 0.15,
      international_payment_share: 0.15,
      dollar_credit_share: 0.15,
      offshore_dollar_funding: 0.1,
      treasury_safe_asset_demand: 0.15,
      stablecoin_dollar_network: 0.15,
      global_dollar_liquidity: 0.1,
      fx_stability: 0.05,
    },
  },
  crypto_flow: {
    spec: "§41",
    label: "Crypto Institutional Flow",
    highMeans: "기관 자금이 크립토로 들어오고 있다",
    components: {
      btc_etf_flow: 0.35,
      eth_etf_flow: 0.15,
      flow_persistence: 0.2,
      aum_trend: 0.15,
      btc_eth_rotation: 0.1,
      market_liquidity: 0.05,
    },
  },
};

/** 명세 §8 — AI Inflation Gap 구간(점수가 아니라 두 점수의 뺄셈 · BIPOLAR). */
export const AI_INFLATION_GAP_BANDS = [
  { min: 30, label: "AI Demand Overheating" },
  { min: 15, label: "Demand Ahead of Productivity" },
  { min: -14, label: "Balanced AI Expansion" },
  { min: -29, label: "Productivity Catch-Up" },
  { min: -Infinity, label: "Supply-Led Disinflation" },
] as const;

/** 명세 §53 — v1.0에서 반드시 계산 가능해야 하는 점수. */
export const V1_PRIORITY: (ScoreKey | "ai_inflation_gap")[] = [
  "global_liquidity",
  "capital_engine",
  "ai_demand",
  "ai_productivity",
  "ai_inflation_gap",
  "engine_heat",
  "long_rate_discipline",
  "rate_absorption",
  "rate_breakout_shock",
  "rate_adaptation",
  "private_credit",
  "capital_competition",
  "market_risk_geopolitical",
  "risk_transmission",
];
