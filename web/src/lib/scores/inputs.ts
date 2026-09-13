/**
 * 점수 구성요소 → **실제로 채울 계열** — 그리고 못 채우는 이유. Score Calculation Specification v1.0 §44.
 *
 * ## 왜 따로 두나
 * `config.ts`는 명세의 식(무엇을 합치나)이고, 이 파일은 **우리가 가진 데이터로 무엇을 채울 수 있나**다.
 * 둘을 섞으면 「구성요소 이름이 있다 = 데이터가 있다」로 읽힌다.
 *
 * ## ⚠ 규칙
 * - 채울 수 없는 구성요소는 **이유를 적는다**. 화면과 커버리지 보고가 그 문장을 그대로 쓴다.
 * - ⚠ **대체 입력은 대체라고 적는다**(`substitute`) — 설계서 결정 ②(이름을 바꿔 대체).
 * - ⚠ 명세가 **같은 계열을 두 번** 세는 자리는 한 번만 채우고 나머지는 이유를 적는다(이중 계산 금지).
 * - `status: "planned"`는 **다음 조각에서 붙일 것**이다. 지금은 결측으로 센다 — 계획을 데이터로 치지 않는다.
 * - 이 파일은 **지금(2026-09-14, 점수 엔진 기준)** 의 사실이다. 계열을 붙이면 여기를 고치고, 커버리지 보고가 따라 바뀐다.
 * - ⚠ **실제로 어떤 숫자로 재나**는 `measures.ts`, 계산은 `engine.ts`다. 여기서 `available`이어도 역사가 5년이 안 되면 엔진이 결측으로 센다.
 */
import { SCORE_DEFINITIONS, type ScoreKey } from "./config";
import { COVERAGE_PUBLISH, COVERAGE_RENORMALIZE, publishState, type PublishState } from "./composite";

export type ComponentSource =
  /** 카탈로그 지표로 채운다 */
  | { status: "available"; indicators: string[]; substitute?: string; note?: string }
  /** 이미 있는 계산(`lib/macro/capital.ts` 등)으로 채운다 */
  | { status: "computed"; from: string; note?: string }
  /** 다른 점수(하위 점수)로 채운다 — 그 점수가 발행될 때만 */
  | { status: "subscore"; score: ScoreKey }
  /** 다음 조각에서 붙인다 — 지금은 결측 */
  | { status: "planned"; slice: string; reason: string }
  /** 채울 수 없다 */
  | { status: "unavailable"; reason: string };

const NO_FREE = (what: string) => ({ status: "unavailable" as const, reason: `무료 공개 출처 없음 — ${what}` });
const UNDEFINED_IN_SPEC = (what: string) => ({
  status: "unavailable" as const,
  reason: `명세에 산식·입력 정의가 없다 — ${what}`,
});

/**
 * ⚠ 명세 §53 우선 점수와 그 하위 점수만 채웠다. 나머지 점수(§34~§41)는 아직 매핑하지 않았다 —
 *   매핑이 없는 점수는 커버리지 보고에서 「매핑 전」으로 나온다(0%로 지어내지 않는다).
 */
