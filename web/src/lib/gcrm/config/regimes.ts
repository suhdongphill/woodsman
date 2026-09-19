/**
 * GCRM v2 — 레짐 정의 (명세 §2-13).
 *
 * ## ⚠ 조건은 **기둥 요약 스칼라의 raw 방향** 기준이다
 * 화면에 보이는 값 그대로다. 「위험전이 ≥ 70」은 **위험이 크다**는 뜻이고, 집계용으로 뒤집은
 * `score_ori`가 아니다. 두 값을 섞으면 임계의 뜻이 조용히 반대가 된다.
 *
 * ## 이력현상(hysteresis)
 * ⚠ **진입 임계와 해제 임계가 다르다.** 같으면 임계 근처에서 매일 들어갔다 나온다.
 * 그리고 최소 체류 기간 안에는 해제 조건이 충족돼도 바꾸지 않는다 —
 * 단 `R6`(위기)만 예외다. 위기 진입은 언제든 가능해야 한다.
 */

export type RegimeCode = "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/** 기둥 스칼라에 거는 조건 한 줄. */
export type PillarCondition = {
  pillar: string;
  op: "gte" | "lt" | "between" | "gt";
  /** `between`이면 [하한, 상한], 그 외는 [값] */
  value: number[];
};

export type GcrmRegime = {
  code: RegimeCode;
  nameKo: string;
  /** ⚠ 영문 코드는 툴팁·용어사전에만. 화면 본문은 한글이 먼저다(§D-3). */
  nameEn: string;
  /** 한 문장 요약의 뼈대 — 숫자보다 먼저 온다(§2-20). */
  headline: string;
  enter: PillarCondition[];
  /** ⚠ 진입과 다르다. 이력현상의 핵심이다. */
  exit: PillarCondition[];
  /**
   * 해제 조건을 어떻게 묶는가. ⚠ **레짐마다 다르다** — 명세 §2-13 표의 「또는 / 그리고」를 그대로 옮겼다.
   * - `any` — 하나라도 충족되면 해제 후보 (R1 · R2 · R4)
   * - `all` — 전부 충족돼야 해제 후보 (R3 · R5 · R6)
   *
   * ⚠ 한 값으로 통일하면 안 된다. 심한 레짐(R5·R6)은 **전부 풀려야** 나가고,
   *   완만한 레짐(R1·R2)은 **하나만 깨져도** 나간다. 그것이 명세의 판단이다.
   */
  exitMode: "any" | "all";
  /** 최소 체류(영업일). */
  minDwellDays: number;
  /** 추가 조건 — 계열이 아니라 신호·승격 상태가 정한다. */
  requires?: {
    /** 바람이 이 주 수만큼 같은 방향으로 지속돼야 한다. */
    windPersistenceWeeks?: number;
    /** 이 채널들이 **모두** 확인돼야 한다. */
    channels?: string[];
    /** 조류가 악화 방향이어야 한다. */
    tideDeteriorating?: boolean;
  };
  /** 해제에 필요한 신호 조건 — 기둥 점수만으로는 말할 수 없는 것들. */
  exitRequires?: {
    /** 바람이 이 주 수만큼 개선돼야 한다. */
    windImprovingWeeks?: number;
    /** 자금시장이 이 주 수만큼 정상이어야 한다. */
    fundingNormalWeeks?: number;
  };
};

/**
 * ⚠ 동시 충족 시 우선순위. 앞이 이긴다.
 * 위기(R6)가 가장 먼저고, 그다음이 스태그플레이션(R5)이다 — 나쁜 쪽을 먼저 본다.
 */
export const REGIME_PRIORITY: RegimeCode[] = ["R6", "R5", "R3", "R4", "R2", "R1", "R0"];

/**
 * 전이 가능 그래프 (§2-13).
 * ⚠ `R6`은 **어느 레짐에서든** 진입 가능하다. 그 외에는 인접 레짐으로만 간다 —
 * 완화적 확장에서 스태그플레이션으로 하루 만에 건너뛰는 판정은 판정이 아니다.
 */
export const REGIME_EDGES: Record<RegimeCode, RegimeCode[]> = {
  R0: ["R1", "R2", "R3", "R4", "R5", "R6"],
  R1: ["R0", "R2", "R6"],
  R2: ["R0", "R1", "R3", "R6"],
  R3: ["R0", "R2", "R4", "R6"],
  R4: ["R0", "R3", "R5", "R6"],
  R5: ["R0", "R4", "R6"],
  R6: ["R0", "R1", "R2", "R3", "R4", "R5"],
};

