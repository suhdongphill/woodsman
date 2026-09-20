/**
 * GCRM v2 — 기둥 구성 (명세 §2-5 · §B-1 · §B-2).
 *
 * ## 이 파일이 답하는 것
 * 「기둥 점수를 만들 때 **어느 지표에 얼마의 무게**를 주는가」.
 *
 * ## ⚠ v1 엔진의 구성을 출발점으로 삼았다 (사용자 결정 2026-09-19)
 * 가중치를 새로 지어내지 않았다. `lib/scores/config.ts`(점수계산명세 v1.0 §6~§41)의
 * **구성요소와 그 가중치를 그대로 두고**, 각 구성요소를 포털 계열에 붙였다(`lib/scores/inputs.ts` 대조).
 * 그래서 이 파일은 **평탄한 가중치 목록이 아니라 트리**다 — 숫자가 어디서 왔는지 보이지 않으면
 * 나중에 고칠 수가 없다. 평탄화는 `flattenPillar()`가 곱셈 한 번으로 한다.
 *
 * ## ⚠ 못 채우는 자리를 지우지 않는다
 * v1이 「무료 출처 없음」으로 남긴 구성요소는 `unavailable`로 **분모에 남긴다.**
 * 지워 버리면 커버리지가 언제나 100%가 되고, 「안 본 것」이 「괜찮은 것」이 된다
 * (포털 버블 모니터가 지키는 원칙과 같다 — `CLAUDE.md` §6).
 * 따라서 **설계 가중치의 합은 1.00이고, 그중 채울 수 있는 비율이 구조적 커버리지**다.
 *
 * ## ⚠ 한 지표가 기둥마다 뜻이 달라지는 경우
 * 달러인덱스는 유동성 기둥에서 −1(강달러 = 역외 조달 압박)이고 달러 네트워크 기둥에서는 +1이다.
 * `indicators.ts`에서 뒤집지 않고 **여기서 `polarity`를 덮어쓴다.** 덮어쓸 때는 `polarityReason`이
 * 반드시 있어야 한다(검증기가 강제한다) — 이유 없는 부호 뒤집기가 가장 찾기 어려운 버그다.
 *
 * ## ⚠ 같은 기둥 안에서 같은 지표를 두 번 세지 않는다
 * v1에도 중복이 있었다(§14와 §17이 같은 입찰 응찰률을 센다 — `inputs.ts`가 그중 하나를 끈다).
 * `flattenPillar()`는 같은 지표의 무게를 **합쳐 한 줄로** 만들고, 검증기가 결과의 고유성을 확인한다.
 * 기둥 **사이**의 중복은 막지 않는다 — 다른 질문에 같은 증거가 쓰이는 것은 정상이다.
 * 하나의 충격을 여러 번 세는 문제는 여기가 아니라 **채널**이 막는다(§2-10).
 */
import type { Axis } from "./model";

/** 명세 §B-1 — 기둥이 향하는 방향. 집계할 때 `stress`는 `100 − s`로 뒤집힌다. */
export type PillarPolarity = "favorable" | "stress";

export type PillarNode =
  /** 포털 계열로 채우는 자리. 여러 개면 무게를 **균등 분할**한다. */
  | {
      kind: "indicators";
      weight: number;
      indicators: string[];
      /** ⚠ 기둥 한정 부호 덮어쓰기. 쓰면 `polarityReason` 필수. */
      polarity?: 1 | -1;
      polarityReason?: string;
      note?: string;
    }
  /** 채울 수 없는 자리. **분모에 남는다.** */
  | { kind: "unavailable"; weight: number; reason: string }
  /** v1이 하위 점수로 묶은 자리 — 트리를 그대로 옮긴다. */
  | { kind: "group"; weight: number; members: Record<string, PillarNode> };