export const SCORE_INPUTS: Partial<Record<ScoreKey, Record<string, ComponentSource>>> = {
  engine_heat: {
    core_cpi: { status: "available", indicators: ["core_cpi_yoy"] },
    core_pce: { status: "available", indicators: ["core_pce_yoy"] },
    ppi: { status: "available", indicators: ["ppi_yoy"] },
    wage_pressure: { status: "available", indicators: ["wages_yoy"] },
    ulc: { status: "available", indicators: ["ulc_yoy"] },
    energy: { status: "available", indicators: ["brent", "wti", "natgas"] },
    ai_resource_heat: UNDEFINED_IN_SPEC("AI Resource Heat(전력·장비·반도체 가격 중 무엇인가)"),
    inflation_expectations: { status: "available", indicators: ["bei10", "infl_exp_5y"] },
    real_yield_pressure: { status: "available", indicators: ["real10"] },
  },

  private_credit: {
    ci_loan_growth: { status: "available", indicators: ["ci_loans_yoy"] },
    corporate_bond_issuance: { status: "planned", slice: "R2b", reason: "연준 Z.1 회사채 순발행 계열을 확인하지 않았다" },
    private_credit_growth: NO_FREE("private credit(사모대출) 잔액"),
    deposit_growth: { status: "available", indicators: ["deposits_yoy"] },
    inverted_lending_standards: { status: "available", indicators: ["sloos_ci"] },
    credit_impulse: { status: "planned", slice: "R3", reason: "은행 총신용(bank_credit_yoy)에서 계산할 수 있으나 파생을 아직 만들지 않았다" },
  },

  fed_liquidity: {
    reserve_balances: { status: "available", indicators: ["reserves"] },
    fed_balance_sheet_impulse: { status: "available", indicators: ["fed_assets"] },
    rrp_release: { status: "available", indicators: ["rrp"], note: "⚠ 국내 ON RRP만 — 해외 공적 풀(rrp_foreign)은 넣지 않는다" },
    srf_availability: { status: "planned", slice: "R2b", reason: "상설 레포(SRF) 이용 계열(뉴욕 연준)을 확인하지 않았다" },
    funding_stability: { status: "available", indicators: ["sofr_iorb"] },
    emergency_liquidity_adjustment: UNDEFINED_IN_SPEC("긴급대출 조정의 부호·패널티 규칙"),
  },

  treasury_liquidity: {
    inverted_tga_change: { status: "available", indicators: ["tga"], note: "수요일 잔액(WDTGAL) — 주간 평균(WTREGEN)이 아니다" },
    bill_coupon_mix: {
      status: "unavailable",
      reason: "⚠ 방향 미정 — 표시만 하고 점수에 넣지 않는다(운영자 결정 2026-09-14 · 볼트 8/25 검증: 재무부 쪽 순효과 부호 미정)",
    },
    net_issuance_pressure: { status: "planned", slice: "R3", reason: "시장성 국채 총액 변화 파생을 아직 만들지 않았다(MSPD 합계는 받는다)" },
    buyback_market_support: { status: "planned", slice: "R2b", reason: "재무부 바이백 결과(Fiscal Data)" },
    auction_quality: { status: "available", indicators: ["auction10y_btc"], note: "명목 10년물만(TIPS 제외)" },
    treasury_market_functioning: UNDEFINED_IN_SPEC("국채시장 기능(무엇으로 재나)"),
  },

  funding: {
    inverted_sofr_iorb: { status: "available", indicators: ["sofr_iorb"] },
    repo_stability: UNDEFINED_IN_SPEC("레포 안정성(SOFR 분산인가, 거래량인가)"),
    cross_currency_basis: NO_FREE("통화 스왑 베이시스"),
    srf_utilization_condition: { status: "planned", slice: "R2b", reason: "상설 레포(SRF) 이용 계열을 확인하지 않았다" },
    funding_volatility: { status: "planned", slice: "R3", reason: "SOFR에서 계산할 수 있으나 파생을 아직 만들지 않았다" },
  },

  credit_liquidity: {
    inverted_hy_oas: {
      status: "available",
      indicators: ["baa_spread"],
      substitute: "HY OAS(ICE BofA)는 FRED에 2023-09 이후만 있어 명세 §1 최소 창(5년)을 못 채운다 — Baa−10년 국채 금리차(1986~)로 대체",
    },
    inverted_ig_oas: {
      status: "unavailable",
      reason: "IG OAS는 FRED에 2023-09 이후만 있어 최소 창(5년) 미달 — 대체 후보 Baa−10Y는 HY 자리에 이미 썼다(한 점수 안에서 같은 계열을 두 번 세지 않는다)",
    },
    corporate_issuance: { status: "planned", slice: "R2b", reason: "연준 Z.1 회사채 순발행 계열을 확인하지 않았다" },
    bank_credit_growth: { status: "available", indicators: ["bank_credit_yoy"] },
    credit_availability: { status: "available", indicators: ["sloos_ci"] },
  },

  rate_liquidity: {
    inverted_move: { status: "planned", slice: "R2b", reason: "MOVE는 ICE 라이선스 — 국채 실현변동성(ZN=F)으로 대체 예정(MOVE라 부르지 않는다)" },
    treasury_market_depth: NO_FREE("국채 호가 깊이"),
    real_yield_condition: { status: "available", indicators: ["real10"] },
    term_premium_condition: { status: "available", indicators: ["term_premium"] },
    auction_quality: {
      status: "unavailable",
      reason: "⚠ 명세 중복 — 같은 입찰 응찰률을 §14 Treasury Liquidity에서 이미 센다(GLS 안에서 두 번 세지 않는다)",
    },
    curve_functioning: { status: "available", indicators: ["t10y2y", "t30y2y"] },
  },

  global_liquidity: {
    fed_system: { status: "subscore", score: "fed_liquidity" },
    treasury: { status: "subscore", score: "treasury_liquidity" },
    funding: { status: "subscore", score: "funding" },
    credit: { status: "subscore", score: "credit_liquidity" },
    rates_market: { status: "subscore", score: "rate_liquidity" },
    global_dollar: { status: "available", indicators: ["dxy"], note: "cross-currency basis 없이 달러인덱스만" },
  },

  ai_productivity: {
    nonfarm_productivity: { status: "available", indicators: ["prod_yoy"] },
    inverted_ulc: { status: "available", indicators: ["ulc_yoy"] },
    output_per_hour: {
      status: "unavailable",
      reason: "⚠ 명세 중복 — 비농업 노동생산성이 곧 시간당 산출(BLS OPHNFB)이다. 한 계열을 25%+15%로 두 번 세지 않는다",
    },
    real_output_per_worker: { status: "available", indicators: ["output_per_worker_yoy"] },
    ai_adoption: { status: "planned", slice: "R9", reason: "인구조사국 BTOS(AI 사용 기업 비율) 어댑터" },
    tfp_proxy: { status: "unavailable", reason: "총요소생산성은 연간·2023년까지(RTFPNAUSA632NRUG) — 분기 점수에 쓰면 늘 낡은 값" },
    bottleneck_relief: UNDEFINED_IN_SPEC("병목 완화(무엇으로 재나)"),
  },

  ai_demand: {
    hyperscaler_capex: { status: "planned", slice: "R9", reason: "SEC EDGAR XBRL(설비투자) 어댑터" },
    data_center_construction: { status: "planned", slice: "R9", reason: "인구조사국 건설지출 「Data center」 — 확인 필요" },
    semiconductor_capex: { status: "planned", slice: "R9", reason: "EDGAR — 미국 상장사만 가능" },
    power_grid_demand: { status: "available", indicators: ["power_ip_yoy"], note: "⚠ AI 전용이 아니라 전체 전력 수요 — 날씨로도 움직인다" },
    ai_corporate_financing: NO_FREE("AI 기업 자금조달 집계"),
    ai_equipment_price_pressure: { status: "available", indicators: ["semi_ppi_yoy"], note: "⚠ 품질 조정으로 원래 내려가는 지수 — 하락 폭 축소가 신호다" },
    ai_labor_demand: NO_FREE("AI 인력 수요"),
  },

  rate_absorption: {
    earnings_yield_spread: NO_FREE("S&P 500 선행 EPS"),
    productivity_real_yield: { status: "computed", from: "lib/macro/capital.ts · PRYS", note: "BIPOLAR — 원값을 함께 낸다" },
    nominal_growth_10y: { status: "computed", from: "lib/macro/capital.ts · 성장–조달 격차", note: "BIPOLAR — 원값을 함께 낸다" },
    eps_growth: {
      status: "available",
      indicators: ["corp_profits_yoy"],
      substitute: "선행 EPS 성장 대신 실현 법인이익(NIPA·세후) 전년비 — 「기업이익(실현)」이라 부른다",
    },
    roic_funding_spread: { status: "planned", slice: "R3", reason: "자본수익률 근사 계열 확인 필요 · 조달비용은 baa_yield로 가능" },
    credit_stability: { status: "available", indicators: ["baa_spread", "hy_spread"] },
    breadth_recovery: { status: "planned", slice: "R3", reason: "섹터 ETF 13개 중 200일선 위 비율(섹터 폭) — 파생 미구현" },
  },

  long_rate_discipline: {
    rate_absorption_capacity: { status: "subscore", score: "rate_absorption" },
    productivity_real_yield: { status: "computed", from: "lib/macro/capital.ts · PRYS" },
    growth_funding_spread: { status: "computed", from: "lib/macro/capital.ts · 성장–조달 격차" },
    inverted_term_premium_stress: { status: "available", indicators: ["term_premium"] },
    inverted_move: { status: "planned", slice: "R2b", reason: "국채 실현변동성(MOVE 아님)" },
    corporate_funding_spread: { status: "available", indicators: ["baa_spread"] },
    mortgage_stress: { status: "available", indicators: ["mortgage30"] },
  },

  capital_competition: {
    treasury_net_issuance_pressure: { status: "planned", slice: "R3", reason: "시장성 국채 총액 변화 파생을 아직 만들지 않았다(MSPD 합계는 받는다)" },
    coupon_supply: { status: "available", indicators: ["tsy_coupon_share"] },
    corporate_bond_supply: { status: "planned", slice: "R2b", reason: "연준 Z.1 확인 필요" },
    ai_corporate_financing: NO_FREE("AI 기업 자금조달 집계"),
    real_yield: { status: "available", indicators: ["real10"] },
    term_premium: { status: "available", indicators: ["term_premium"] },
    auction_stress: { status: "available", indicators: ["auction10y_btc"], note: "명목 10년물 응찰률 — 꼬리(발표 직전 금리 대비)는 무료 자료가 없어 아직 못 잰다" },
  },

  capital_formation: {
    business_fixed_investment: { status: "available", indicators: ["pnfi_yoy"], note: "명목" },
    equipment_investment: {
      status: "available",
      indicators: ["equipment_inv_yoy"],
      note: "⚠ 명세 구성상 겹친다 — 비주거 고정투자(PNFI) 총액 안에 장비가 들어 있다(설계서 11-4)",
    },
    ip_investment: {
      status: "available",
      indicators: ["ip_inv_yoy"],
      note: "⚠ 명세 구성상 겹친다 — PNFI 총액 안에 지식재산이 들어 있다(설계서 11-4)",
    },
    data_center_investment: { status: "planned", slice: "R9", reason: "인구조사국 건설지출 「Data center」 — 확인 필요" },
    semiconductor_fab_investment: { status: "planned", slice: "R9", reason: "민간 제조업 건설(PRMFGCONS)에 fab이 크게 찍히지만 fab만은 아니다 — 대리로 쓸지 결정 필요" },
    power_infrastructure_investment: NO_FREE("전력 인프라 투자 집계"),
    r_and_d: { status: "planned", slice: "R3", reason: "BEA 연구개발 투자 계열을 확인하지 않았다(지식재산 투자에 일부 포함)" },
  },

  market_stress: {
    vix_stress: { status: "available", indicators: ["vix", "vvix"] },
    move_stress: { status: "planned", slice: "R2b", reason: "국채 실현변동성(MOVE 아님)" },
    credit_stress: { status: "available", indicators: ["hy_spread", "baa_spread"] },
    funding_stress: { status: "available", indicators: ["sofr_iorb"] },
    tail_risk: { status: "available", indicators: ["skew"] },
    equity_breadth_stress: { status: "planned", slice: "R3", reason: "섹터 폭 파생 미구현" },
    fx_funding_stress: NO_FREE("통화 스왑 베이시스"),
  },

  geopolitical_stress: {
    gpr: { status: "planned", slice: "R10", reason: "Caldara–Iacoviello GPR(무료 · 인용 의무) 어댑터" },
    oil_shock: { status: "available", indicators: ["brent", "wti"] },
    shipping_supply_disruption: NO_FREE("해운 운임·차질 지수"),
    safe_haven_flow: { status: "available", indicators: ["gold", "dxy"] },
    persistence: UNDEFINED_IN_SPEC("지속성(며칠 이어져야 하나)"),
  },

  market_risk_geopolitical: {
    market_stress: { status: "subscore", score: "market_stress" },
    geopolitical_stress: { status: "subscore", score: "geopolitical_stress" },
  },
};

