/**
 * GCRM v2 — **숫자의 출처 대장** (2026-09-19 운영자 지시).
 *
 * > 근거가 없는 것은 화면에 볼 수 있게 하거나 설계서에 담아 놓을 것.
 * > 다른 인사이트를 발견했을 때 원인 분석과 개선점을 찾을 수 있도록.
 *
 * ## 이 파일이 있는 이유
 * 모델의 임계·가중치는 셋 중 하나다 — 명세에서 왔거나, 기관 관행과 대조했거나, **내가 정했거나**.
 * 셋을 구분하지 않으면 6개월 뒤에 「이 0.6은 왜 0.6인가」를 아무도 답하지 못한다.
 * 그때 숫자를 고치면 **근거 있는 값과 없는 값을 같은 손으로 만지게 된다.**
 *
 * ## ⚠ 값과 근거가 따로 놀지 못하게 한다
 * 각 항목은 **지금 값의 사본**을 들고 있고, `liveValues()`가 설정에서 같은 값을 읽어 온다.
 * 테스트가 둘을 대조하므로 **설정값을 고치면 근거도 반드시 다시 적어야 한다**
 * (`CLAUDE.md` §2-1 — 같은 숫자를 두 곳에 적었으면 테스트가 대조한다).
 *
 * ## 등급
 * - `A` 명세(`docs/GCRM_설계점검_v2.md`)에 명시
 * - `B` 공개된 기관 관리체계·표준 문헌과 대조함
 * - `C` 업계·수학 관례 (출처를 특정할 수 있음)
 * - `D` **근거 없음. 내가 정했다** — `reviewPlan`이 필수다
 *
 * ⚠ 등급 `A`가 「옳다」는 뜻은 아니다. 명세 자신의 숫자도 출처가 적혀 있지 않은 것이 있다.
 *   여기서 말하는 것은 **「우리가 어디서 가져왔나」**까지다.
 */
import {
  AXIS_WEIGHTS,
  HORIZON_WEIGHTS,
  HORIZON_OBS,
  HORIZON_GUARD,
  GATES,
  DIRECTION,
  EVIDENCE_FACTOR,
  STALENESS_FACTOR,
  STALENESS_CYCLES,
  CYCLE_DAYS,
  CONFIDENCE_WEIGHTS,
  WINDOW_YEARS,
  WINDOW_OBS,
  DIR_AGREEMENT,
  SENSITIVITY,
} from "./model";
import { GCRM_PILLARS } from "./pillars";
import { CONFIRMATION } from "./channels";
import { ACUTE } from "./promotion";
import { GCRM_INDICATORS } from "./indicators";

export type Grade = "A" | "B" | "C" | "D";

export type ProvenanceEntry = {
  /** 안정적인 키. ⚠ 바꾸지 않는다 — 이력이 끊긴다 */
  id: string;
  label: string;
  /** 어느 파일의 무엇인가 */
  where: string;
  grade: Grade;
  /**
   * ⚠ **근거를 적을 당시의 값 사본.** `liveValues()`가 읽어 온 지금 값과 테스트가 대조한다.
   * 설정을 고치면 여기도 고쳐야 하고, 고치는 김에 `basis`를 다시 읽게 된다 — 그것이 목적이다.
   */
  value: unknown;
  /** 왜 이 값인가. ⚠ `D`면 「근거 없음」이라고 그대로 적는다 */
  basis: string;
  source?: string[];
  /** ⚠ `D` 필수 — 언제 어떻게 검증할 것인가 */
  reviewPlan?: string;
  /** 이 값이 틀렸을 때 무엇이 망가지는가. 영향이 큰 것부터 고치기 위해 적는다 */
  impact?: string;
};