export type GcrmPillar = {
  code: string;
  nameKo: string;
  polarity: PillarPolarity;
  /**
   * 이 기둥이 레짐 축 점수에 기여하는 무게. ⚠ 10개 합 = 1.00 (테스트가 확인).
   *
   * ⚠ **전부 0.10 — 균등이다** (운영자 결정 2026-09-19).
   * 처음에 .18/.14/.12… 로 차등을 뒀는데 **그 차등에 근거가 없었다**(명세에도 v1 엔진에도 없다).
   * 기준이 명확하지 않으면 균등으로 둔다 — **근거 없는 차등보다 근거 없는 균등이 정직하다.**
   * 차등을 되살리려면 근거를 먼저 만든다(민감도 분석 P9 · 공행성 기반 추정).
   * 출처 대장: `provenance.ts`의 `axis_weight_pillars`.
   */
  axisWeight: number;
  /**
   * 기둥을 화면용 스칼라 하나로 접을 때 쓰는 시간축 가중치 (§B-2 — 명세 §4 표의 정체).
   * ⚠ 이것은 **총점 산식이 아니다.** 총점은 `model.ts`의 `AXIS_WEIGHTS`가 쓴다.
   */
  summaryWeights: Record<Axis, number>;
  /** v1 점수계산명세에서 가져온 자리. 출처를 적어 둔다. */
  from: string;
  members: Record<string, PillarNode>;
};

const CORE: Record<Axis, number> = { tide: 0.5, wind: 0.35, wave: 0.15 };
/** 구조 지표로 이뤄진 기둥 — 파도로 읽을 것이 없다. ⚠ 0을 준 자리는 `MISSING`이 아니라 **무게 0**이다. */
const SLOW: Record<Axis, number> = { tide: 0.7, wind: 0.3, wave: 0 };