export type CoverageRow = {
  score: ScoreKey;
  spec: string;
  /** 매핑이 없는 점수 */
  mapped: boolean;
  coverage: number;
  state: PublishState | "NOT_MAPPED";
  missing: { component: string; weight: number; reason: string }[];
};

function isFilled(src: ComponentSource | undefined, published: Map<ScoreKey, boolean>): boolean {
  if (!src) return false;
  if (src.status === "available" || src.status === "computed") return true;
  if (src.status === "subscore") return published.get(src.score) === true;
  return false;
}

function reasonOf(src: ComponentSource | undefined, published: Map<ScoreKey, boolean>): string {
  if (!src) return "매핑 없음";
  switch (src.status) {
    case "planned":
      return `${src.slice}에서 붙인다 — ${src.reason}`;
    case "unavailable":
      return src.reason;
    case "subscore":
      return published.get(src.score) ? "" : `하위 점수 ${src.score}가 발행 기준(${COVERAGE_PUBLISH}%) 미달`;
    default:
      return "";
  }
}

/**
 * ⭐ **지금 데이터로 무엇을 발행할 수 있나** — 명세 §44 규칙을 매핑에 그대로 건다.
 * ⚠ 값이 아니라 **입력 가용성**만 본다(계열은 있어도 오늘 값이 낡았을 수 있다 — 그건 신뢰도 §42의 몫).
 * 하위 점수는 먼저 계산하고, 발행 못 하는 하위 점수는 부모에서 결측으로 센다.
 */