export const PROVENANCE: ProvenanceEntry[] = [
  // ── A · 명세에 있는 것 ────────────────────────────────────────────────
  {
    id: "axis_weights_core",
    label: "축 가중치(종합) 조류 50 · 바람 35 · 파도 15",
    where: "model.ts · AXIS_WEIGHTS.core",
    value: {"tide":0.5,"wind":0.35,"wave":0.15},
    grade: "A",
    basis: "명세 §2-16 model.yaml 예시 그대로",
  },
  {
    id: "axis_weights_transition",
    label: "축 가중치(전이 증거) — ⚠ 파도 0",
    where: "model.ts · AXIS_WEIGHTS.transition",
    value: {"tide":0.35,"wind":0.45,"wave":0,"rts_slow":0.2},
    grade: "A",
    basis: "명세 §2-14. 파도가 RTE를 통해 레짐을 바꾸는 뒷문을 막는다(B-10)",
    impact: "0이 아니면 §2-11의 하드 게이트가 무의미해진다",
  },
  {
    id: "horizon_weights",
    label: "창 가중치 조류 35/30/20/15 · 바람 45/35/20 · 파도 50/30/20",
    where: "model.ts · HORIZON_WEIGHTS",
    value: {"tide":{"M1":0.35,"M3":0.3,"M6":0.2,"M12":0.15},"wind":{"W1":0.45,"W4":0.35,"W13":0.2},"wave":{"D1":0.5,"D3":0.3,"D5":0.2}},
    grade: "A",
    basis: "명세 §2-4",
  },
  {
    id: "gates",
    label: "커버리지 게이트 기둥 0.60 · 축 0.70 · 총점 0.70",
    where: "model.ts · GATES",
    value: {"pillarMinCoverage":0.6,"axisMinCoverage":0.7,"overallMinCoverage":0.7},
    grade: "A",
    basis: "명세 §2-6. ⚠ 명세에도 이 숫자의 출처는 적혀 있지 않다",
    impact: "점수를 낼지 말지를 정한다. 낮추면 자료 부족인 판정이 화면에 올라간다",
  },
  {
    id: "direction",
    label: "방향 lag 63/20/5영업일 · 불감대 2.0/2.0/3.0",
    where: "model.ts · DIRECTION",
    value: {"lag":{"tide":63,"wind":20,"wave":5},"deadband":{"tide":2,"wind":2,"wave":3}},
    grade: "A",
    basis: "명세 §2-8. 불감대가 없으면 화살표가 매일 뒤집힌다",
  },
  {
    id: "evidence_factor",
    label: "근거 계수 official 1.00 / market 0.95 / manual 0.90 / judgment 0.70",
    where: "model.ts · EVIDENCE_FACTOR",
    value: {"official":1,"market":0.95,"manual":0.9,"judgment":0.7},
    grade: "A",
    basis: "명세 §2-5 · C-4(6단계를 4단계로 줄인 근거 포함)",
  },
  {
    id: "staleness_factor",
    label: "신선도 계수 1.00 / 0.90 / 0.70 / 0.50",
    where: "model.ts · STALENESS_FACTOR",
    value: {"fresh":1,"withinCycle":0.9,"oneCycleLate":0.7,"twoCyclesLate":0.5},
    grade: "A",
    basis: "명세 §2-5 표",
  },
  {
    id: "confidence_weights",
    label: "⚠ 신뢰도 가중 — 명세의 넷(.40/.25/.20/.15)을 0.90배로 줄이고 **깊이 .10**을 더했다",
    where: "model.ts · CONFIDENCE_WEIGHTS",
    value: {"coverage":0.36,"staleness":0.225,"evidence":0.18,"channelBreadth":0.135,"depth":0.1},
    grade: "D",
    basis:
      "넷의 **비율**은 명세 §2-7 그대로다(테스트가 대조한다). ⚠ 다섯째 `depth`의 **0.10은 근거가 없다** — " +
      "2026-09-24에 창을 20년으로 통일하면서, 소급이 불가능해 창을 못 채우는 지표(ICE 신용 3.2년 · SOFR 7.5년)를 " +
      "커버리지가 **값이 있으면 1로 세는** 문제를 드러내려고 자리를 잡은 값이다. 크기는 내가 정했다",
    impact:
      "창을 절반만 채운 지표뿐인 축의 신뢰도가 5점 낮아진다. ⚠ 점수는 건드리지 않는다 — " +
      "신뢰도와 점수를 곱하지 않는다는 원칙(명세 Part 5 ②)이 이 값의 영향을 신뢰도 안에 가둔다",
    reviewPlan:
      "P9 민감도에서 0.05~0.20을 쓸어 「밴드가 바뀌는 축이 몇 개인가」를 센다. " +
      "어느 값에서도 밴드가 안 바뀌면 일하지 않는 숫자이므로 빼거나 키운다(`minNonOverlap`을 3에서 10으로 고친 것과 같은 판정)",
  },
  {
    id: "window_years",
    label: "⚠ 정규화 창 **20년** — 빈도별 관측 수로 환산",
    where: "model.ts · WINDOW_YEARS · WINDOW_OBS",
    value: {"years":20,"obs":{"d":5000,"w":1040,"m":240,"q":80}},
    grade: "D",
    basis:
      "명세는 `max_window: 2500`(≈10년) **한 값만** 적었고, 우리는 그것을 빈도와 무관하게 72개 지표에 붙여 두었다. " +
      "관측 수로 자르므로 뜻이 갈렸다 — 일간 10년 · 주간 48년 · 월간 208년 · 분기 625년(일간 24개만 잘렸다). " +
      "⚠ **20년은 내가 골랐다.** 근거는 「2008년과 2020년이 둘 다 분포에 들어온다」 한 줄이다 — " +
      "10년이면 2016~2026이라 금리 사이클이 하나뿐이고, 2008년을 못 본 분포에서 「사상 최악」을 말하게 된다",
    impact:
      "**모든 지표의 백분위가 여기에 달려 있다.** 창을 바꾸면 점수의 뜻이 바뀌어 이전 축 이력과 이어 붙일 수 없다 " +
      "(2026-09-24에 나흘치를 버리고 다시 시작했다). 이 대장에서 영향이 가장 큰 항목이다",
    reviewPlan:
      "P9 민감도에서 10·15·20·25·30년으로 다시 계산해 **레짐 판정이 바뀌는 구간**을 찾는다. " +
      "창 길이에 레짐이 민감하면 그 자체가 `MODEL_FRAGILITY_WARNING`이다",
  },
  {
    id: "confirmation",
    label: "확인 3채널 · PRICE+CREDIT+FUNDING 1.25배",
    where: "channels.ts · CONFIRMATION",
    value: {"minChannels":3,"comboMultiplier":1.25},
    grade: "A",
    basis: "명세 §2-10. v1 §9의 정성적 권고를 계수로 고정한 것",
  },
  {
    id: "acute_spec",
    label: "급성 경보 VIX ≥ 35 · HY 5일 +100bp · SOFR−IORB +15bp",
    where: "promotion.ts · ACUTE.thresholds",
    value: 3,
    grade: "A",
    basis: "명세 §2-12에 예시로 적힌 값",
    impact: "백분위가 못 잡는 극단을 잡는 자리. 과거 사건으로 검증해야 한다(P9)",
  },
  {
    id: "min_obs_daily",
    label: "일간 지표 minObs 750(≈3년)",
    where: "indicators.ts",
    value: 750,
    grade: "A",
    basis: "명세 §2-3 지표 스키마 예시",
  },

  // ── B · 기관 관리체계와 대조한 것 ────────────────────────────────────
  {
    id: "channel_taxonomy",
    label: "채널 6개 — OFR 금융스트레스지수 5범주와 대조",
    where: "channels.ts · GCRM_CHANNELS",
    value: null,
    grade: "B",
    basis:
      "OFR FSI는 credit · equity valuation · funding · safe assets · volatility 다섯 범주를 쓴다. " +
      "우리는 변동성을 PRICE에 흡수해(명세 B-9의 중복 계산 방지) 6개로 나눴다. " +
      "⚠ OFR은 범주 가중치를 공행성 기반으로 **추정**하고 우리는 손으로 준다",
    source: ["https://www.financialresearch.gov/financial-stress-index/"],
  },
  {
    id: "short_history_warning",
    label: "짧은 이력 위의 백분위 경고 — NFCI와 대조",
    where: "indicators.ts · historyStart · points",
    value: null,
    grade: "B",
    basis:
      "시카고연준 NFCI는 지표 105개를 1973년 이후 표본으로 표준화한다. " +
      "우리 hy_spread·ig_spread는 2023-08부터 3년뿐이다. 「3년 중 최악」과 「50년 중 최악」은 같은 말이 아니다",
    source: ["https://www.chicagofed.org/research/data/nfci/about"],
  },
  {
    id: "pillar_taxonomy",
    label: "기둥 10개 — 연준 금융안정보고서 4대 취약성과 대조",
    where: "pillars.ts · GCRM_PILLARS",
    value: null,
    grade: "B",
    basis:
      "연준 FSR은 자산 밸류에이션 · 기업가계 차입 · 금융부문 레버리지 · 자금조달 위험 넷을 본다. " +
      "⚠ **GCRM에 「금융부문 레버리지」에 해당하는 기둥이 없다**(v1에도 없었다). " +
      "포털에 딜러·헤지펀드 레버리지 계열이 없어 지금 채울 수 없지만, 빠졌다는 사실을 기록한다",
    source: [
      "https://www.federalreserve.gov/publications/2026-may-financial-stability-report-purpose-and-framework.htm",
    ],
    impact: "레버리지 축적 국면(2006·2019)을 놓칠 수 있다",
  },
  {
    id: "overlap_principle",
    label: "겹치는 창의 유효 표본 ≈ T/k",
    where: "horizon.ts · HORIZON_GUARD",
    value: null,
    grade: "B",
    basis:
      "겹치는 관측을 쓰면 유효 표본이 대략 표본길이÷창길이로 줄고 유의성이 실제보다 커 보인다는 것은 " +
      "장기 시계열 회귀 문헌의 표준적 결과다(Hansen–Hodrick 1980 이래 · Valkanov 2003). " +
      "⚠ 그 문헌은 **회귀 t값**에 관한 것이고 백분위 추정에 그대로 적용되지 않는다 — 원리까지만 가져왔다",
    source: [
      "https://rady.ucsd.edu/_files/faculty-research/valkanov/long-horizon.pdf",
    ],
  },
  {
    id: "point_in_time",
    label: "point-in-time / 빈티지 분리",
    where: "normalize.ts · lib/macro/vintage.ts",
    value: null,
    grade: "B",
    basis:
      "발표 후 수정된 값으로 과거를 채점하면 모델이 실제보다 똑똑해 보인다(look-ahead). " +
      "세인트루이스 연준이 ALFRED로 빈티지를 공개하는 이유이고, 포털이 2026-09-13에 L1/L2를 가른 이유다. " +
      "GCRM이 새로 정한 것이 아니라 이미 있는 규율을 따랐다",
  },

  // ── C · 관례 ─────────────────────────────────────────────────────────
  {
    id: "horizon_obs_daily",
    label: "일간 창 길이 21 / 63 / 126 / 252영업일",
    where: "model.ts · HORIZON_OBS.d",
    value: {"M1":21,"M3":63,"M6":126,"M12":252,"W1":5,"W4":20,"W13":65,"D1":1,"D3":3,"D5":5},
    grade: "C",
    basis: "월 21영업일 · 연 252영업일의 시장 관례",
  },
  {
    id: "pct_rank_midrank",
    label: "백분위 = 중간 순위 (작은 값 + 0.5×같은 값) / n",
    where: "normalize.ts · pctRankOf",
    value: null,
    grade: "C",
    basis:
      "동점 처리의 표준적 방법. 최솟값 0.5/n · 최댓값 (n−0.5)/n으로 위아래가 대칭이 된다. " +
      "「작은 값 / n」을 쓰면 최솟값 0 · 최댓값 (n−1)/n으로 비대칭이 된다",
  },
  {
    id: "normal_cdf",
    label: "정규 누적분포 근사 (Abramowitz–Stegun 26.2.17)",
    where: "normalize.ts · normalCdf",
    value: null,
    grade: "C",
    basis: "표준 근사식, |오차| < 7.5e-8. 테스트가 Φ(0)·Φ(1)·Φ(1.96)·Φ(−3)을 확인한다",
  },
  {
    id: "quantile_type7",
    label: "분위수 = 선형 보간 (R type 7 / numpy 기본)",
    where: "normalize.ts · quantile",
    value: null,
    grade: "C",
    basis: "가장 널리 쓰이는 정의",
  },

  {
    id: "alignment_formula",
    label: "정렬도 = 0.5 × proximity + 0.5 × 방향일치도",
    where: "alignment.ts · alignmentOf",
    value: [0.5, 0.5],
    grade: "A",
    basis:
      "명세 §2-9. v1의 (|C−W|+|W−D|+|C−D|)/3은 대수적으로 2×(최대−최소)/3과 같아 **가운데 값이 계산에 " +
      "전혀 들어가지 않고**, 0–100 중 절반이 쓰이지 않는다(B-3). spread를 직접 쓰면 같은 정보를 전 구간으로 편다. " +
      "가운데 값은 표준편차로 **보조 표시**만 한다 — 점수에는 넣지 않는다(명세가 그렇게 권한다)",
    impact: "이 식이 바뀌면 모든 정렬도와 상태 판정이 바뀐다",
  },
  {
    id: "state_tree",
    label: "상태 결정 트리 — 정렬 문턱 65 · 이탈 문턱 45",
    where: "alignment.ts · alignmentState",
    value: [65, 45],
    grade: "A",
    basis:
      "명세 §2-9. ⚠ **TRANSITION을 DIVERGENT보다 먼저** 판정한다 — 순서를 바꾸면 전환 국면이 이탈로 분류된다. " +
      "점수 구간이 아니라 트리가 상태를 정하는 것도 명세의 결정이다(B-5: v1은 같은 34점에 두 상태를 적었다)",
  },
  {
    id: "all_flat_agreement",
    label: "⚠ 셋 다 FLAT일 때의 방향 일치도 = 0",
    where: "alignment.ts · directionAgreement",
    value: 0,
    grade: "D",
    basis:
      "⚠ **명세가 정하지 않은 경우다.** 글자대로면 「세 방향이 모두 같음」이라 100이지만, " +
      "아무것도 움직이지 않는 것을 「강한 정렬」이라 부르면 오독을 부른다. 그래서 0으로 둔다",
    impact: "정체 국면의 정렬도가 100점씩 달라진다. 화면 문구가 정반대로 읽힐 수 있는 자리다",
    reviewPlan:
      "백테스트(P9)에서 정체 구간이 실제로 어떻게 끝났는지 본다 — 정체가 전환의 전조였다면 0이 맞고, " +
      "안정의 신호였다면 별도 상태(STALLED)를 만드는 것이 맞다",
  },
  {
    id: "flat_majority_agreement",
    label: "⚠ FLAT·FLAT·방향 하나일 때의 방향 일치도 = 0",
    where: "alignment.ts · directionAgreement",
    value: 0,
    grade: "D",
    basis:
      "⚠ **명세가 정하지 않은 경우다.** 「둘이 같고 하나가 FLAT(75)」의 뜻은 *같은 둘이 방향을 가질 때*로 읽었다. " +
      "멈춘 둘과 움직이는 하나는 정렬의 증거가 아니므로 0으로 둔다",
    impact: "한 축만 움직이기 시작하는 초기 국면의 정렬도를 75점 낮춘다",
    reviewPlan: "P9에서 「한 축만 먼저 움직인 뒤 나머지가 따라온 사례」의 빈도를 센다",
  },
  {
    id: "dominant_threshold",
    label: "⚠ 지배 판정 — 명세의 「±10%로 3점」은 뜰 수 없어 **빼고 재기**로 바꿨다",
    where: "sensitivity.ts · leaveOneOutSensitivity · SENSITIVITY.dominantPillarDelta",
    value: 3,
    grade: "D",
    basis:
      "명세 §2-15는 「지표 가중치 ±10%가 기둥을 3점 이상 움직이면 DOMINANT_INDICATOR_WARNING」이라 하는데, " +
      "⚠ **어떤 경우에도 뜰 수 없다.** 기둥 점수가 가중평균이라 이동폭이 " +
      "(0.1w / (1 ∓ 0.1w)) × |점수 − 기둥점수|로 묶이고, 가중치를 0.01~0.99로 쓸어도 **최대 2.63점**이다 " +
      "(2026-09-20 수치·테스트로 확인). minNonOverlap=3과 같은 종류의 죽은 임계였다. " +
      "그래서 지배 판정을 **지표를 빼고 재는 방식**으로 옮겼다 — 「이 지표가 없으면 기둥이 달라지는가」가 " +
      "원래 물으려던 것에 더 가깝다. 문턱 3점은 그대로 쓰되, ⚠ **그 3점의 근거는 여전히 없다.**",
    impact:
      "지배 경고가 뜨는지 마는지를 정한다. 명세대로 두면 경고가 영원히 안 뜨고, " +
      "그러면 「지배적인 지표가 없다」가 아니라 **「검사를 안 한 것」**이 된다",
    reviewPlan:
      "① 실제 run에서 빼고 재기를 돌려 몇 개가 3점을 넘는지 센다 " +
      "② 경고가 뜨면 **가중치를 고치기 전에 왜 떴는지 먼저 본다** — 쓸 수 있는 지표가 적어 " +
      "하나가 기둥을 대표하는 것이라면 고칠 것은 가중치가 아니라 빠진 지표다 " +
      "③ 명세의 ±10% 섭동도 남겨 두고 「얼마나 안 움직이는가」를 함께 보고한다",
  },
  {
    id: "axis_weight_perturbation_scope",
    label: "축 가중치 섭동으로는 정렬도·레짐이 흔들리지 않는다",
    where: "sensitivity.ts · axisWeightSensitivity",
    value: 5,
    grade: "A",
    basis:
      "명세 §2-15의 ±5pp 비례 재배분을 그대로 구현했다(예시 tide 50→55 · wind 31.5 · wave 13.5 재현). " +
      "⚠ 다만 `AXIS_WEIGHTS.core`는 **종합 점수를 만들 때만** 쓰이므로 축 점수 자체를 바꾸지 않는다 — " +
      "그래서 MODEL_FRAGILITY_WARNING의 세 조건 중 「overall 5점 이상 변동」만 살아 있다. " +
      "정렬도·레짐을 흔드는 것은 창 가중치(HORIZON_WEIGHTS)이고 그건 파이프라인을 다시 돌려야 한다",
    impact: "이 섭동만 돌리고 「모델이 견고하다」고 말하면 안 된다 — 흔들 수 있는 것만 흔든 것이다",
  },
  // ── D · ⚠ 근거 없음 ──────────────────────────────────────────────────
  {
    id: "axis_weight_pillars",
    label: "기둥 간 가중치 10개 — 전부 0.10 (균등)",
    where: "pillars.ts · GcrmPillar.axisWeight",
    value: [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1],
    grade: "D",
    basis:
      "⚠ **차등의 근거가 없어 균등으로 둔다**(운영자 결정 2026-09-19: 「기준이 명확하지 않으면 균등으로 하고 진행」). " +
      "처음에 .18/.14/.12… 로 차등을 뒀는데 명세에도 v1 엔진에도 기둥 간 가중치는 없었다 — " +
      "「유동성이 제일 중요하다」는 내 직관이었다. **근거 없는 차등보다 근거 없는 균등이 정직하다.** " +
      "⚠ 균등이 「옳다」는 뜻은 아니다. 기둥들이 실제로 같은 중요도라는 근거도 없다 — " +
      "**모르는 것을 모른다고 표시한 상태**다",
    impact:
      "열 개가 모든 축 점수에 곱해진다. 균등이므로 지금은 **어느 기둥도 특별대우를 받지 않는다** — " +
      "대신 기둥 하나가 빠질 때의 충격이 모두 같아진다(축 커버리지가 10%씩 움직인다)",
    reviewPlan:
      "① 민감도 분석(P9 · §2-15)에 기둥 가중치 섭동을 넣어, 차등이 결과를 얼마나 바꾸는지 먼저 잰다 " +
      "② 데이터가 쌓이면 OFR·NFCI처럼 공행성 기반으로 **추정**한다 " +
      "③ 차등을 되살리려면 근거를 먼저 만든다. 직관으로 되돌리지 않는다",
  },
  {
    id: "min_non_overlap",
    label: "겹치지 않는 창 최소 10개",
    where: "model.ts · HORIZON_GUARD.minNonOverlap",
    value: 10,
    grade: "D",
    basis:
      "원리는 B등급(유효 표본 ≈ T/k)이지만 **문턱 10은 내가 정했다.** " +
      "논리: 점수를 5점 단위로 반올림해 보여 주므로 백분위가 최소 십분위는 가려야 한다. " +
      "⚠ 2026-09-19에 3 → 10으로 고쳤다. **3에서는 어떤 지표의 어떤 창도 걸리지 않았다** — " +
      "근거도 없고 일도 하지 않는 숫자였다",
    impact: "장기 창(M6·M12)을 쓸 수 있는 지표가 정해진다. 10에서 창 10칸이 빠진다",
    reviewPlan: "민감도 분석(P9)에서 5·10·20을 비교한다. 백테스트 적중률이 문턱에 얼마나 민감한지 본다",
  },
  {
    id: "min_horizon_coverage",
    label: "남은 창 가중치 합 최소 0.5",
    where: "model.ts · HORIZON_GUARD.minHorizonCoverage",
    value: 0.5,
    grade: "D",
    basis: "⚠ **근거 없음.** 「절반은 남아야 축을 대표한다」는 직관뿐이다",
    impact: "창이 몇 개 빠졌을 때 축을 낼지 말지를 정한다",
    reviewPlan: "민감도 분석(P9) 대상",
  },
  {
    id: "min_windows",
    label: "분포에 필요한 최소 창 수 30",
    where: "model.ts · HORIZON_GUARD.minWindows",
    value: 30,
    grade: "D",
    basis: "⚠ 통계에서 흔히 쓰는 어림수일 뿐 이 쓰임에 대한 근거는 아니다. 실질 방어선은 minNonOverlap이고 이것은 하한이다",
    reviewPlan: "minNonOverlap이 실제 방어선이므로 이 값은 사실상 무해하다. P9에서 제거 가능한지 본다",
  },
  {
    id: "cycle_days",
    label: "공표 주기 일간 4일 (주 7 · 월 31 · 분기 92)",
    where: "model.ts · CYCLE_DAYS",
    value: {"d":4,"w":7,"m":31,"q":92},
    grade: "D",
    basis:
      "주·월·분기는 달력에서 나온다. **일간의 4일은 내가 정했다** — 1일로 잡으면 금요일 값이 화요일에 " +
      "세 주기(MISSING)가 되어 주말마다 지표가 사라진다. 「주말 + 공휴일 하루」를 덮는 값이다",
    impact: "일간 지표가 언제 계산에서 빠지는지를 정한다. 파도 축에 직접 영향",
    reviewPlan:
      "포털 `freshness.ts`의 STALE_RULE(화면 「묵음」 배지)과 테스트로 대조 중이다. " +
      "미국 휴장일 달력을 붙이면 근거 있는 값으로 바꿀 수 있다",
  },
  {
    id: "staleness_cycles",
    label: "신선도 경계 0.5 / 1 / 2 / 3 주기",
    where: "model.ts · STALENESS_CYCLES",
    value: {"fresh":0.5,"withinCycle":1,"oneCycleLate":2,"twoCyclesLate":3},
    grade: "D",
    basis:
      "명세는 「최신 발표 / 정상 공표주기 이내 / 한 주기 경과 / 두 주기 경과 / 세 주기 이상」이라고만 적었다. " +
      "**주기의 배수로 옮긴 것은 내 해석**이고, 특히 「최신 발표」를 k < 0.5로 잡은 데 근거가 없다",
    reviewPlan: "발표 일정(FRED release calendar)을 붙이면 「최신 발표」를 추측이 아니라 사실로 판정할 수 있다",
  },
  {
    id: "unmapped_pillar_mappings",
    label: "미매핑 기둥 다섯의 지표 구성",
    where: "pillars.ts · risk_transmission · dollar_network · fiscal_dominance · monetary_discipline · debasement",
    value: null,
    grade: "D",
    basis:
      "v1 `inputs.ts`에 매핑이 없던 다섯 기둥은 **내가 지표를 골라 붙였다.** " +
      "구성요소 이름과 가중치는 v1 `config.ts` 그대로이므로 가중치는 v1 근거이지만, " +
      "「어느 구성요소를 어느 계열로 채울 것인가」는 내 판단이다. " +
      "특히 약한 자리: fiscal_dominance.debt_service_ratio ← total_debt_yoy(원래는 이자지출÷세입 — **분모를 못 본다**), " +
      "engine_power.power_infrastructure_investment ← power_ip_yoy(전력 **생산**지수는 투자가 아니다)",
    reviewPlan: "P1에서 제대로 된 계열(연방 이자지출·세입)로 바꾼다. 그때까지 화면에 「대체 지표」라고 표시한다",
  },
  {
    id: "acute_extra",
    label: "급성 경보 임계 두 개 (S&P 1일 −4.0% · 국채변동성 12bp)",
    where: "promotion.ts · ACUTE.thresholds",
    value: 2,
    grade: "D",
    basis: "⚠ **근거 없음.** 명세가 준 셋 외에 내가 더 넣었다",
    reviewPlan: "P9 백테스트에서 2018·2020·2022·2023 사건에 대 보고, 오경보율로 문턱을 정한다",
  },
  {
    id: "min_obs_by_freq",
    label: "주기별 minObs (주 156 · 월 60 · 분기 20)",
    where: "indicators.ts",
    value: {"w":156,"m":60,"q":20},
    grade: "D",
    basis: "명세는 일간 750만 준다. 「3년(주간) · 5년(월·분기)」로 환산한 것은 내 판단이다",
    reviewPlan: "v1 엔진은 최소 5년을 쓴다(`scores/normalize.ts`). 어느 쪽이 맞는지 P9에서 대 본다",
  },
  {
    id: "engine_power_groups",
    label: "엔진 출력 하위 묶음 비중 0.45 / 0.35 / 0.20",
    where: "pillars.ts · engine_power",
    value: [0.45,0.35,0.2],
    grade: "D",
    basis:
      "v1 §33 Capital Engine은 하위 점수 트리라 평탄화하면 유동성 기둥과 크게 겹쳐 쓰지 않았고, " +
      "대신 v1의 자본형성·생산성·민간신용 셋을 가져와 **내가 비중을 정했다**",
    reviewPlan: "민감도 분석(P9) 대상",
  },
];