export const GCRM_PILLARS: GcrmPillar[] = [
  // ──────────────────────────────────────────────────────────────────────
  {
    code: "liquidity",
    nameKo: "유동성",
    polarity: "favorable",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §12 Global Liquidity — 하위 점수 트리를 그대로 옮겼다",
    members: {
      fed_system: {
        kind: "group",
        weight: 0.25,
        members: {
          reserve_balances: { kind: "indicators", weight: 0.35, indicators: ["reserves"] },
          fed_balance_sheet_impulse: { kind: "indicators", weight: 0.2, indicators: ["fed_assets"] },
          rrp_release: { kind: "indicators", weight: 0.15, indicators: ["rrp"] },
          srf_availability: {
            kind: "unavailable",
            weight: 0.1,
            reason: "상설 레포(SRF) 이용 계열(뉴욕 연준)을 아직 확인하지 않았다 — v1도 같은 상태",
          },
          funding_stability: { kind: "indicators", weight: 0.1, indicators: ["sofr_iorb"] },
          emergency_liquidity_adjustment: {
            kind: "unavailable",
            weight: 0.1,
            reason: "명세에 부호·패널티 규칙이 없다 — 긴급대출을 유동성 증가로 셀지 스트레스로 셀지 미정",
          },
        },
      },
      treasury: {
        kind: "group",
        weight: 0.2,
        members: {
          inverted_tga_change: { kind: "indicators", weight: 0.3, indicators: ["tga"] },
          bill_coupon_mix: {
            kind: "unavailable",
            weight: 0.2,
            reason: "⚠ 부호 미정 — 단기물 비중 확대는 듀레이션 부담 완화이자 차환 위험이다(운영자 결정 2026-09-14)",
          },
          net_issuance_pressure: {
            kind: "unavailable",
            weight: 0.15,
            reason: "시장성 국채 총액 변화 파생을 아직 만들지 않았다(MSPD 합계는 받고 있다)",
          },
          buyback_market_support: {
            kind: "unavailable",
            weight: 0.1,
            reason: "재무부 바이백은 정식 API가 아니다. ⚠ 수동 입력으로 돌리지 않는다 — 수동 지표는 결국 안 들어간다(조사 §4-2)",
          },
          auction_quality: { kind: "indicators", weight: 0.1, indicators: ["auction10y_btc"] },
          treasury_market_functioning: {
            kind: "unavailable",
            weight: 0.15,
            reason: "명세에 산식·입력 정의가 없다 — 국채시장 기능을 무엇으로 재는지",
          },
        },
      },
      funding: {
        kind: "group",
        weight: 0.15,
        members: {
          inverted_sofr_iorb: { kind: "indicators", weight: 0.35, indicators: ["sofr_iorb"] },
          repo_stability: { kind: "indicators", weight: 0.2, indicators: ["sofr_dispersion"] },
          cross_currency_basis: {
            kind: "unavailable",
            weight: 0.2,
            reason: "무료 공개 시계열 없음 — 통화 스왑 베이시스",
          },
          srf_utilization_condition: {
            kind: "unavailable",
            weight: 0.15,
            reason: "SRF 이용량(RPONTSYD)은 거의 매일 0이라 백분위가 뜻을 갖지 못한다",
          },
          funding_volatility: { kind: "indicators", weight: 0.1, indicators: ["sofr_rvol"] },
        },
      },
      credit: {
        kind: "group",
        weight: 0.15,
        members: {
          high_yield: {
            kind: "indicators",
            weight: 0.35,
            indicators: ["baa_spread", "hy_spread"],
            note: "⚠ v1은 이력이 짧아 baa_spread로 **대체**했다. GCRM은 둘을 함께 쓴다 — baa_spread가 1990년부터의 골격이고 hy_spread(2023~)가 최근을 더 예민하게 잰다",
          },
          investment_grade: {
            kind: "indicators",
            weight: 0.2,
            indicators: ["ig_spread"],
            note: "⚠ v1은 「최소 창 5년 미달」로 껐다. GCRM은 minObs 750(≈3년)이라 켤 수 있지만, 백분위는 3년 분포 위에 선다",
          },
          corporate_issuance: {
            kind: "unavailable",
            weight: 0.15,
            reason: "연준 Z.1 회사채 순발행 계열을 아직 확인하지 않았다",
          },
          bank_credit_growth: { kind: "indicators", weight: 0.15, indicators: ["bank_credit_yoy"] },
          credit_availability: { kind: "indicators", weight: 0.15, indicators: ["sloos_ci"] },
        },
      },
      rates_market: {
        kind: "group",
        weight: 0.15,
        members: {
          inverted_move: { kind: "indicators", weight: 0.25, indicators: ["ust10y_rvol"] },
          treasury_market_depth: {
            kind: "unavailable",
            weight: 0.2,
            reason: "무료 공개 출처 없음 — 국채 호가 깊이",
          },
          real_yield_condition: { kind: "indicators", weight: 0.2, indicators: ["real10"] },
          term_premium_condition: { kind: "indicators", weight: 0.15, indicators: ["term_premium"] },
          auction_quality_dup: {
            kind: "unavailable",
            weight: 0.1,
            reason: "⚠ v1 명세 중복 — 같은 입찰 응찰률을 §14에서 이미 셌다. 두 번 세지 않는다",
          },
          curve_functioning: { kind: "indicators", weight: 0.1, indicators: ["t10y2y", "t30y2y"] },
        },
      },
      global_dollar: { kind: "indicators", weight: 0.1, indicators: ["dxy"] },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "rate_absorption",
    nameKo: "금리 감내력",
    polarity: "favorable",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §18 Rate Absorption Capacity",
    members: {
      earnings_yield_spread: {
        kind: "unavailable",
        weight: 0.25,
        reason: "무료 공개 출처 없음 — S&P 500 선행 EPS",
      },
      productivity_real_yield: {
        kind: "indicators",
        weight: 0.2,
        indicators: ["prys"],
        note: "lib/macro/capital.ts가 이미 계산한다. 계열로 노출하면 켜진다(P1)",
      },
      nominal_growth_10y: {
        kind: "indicators",
        weight: 0.15,
        indicators: ["ngdp_yoy", "ust10y"],
        note: "성장 − 조달 격차. v1은 capital.ts의 계산을 썼고, 여기서는 두 성분을 함께 본다",
      },
      eps_growth: { kind: "indicators", weight: 0.15, indicators: ["corp_profits_yoy"] },
      roic_funding_spread: {
        kind: "unavailable",
        weight: 0.1,
        reason: "자본수익률 근사 계열이 없다(조달비용은 baa_yield로 가능하지만 한쪽만으로는 스프레드가 아니다)",
      },
      credit_stability: { kind: "indicators", weight: 0.1, indicators: ["baa_spread", "hy_spread"] },
      breadth_recovery: { kind: "indicators", weight: 0.05, indicators: ["sector_breadth"] },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "engine_power",
    nameKo: "엔진 출력",
    polarity: "favorable",
    axisWeight: 0.1,
    summaryWeights: SLOW,
    from: "v1 §9 Capital Formation · §7 AI Productivity · §10 Private Credit",
    members: {
      // ⚠ v1 §33 Capital Engine을 그대로 평탄화하지 않았다. 그 점수는 하위 점수 트리라
      //    global_liquidity·long_rate_discipline을 품고 있어, 평탄화하면 유동성 기둥과 크게 겹친다.
      //    같은 증거로 두 기둥을 채우면 총점이 한 요인에 끌려간다. 실물 성분 셋만 가져왔다.
      capital_formation: {
        kind: "group",
        weight: 0.45,
        members: {
          business_fixed_investment: { kind: "indicators", weight: 0.25, indicators: ["pnfi_yoy"] },
          equipment_investment: { kind: "indicators", weight: 0.15, indicators: ["equipment_inv_yoy"] },
          ip_investment: { kind: "indicators", weight: 0.15, indicators: ["ip_inv_yoy"] },
          data_center_investment: {
            kind: "unavailable",
            weight: 0.15,
            reason: "인구조사국 건설지출 「Data center」 계열을 아직 확인하지 않았다",
          },
          semiconductor_fab_investment: {
            kind: "unavailable",
            weight: 0.1,
            reason: "민간 제조업 건설(PRMFGCONS)에 fab이 크게 찍히지만 fab만 떼어낼 수 없다",
          },
          power_infrastructure_investment: {
            kind: "indicators",
            weight: 0.1,
            indicators: ["power_ip_yoy"],
            note: "⚠ 대체다 — v1은 「전력 인프라 투자 집계 없음」으로 껐다. 전력 생산지수는 투자가 아니라 가동의 흔적이다",
          },
          r_and_d: {
            kind: "unavailable",
            weight: 0.1,
            reason: "BEA 연구개발 투자 계열을 아직 확인하지 않았다(지식재산 투자에 일부 포함)",
          },
        },
      },
      ai_productivity: {
        kind: "group",
        weight: 0.35,
        members: {
          nonfarm_productivity: { kind: "indicators", weight: 0.25, indicators: ["prod_yoy"] },
          inverted_ulc: { kind: "indicators", weight: 0.2, indicators: ["ulc_yoy"] },
          output_per_hour: {
            kind: "unavailable",
            weight: 0.15,
            reason: "⚠ v1 명세 중복 — 비농업 노동생산성이 곧 시간당 산출이다(같은 BLS 계열)",
          },
          real_output_per_worker: { kind: "indicators", weight: 0.15, indicators: ["output_per_worker_yoy"] },
          ai_adoption: {
            kind: "unavailable",
            weight: 0.1,
            reason: "인구조사국 BTOS(AI 사용 기업 비율) 어댑터가 없다",
          },
          tfp_proxy: {
            kind: "unavailable",
            weight: 0.1,
            reason: "총요소생산성은 연간이고 2023년까지다 — 분기 축에 넣을 수 없다",
          },
          bottleneck_relief: {
            kind: "unavailable",
            weight: 0.05,
            reason: "명세에 산식·입력 정의가 없다",
          },
        },
      },
      private_credit: {
        kind: "group",
        weight: 0.2,
        members: {
          ci_loan_growth: { kind: "indicators", weight: 0.25, indicators: ["ci_loans_yoy"] },
          corporate_bond_issuance: {
            kind: "unavailable",
            weight: 0.2,
            reason: "연준 Z.1 회사채 순발행 계열을 아직 확인하지 않았다",
          },
          private_credit_growth: {
            kind: "unavailable",
            weight: 0.15,
            reason: "무료 공개 출처 없음 — 사모대출 잔액",
          },
          deposit_growth: { kind: "indicators", weight: 0.15, indicators: ["deposits_yoy"] },
          inverted_lending_standards: { kind: "indicators", weight: 0.15, indicators: ["sloos_ci"] },
          credit_impulse: {
            kind: "unavailable",
            weight: 0.1,
            reason: "은행 총신용에서 계산할 수 있으나 파생을 아직 만들지 않았다",
          },
        },
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "dollar_network",
    nameKo: "달러 네트워크 지배력",
    polarity: "favorable",
    axisWeight: 0.1,
    summaryWeights: SLOW,
    from: "v1 §39 Dollar Network Power (v1 inputs.ts에 매핑이 없어 여기서 처음 붙인다)",
    members: {
      global_reserve_share: { kind: "indicators", weight: 0.15, indicators: ["cofer"] },
      international_payment_share: {
        kind: "unavailable",
        weight: 0.15,
        reason: "SWIFT RMB Tracker는 공개 시계열이 아니다(월간 PDF)",
      },
      dollar_credit_share: {
        kind: "unavailable",
        weight: 0.15,
        reason: "BIS 국제은행통계 — 분기 · 어댑터 없음",
      },
      offshore_dollar_funding: {
        kind: "indicators",
        weight: 0.1,
        indicators: ["rrp_foreign"],
        polarity: 1,
        polarityReason:
          "⚠ 부호를 뒤집는다. 유동성 기둥에서 FIMA 풀 사용 증가는 역외 달러 부족(−1)이지만, 네트워크 지배력 관점에서는 **각국 중앙은행이 연준 창구에 의존한다는 증거**다(+1). 같은 사실을 다른 질문에 쓰는 것이다.",
      },
      treasury_safe_asset_demand: { kind: "indicators", weight: 0.15, indicators: ["auction10y_btc"] },
      stablecoin_dollar_network: {
        kind: "unavailable",
        weight: 0.15,
        reason: "무료 공개 시계열 없음 — 스테이블코인 발행 잔액",
      },
      global_dollar_liquidity: {
        kind: "indicators",
        weight: 0.1,
        indicators: ["dxy"],
        polarity: 1,
        polarityReason:
          "⚠ 부호를 뒤집는다. 유동성 기둥에서 강달러는 역외 조달을 조이지만(−1), 네트워크 지배력에서는 기축통화 수요의 확인이다(+1).",
      },
      fx_stability: {
        kind: "indicators",
        weight: 0.05,
        indicators: ["usdjpy", "usdcny"],
        polarity: 1,
        polarityReason: "⚠ 위와 같은 이유 — 상대통화 약세는 달러 네트워크 쪽에서는 지배력의 증거다.",
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "market_risk",
    nameKo: "시장위험·지정학",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §31 Market Risk & Geopolitical Stress (market 0.70 + geopolitical 0.30)",
    members: {
      market_stress: {
        kind: "group",
        weight: 0.7,
        members: {
          vix_stress: {
            kind: "indicators",
            weight: 0.2,
            indicators: ["vix", "vvix"],
            note: "⚠ 둘 다 PRICE 채널이다 — 확인 수를 셀 때 1표다(§2-10 · B-9)",
          },
          move_stress: { kind: "indicators", weight: 0.2, indicators: ["ust10y_rvol"] },
          credit_stress: { kind: "indicators", weight: 0.2, indicators: ["hy_spread", "baa_spread"] },
          funding_stress: { kind: "indicators", weight: 0.15, indicators: ["sofr_iorb"] },
          tail_risk: { kind: "indicators", weight: 0.1, indicators: ["skew"] },
          equity_breadth_stress: { kind: "indicators", weight: 0.1, indicators: ["sector_breadth"] },
          fx_funding_stress: {
            kind: "unavailable",
            weight: 0.05,
            reason: "무료 공개 출처 없음 — 통화 스왑 베이시스",
          },
        },
      },
      geopolitical_stress: {
        kind: "group",
        weight: 0.3,
        members: {
          gpr: { kind: "indicators", weight: 0.35, indicators: ["gpr"] },
          oil_shock: { kind: "indicators", weight: 0.3, indicators: ["brent", "wti"] },
          shipping_supply_disruption: {
            kind: "unavailable",
            weight: 0.15,
            reason: "무료 공개 출처 없음 — 해운 운임·차질 지수",
          },
          safe_haven_flow: { kind: "indicators", weight: 0.1, indicators: ["gold", "dxy"] },
          persistence: {
            kind: "unavailable",
            weight: 0.1,
            reason: "명세에 산식이 없다 — 며칠 이어져야 지속으로 볼지",
          },
        },
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "risk_transmission",
    nameKo: "위험 전이",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §32 Risk Transmission (v1 inputs.ts에 매핑이 없어 여기서 처음 붙인다)",
    members: {
      // ⚠ 이 기둥은 §2-10의 채널과 짝을 이룬다. 구성요소를 채널별로 갈라 두면
      //    「무엇이 번지고 있나」를 화면이 채널 배지로 그대로 보여 줄 수 있다.
      shock_origin: {
        kind: "unavailable",
        weight: 0.2,
        reason: "⚠ 계열이 아니라 판정이다 — 어느 채널에서 시작했는지는 신호 승격기(§2-11)가 정한다. 기둥 점수에 넣지 않는다",
      },
      inflation_transmission: { kind: "indicators", weight: 0.2, indicators: ["bei10", "infl_exp_5y"] },
      rate_transmission: { kind: "indicators", weight: 0.15, indicators: ["ust10y", "term_premium"] },
      credit_transmission: { kind: "indicators", weight: 0.15, indicators: ["hy_spread", "ig_spread"] },
      equity_transmission: { kind: "indicators", weight: 0.1, indicators: ["spx_etf", "vix"] },
      funding_transmission: { kind: "indicators", weight: 0.1, indicators: ["sofr_iorb", "sofr_dispersion"] },
      persistence_breadth: {
        kind: "unavailable",
        weight: 0.1,
        reason: "⚠ 계열이 아니라 판정이다 — 지속성과 폭은 신호 승격기가 센다",
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "engine_heat",
    nameKo: "엔진 온도",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §30 Engine Heat — 채움 가중치가 가장 높은 기둥이다(0.90)",
    members: {
      core_cpi: { kind: "indicators", weight: 0.15, indicators: ["core_cpi_yoy"] },
      core_pce: { kind: "indicators", weight: 0.15, indicators: ["core_pce_yoy"] },
      ppi: { kind: "indicators", weight: 0.1, indicators: ["ppi_yoy"] },
      wage_pressure: { kind: "indicators", weight: 0.1, indicators: ["wages_yoy"] },
      ulc: { kind: "indicators", weight: 0.1, indicators: ["ulc_yoy"] },
      energy: { kind: "indicators", weight: 0.15, indicators: ["brent", "wti", "natgas"] },
      ai_resource_heat: {
        kind: "unavailable",
        weight: 0.1,
        reason: "명세에 산식·입력 정의가 없다 — 전력·장비 가격을 어떻게 합칠지",
      },
      inflation_expectations: { kind: "indicators", weight: 0.1, indicators: ["bei10", "infl_exp_5y"] },
      real_yield_pressure: { kind: "indicators", weight: 0.05, indicators: ["real10"] },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "fiscal_dominance",
    nameKo: "재정 우위 압력",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: SLOW,
    from: "v1 §36 Fiscal Dominance Pressure (v1 inputs.ts에 매핑이 없어 여기서 처음 붙인다)",
    members: {
      deficit_pressure: {
        kind: "indicators",
        weight: 0.25,
        indicators: ["fed_outlays_receipts"],
        note: "⚠ 적자 **금액**이 아니라 지출÷세입이다(2026-09-20). 금액은 물가·경제 규모를 따라 커져 백분위가 늘 최악에 붙는다 — 움직이지 않는 지표는 기둥에 아무것도 보태지 않는다",
      },
      net_treasury_supply: {
        kind: "indicators",
        weight: 0.2,
        indicators: ["treasury_marketable"],
        note: "MSPD 시장성 국채 잔액의 전년비. ⚠ 잔액 자체는 거의 언제나 사상 최대라 수준이 아니라 **속도**로 본다",
      },
      interest_expense: {
        kind: "indicators",
        weight: 0.15,
        indicators: ["fed_interest_receipts"],
        note: "이자지출÷세입. ⚠ 아래 `debt_service_ratio`가 「원래는 이자지출/세입인데 분모를 못 본다」고 적어 둔 그 분모를 여기서 본다",
      },
      term_premium: { kind: "indicators", weight: 0.15, indicators: ["term_premium"] },
      debt_service_ratio: {
        kind: "indicators",
        weight: 0.1,
        indicators: ["total_debt_yoy"],
        note: "⚠ 대체다 — 원래는 이자지출/세입이다. 총부채 증가 속도는 그 대리일 뿐이고, 분모(세입)를 보지 못한다",
      },
      auction_stress: { kind: "indicators", weight: 0.1, indicators: ["auction10y_yield"] },
      foreign_demand_weakness: { kind: "indicators", weight: 0.05, indicators: ["rrp_foreign"] },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "monetary_discipline",
    nameKo: "통화 규율 압력",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: CORE,
    from: "v1 §37 Monetary Discipline Pressure (v1 inputs.ts에 매핑이 없어 여기서 처음 붙인다)",
    members: {
      inflation_persistence: { kind: "indicators", weight: 0.25, indicators: ["cpi_yoy", "core_cpi_yoy"] },
      core_inflation: { kind: "indicators", weight: 0.15, indicators: ["core_pce_yoy"] },
      wage_ulc_pressure: { kind: "indicators", weight: 0.15, indicators: ["wages_yoy", "ulc_yoy"] },
      real_yield: { kind: "indicators", weight: 0.15, indicators: ["real10"] },
      fed_reaction_function: {
        kind: "indicators",
        weight: 0.15,
        indicators: ["zq_front", "dff"],
        note: "선물이 보는 다음 달 실효금리와 실제 실효금리 — 둘의 거리가 곧 반응함수의 기울기다",
      },
      inflation_expectations: { kind: "indicators", weight: 0.1, indicators: ["bei10"] },
      energy_shock: { kind: "indicators", weight: 0.05, indicators: ["brent"] },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    code: "debasement",
    nameKo: "통화가치 희석 기대",
    polarity: "stress",
    axisWeight: 0.1,
    summaryWeights: SLOW,
    from: "v1 §38 Debasement Expectation (v1 inputs.ts에 매핑이 없어 여기서 처음 붙인다)",
    members: {
      fiscal_deterioration: { kind: "indicators", weight: 0.2, indicators: ["total_debt_yoy"] },
      real_rate_condition: { kind: "indicators", weight: 0.15, indicators: ["real10"] },
      monetary_expansion: { kind: "indicators", weight: 0.15, indicators: ["m2_yoy"] },
      currency_weakness: {
        kind: "indicators",
        weight: 0.1,
        indicators: ["dxy"],
        polarity: 1,
        polarityReason:
          "⚠ 부호를 뒤집는다. 희석 기대에서 스트레스는 **달러 약세**다 — 달러인덱스가 높을수록 이 기둥에서는 우호(+1).",
      },
      inflation_expectations: { kind: "indicators", weight: 0.1, indicators: ["bei10"] },
      gold_confirmation: { kind: "indicators", weight: 0.1, indicators: ["gold"] },
      btc_confirmation: {
        kind: "unavailable",
        weight: 0.1,
        reason: "비트코인 계열을 아직 받지 않는다(Yahoo BTC-USD로 가능 — P1 후보)",
      },
      central_bank_gold_demand: {
        kind: "unavailable",
        weight: 0.1,
        reason: "WGC 분기 자료는 공개 시계열이 아니다",
      },
    },
  },
];

export const GCRM_PILLAR_BY_CODE = new Map(GCRM_PILLARS.map((p) => [p.code, p]));

/** 평탄화 한 줄. `unavailable`은 지표 코드가 없다. */
export type FlatMember = {
  /** `indicators`면 지표 코드, `unavailable`이면 `null` */
  indicator: string | null;
  /** 곱해 내린 무게 */
  weight: number;
  /** 트리에서의 경로 — 화면이 「이 무게가 어디서 왔나」를 그대로 보여 준다 */
  path: string;
  polarity?: 1 | -1;
  polarityReason?: string;
  reason?: string;
  /** ⚠ 같은 기둥 안에서 같은 지표에 **다른 부호**를 준 자리. 검증기가 실패로 잡는다. */
  polarityConflict?: boolean;
};

/**
 * 트리를 곱해 평탄한 목록으로 만든다.
 *
 * - 자식 무게 × 부모 무게
 * - `indicators`가 여럿이면 **균등 분할**
 * - ⚠ 같은 지표가 여러 자리에 나오면 **무게를 합쳐 한 줄로** 만든다(같은 기둥 안 이중 계산 금지).
 *   합쳐진 줄의 `path`는 `a + b` 꼴로 둘 다 남긴다 — 어디서 왔는지 잃지 않는다.
 */
export function flattenPillar(pillar: GcrmPillar): FlatMember[] {
  const out: FlatMember[] = [];

  const walk = (node: PillarNode, weight: number, path: string): void => {
    if (node.kind === "group") {
      for (const [name, child] of Object.entries(node.members)) {
        walk(child, weight * node.weight, path ? `${path}.${name}` : name);
      }
      return;
    }
    if (node.kind === "unavailable") {
      out.push({ indicator: null, weight: weight * node.weight, path, reason: node.reason });
      return;
    }
    const each = (weight * node.weight) / node.indicators.length;
    for (const code of node.indicators) {
      out.push({
        indicator: code,
        weight: each,
        path,
        polarity: node.polarity,
        polarityReason: node.polarityReason,
      });
    }
  };

  for (const [name, node] of Object.entries(pillar.members)) walk(node, 1, name);

  // 같은 지표를 합친다. ⚠ 부호 덮어쓰기가 서로 다르면 합칠 수 없다 — 검증기가 잡는다.
  const merged = new Map<string, FlatMember>();
  const result: FlatMember[] = [];
  for (const m of out) {
    if (m.indicator === null) {
      result.push(m);
      continue;
    }
    const cur = merged.get(m.indicator);
    if (!cur) {
      const copy = { ...m };
      merged.set(m.indicator, copy);
      result.push(copy);
      continue;
    }
    cur.weight += m.weight;
    cur.path = `${cur.path} + ${m.path}`;
    // ⚠ 같은 지표에 서로 다른 부호를 주면 합칠 수 없다. 합쳐진 값은 뜻이 없다.
    if (cur.polarity !== m.polarity) cur.polarityConflict = true;
  }
  return result;
}

/** 설계 가중치의 합. ⚠ 1.00이어야 한다(테스트). */
export function designWeightSum(pillar: GcrmPillar): number {
  return flattenPillar(pillar).reduce((s, m) => s + m.weight, 0);
}

/**
 * 구조적 커버리지 — 설계한 무게 중 **지표로 채울 수 있는** 비율.
 * ⚠ 운영 중 결측(신선도·이력 부족)은 여기 들어오지 않는다. 그것은 실행할 때 계산한다(§2-5).
 * @param isEnabled 지표 코드가 켜져 있는지
 */
export function structuralCoverage(pillar: GcrmPillar, isEnabled: (code: string) => boolean): number {
  const flat = flattenPillar(pillar);
  const total = flat.reduce((s, m) => s + m.weight, 0);
  if (total === 0) return 0;
  const filled = flat
    .filter((m) => m.indicator !== null && isEnabled(m.indicator))
    .reduce((s, m) => s + m.weight, 0);
  return filled / total;
}