export function coverageReport(): CoverageRow[] {
  const published = new Map<ScoreKey, boolean>();
  const rows = new Map<ScoreKey, CoverageRow>();

  const visit = (key: ScoreKey): CoverageRow => {
    const done = rows.get(key);
    if (done) return done;
    const def = SCORE_DEFINITIONS[key];
    const inputs = SCORE_INPUTS[key];
    if (!inputs) {
      const row: CoverageRow = { score: key, spec: def.spec, mapped: false, coverage: 0, state: "NOT_MAPPED", missing: [] };
      rows.set(key, row);
      published.set(key, false);
      return row;
    }
    for (const src of Object.values(inputs)) if (src.status === "subscore") visit(src.score);

    const total = Object.values(def.components).reduce((s, w) => s + w, 0);
    let available = 0;
    const missing: CoverageRow["missing"] = [];
    for (const [component, weight] of Object.entries(def.components)) {
      const src = inputs[component];
      if (isFilled(src, published)) available += weight;
      else missing.push({ component, weight, reason: reasonOf(src, published) });
    }
    const coverage = Math.round((available / total) * 1000) / 10;
    const state = publishState(coverage);
    const row: CoverageRow = { score: key, spec: def.spec, mapped: true, coverage, state, missing };
    rows.set(key, row);
    published.set(key, state !== "DO_NOT_PUBLISH");
    return row;
  };

  (Object.keys(SCORE_DEFINITIONS) as ScoreKey[]).forEach(visit);
  return [...rows.values()];
}

export { COVERAGE_PUBLISH, COVERAGE_RENORMALIZE };