/** 설정에서 **지금 값**을 읽어 온다. ⚠ 테스트가 `PROVENANCE`의 사본과 대조한다. */
export function liveValues(): Record<string, unknown> {
  return {
    axis_weights_core: AXIS_WEIGHTS.core,
    axis_weights_transition: AXIS_WEIGHTS.transition,
    horizon_weights: HORIZON_WEIGHTS,
    gates: GATES,
    direction: DIRECTION,
    evidence_factor: EVIDENCE_FACTOR,
    staleness_factor: STALENESS_FACTOR,
    confidence_weights: CONFIDENCE_WEIGHTS,
    window_years: { years: WINDOW_YEARS, obs: WINDOW_OBS },
    confirmation: { minChannels: CONFIRMATION.minChannels, comboMultiplier: CONFIRMATION.comboMultiplier },
    acute_spec: ACUTE.thresholds.filter((t) => ["vix", "hy_spread", "sofr_iorb"].includes(t.indicator)).length,
    min_obs_daily: GCRM_INDICATORS.find((i) => i.code === "vix")?.minObs,
    horizon_obs_daily: HORIZON_OBS.d,
    min_non_overlap: HORIZON_GUARD.minNonOverlap,
    min_horizon_coverage: HORIZON_GUARD.minHorizonCoverage,
    min_windows: HORIZON_GUARD.minWindows,
    cycle_days: CYCLE_DAYS,
    staleness_cycles: STALENESS_CYCLES,
    alignment_formula: [0.5, 0.5],
    state_tree: [65, 45],
    all_flat_agreement: DIR_AGREEMENT.otherwise,
    flat_majority_agreement: DIR_AGREEMENT.otherwise,
    dominant_threshold: SENSITIVITY.dominantPillarDelta,
    axis_weight_perturbation_scope: SENSITIVITY.axisDeltaPp,
    axis_weight_pillars: GCRM_PILLARS.map((p) => p.axisWeight),
    acute_extra: ACUTE.thresholds.filter((t) => ["spx_etf", "ust10y_rvol"].includes(t.indicator)).length,
    min_obs_by_freq: {
      w: GCRM_INDICATORS.find((i) => i.freq === "w")?.minObs,
      m: GCRM_INDICATORS.find((i) => i.freq === "m")?.minObs,
      q: GCRM_INDICATORS.find((i) => i.freq === "q")?.minObs,
    },
    engine_power_groups: Object.values(
      GCRM_PILLARS.find((p) => p.code === "engine_power")!.members,
    ).map((n) => n.weight),
  };
}

export const PROVENANCE_BY_ID = new Map(PROVENANCE.map((p) => [p.id, p]));

export function byGrade(grade: Grade): ProvenanceEntry[] {
  return PROVENANCE.filter((p) => p.grade === grade);
}

/** ⚠ 근거 없이 정한 값들. 화면·CLI·설명 엔드포인트가 이것을 그대로 보여 준다. */
export function ungrounded(): ProvenanceEntry[] {
  return byGrade("D");
}

export function provenanceSummary(): Record<Grade, number> {
  return {
    A: byGrade("A").length,
    B: byGrade("B").length,
    C: byGrade("C").length,
    D: byGrade("D").length,
  };
}