export const GCRM_REGIMES: GcrmRegime[] = [
  {
    code: "R0",
    nameKo: "미분류",
    nameEn: "Unclassified",
    headline: "어느 국면에도 뚜렷이 들어맞지 않습니다",
    enter: [],
    exit: [],
    minDwellDays: 0,
    exitMode: "any",
  },
  {
    code: "R1",
    nameKo: "완화적 확장",
    nameEn: "Accommodative Expansion",
    headline: "유동성이 넉넉하고 위험이 번지지 않고 있습니다",
    enter: [
      { pillar: "liquidity", op: "gte", value: [65] },
      { pillar: "risk_transmission", op: "lt", value: [45] },
      { pillar: "rate_absorption", op: "gte", value: [60] },
    ],
    exit: [
      { pillar: "liquidity", op: "lt", value: [55] },
      { pillar: "risk_transmission", op: "gte", value: [55] },
    ],
    minDwellDays: 10,
    exitMode: "any",
  },
  {
    code: "R2",
    nameKo: "안정 성장",
    nameEn: "Stable Growth",
    headline: "엔진이 과열 없이 돌고 있습니다",
    enter: [
      { pillar: "engine_power", op: "gte", value: [60] },
      { pillar: "engine_heat", op: "between", value: [45, 65] },
      { pillar: "risk_transmission", op: "lt", value: [45] },
    ],
    exit: [
      { pillar: "engine_power", op: "lt", value: [50] },
      { pillar: "risk_transmission", op: "gte", value: [55] },
    ],
    minDwellDays: 10,
    exitMode: "any",
  },
  {
    code: "R3",
    nameKo: "통화 재긴축",
    nameEn: "Monetary Re-Tightening",
    headline: "물가를 잡으려는 압력이 유동성을 조이고 있습니다",
    enter: [
      { pillar: "monetary_discipline", op: "gte", value: [60] },
      { pillar: "liquidity", op: "lt", value: [55] },
      { pillar: "rate_absorption", op: "between", value: [45, 65] },
    ],
    exit: [
      { pillar: "monetary_discipline", op: "lt", value: [50] },
      { pillar: "liquidity", op: "gte", value: [60] },
    ],
    minDwellDays: 15,
    exitMode: "all",
  },
  {
    code: "R4",
    nameKo: "성장 둔화·디스인플레이션",
    nameEn: "Slowdown / Disinflation",
    headline: "엔진이 식고 물가도 함께 내려오고 있습니다",
    enter: [
      { pillar: "engine_power", op: "lt", value: [45] },
      { pillar: "engine_heat", op: "lt", value: [45] },
      { pillar: "risk_transmission", op: "lt", value: [60] },
    ],
    exit: [
      { pillar: "engine_power", op: "gte", value: [55] },
      { pillar: "engine_heat", op: "gte", value: [55] },
    ],
    minDwellDays: 15,
    exitMode: "any",
  },
  {
    code: "R5",
    nameKo: "스태그플레이션·재정자본 스트레스",
    nameEn: "Stagflation / Fiscal-Capital Stress",
    headline: "물가는 뜨거운데 금리를 감당할 힘이 떨어지고 있습니다",
    enter: [
      { pillar: "risk_transmission", op: "gte", value: [70] },
      { pillar: "engine_heat", op: "gte", value: [70] },
      { pillar: "rate_absorption", op: "lt", value: [45] },
    ],
    exit: [
      { pillar: "risk_transmission", op: "lt", value: [55] },
      { pillar: "engine_heat", op: "lt", value: [60] },
      { pillar: "rate_absorption", op: "gt", value: [55] },
    ],
    minDwellDays: 20,
    exitMode: "all",
    exitRequires: { windImprovingWeeks: 2 },
    requires: { windPersistenceWeeks: 3, tideDeteriorating: true },
  },
  {
    code: "R6",
    nameKo: "신용·자금 위기",
    nameEn: "Credit / Funding Crisis",
    headline: "빌려주는 쪽과 하루짜리 돈이 동시에 멈췄습니다",
    enter: [{ pillar: "risk_transmission", op: "gte", value: [80] }],
    exit: [{ pillar: "risk_transmission", op: "lt", value: [60] }],
    minDwellDays: 10,
    exitMode: "all",
    exitRequires: { fundingNormalWeeks: 2 },
    /**
     * ⚠ **CREDIT과 FUNDING 두 채널이 모두 확인될 때만 위기다.**
     * 주식만 급락한 것은 위기가 아니다 — v1 §18의 원칙을 규칙으로 고정했다.
     */
    requires: { channels: ["CREDIT", "FUNDING"] },
  },
];

export const GCRM_REGIME_BY_CODE = new Map(GCRM_REGIMES.map((r) => [r.code, r]));

/** R6만 최소 체류를 무시하고 언제든 들어갈 수 있다. */
export const DWELL_EXEMPT: RegimeCode[] = ["R6"];

/**
 * ⚠ 전이 차단 — 커버리지가 모자라면 레짐을 **바꾸지 않고 직전 상태를 유지**한다(§2-6).
 * 자료가 부족할 때 판정을 내리는 것이, 판정을 미루는 것보다 나쁘다.
 */
export const BLOCK_TRANSITION_BELOW_COVERAGE = 0.7;

/** 한 조건을 판정한다. ⚠ 값이 없으면 `false`가 아니라 `undefined`다 — 모르는 것과 아닌 것은 다르다. */
export function testCondition(c: PillarCondition, score: number | undefined): boolean | undefined {
  if (score === undefined || !Number.isFinite(score)) return undefined;
  if (c.op === "gte") return score >= c.value[0];
  if (c.op === "gt") return score > c.value[0];
  if (c.op === "lt") return score < c.value[0];
  return score >= c.value[0] && score <= c.value[1];
}
