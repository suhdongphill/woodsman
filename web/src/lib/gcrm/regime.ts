/**
 * GCRM v2 — 레짐 상태 기계 (명세 §2-13 · §2-14). 순수 함수.
 *
 * ## ★ 이 파일의 존재 이유 — 파도는 레짐을 바꾸지 못한다
 * 명세 §2-11의 하드 게이트를 **함수 서명으로** 강제한다.
 * `RegimeTransitionInput`에 `wave`가 **없다.** 테스트가 타입 선언 원문을 읽어 그 부재를 단언한다.
 *
 * ## ⚠ 명세 안의 충돌 하나를 해소했다 (2026-09-19)
 * - §2-11 「`wave` 값은 레짐 전이 판정 함수에 인자로 전달하지 마라」
 * - §2-13 「모든 조건은 **기둥 요약 스칼라** 기준이다」
 * - §B-2 기둥 요약 스칼라는 `summaryWeights`로 tide·wind·**wave**를 접은 값이다
 *
 * 셋을 그대로 두면 **파도가 기둥 요약을 통해 뒷문으로 레짐을 바꾼다** —
 * B-10이 지적한 것과 정확히 같은 구조(원칙이 산식에 의해 무력화됨)다.
 *
 * 그래서 §2-14가 RTE에서 쓴 방법을 그대로 가져왔다 — **wave를 빼고 재정규화**한다.
 * 레짐 조건이 보는 것은 `slowSummary()`가 만든 **조류·바람만의 기둥 스칼라**다.
 * 화면에 보이는 기둥 값(wave 포함)과 **다를 수 있고**, 그래서 둘을 나란히 저장한다.
 *
 * ## ⚠ 이력현상 — 진입과 해제가 다르다
 * 같으면 임계 근처에서 매일 들어갔다 나온다. 그리고 최소 체류 기간 안에는 해제 조건이
 * 충족돼도 바꾸지 않는다. **`R6`(위기)만 예외** — 위기 진입은 언제든 가능해야 한다.
 */
import {
  GCRM_REGIMES,
  GCRM_REGIME_BY_CODE,
  REGIME_PRIORITY,
  REGIME_EDGES,
  DWELL_EXEMPT,
  BLOCK_TRANSITION_BELOW_COVERAGE,
  testCondition,
  type RegimeCode,
  type GcrmRegime,
} from "./config/regimes";
import { AXIS_WEIGHTS, type Axis } from "./config/model";
import { RTS_SLOW } from "./config/promotion";

/** 한 축의 점수와 상태. */
export type AxisScore = {
  score?: number;
  coverage: number;
  status: "OK" | "INSUFFICIENT";
};

/**
 * ⚠ **파도를 뺀** 기둥 요약 스칼라.
 *
 * `summaryWeights`에서 tide·wind만 남기고 재정규화한다(§2-14의 방법).
 * 둘 다 없으면 지어내지 않고 `undefined`.
 */
export function slowSummary(
  byAxis: { tide?: number; wind?: number },
  summaryWeights: Record<Axis, number>,
): number | undefined {
  let w = 0;
  let sum = 0;
  if (byAxis.tide !== undefined) {
    w += summaryWeights.tide;
    sum += summaryWeights.tide * byAxis.tide;
  }
  if (byAxis.wind !== undefined) {
    w += summaryWeights.wind;
    sum += summaryWeights.wind * byAxis.wind;
  }
  return w === 0 ? undefined : sum / w;
}

/**
 * 레짐 전이 증거 RTE (§2-14).
 * ⚠ **wave가 들어가지 않는다.** v1의 `0.20 × Wave` 항을 `RTS_slow`로 대체했다.
 */
export function rteOf(tide: number, wind: number): number {
  const rtsSlow = RTS_SLOW.tide * tide + RTS_SLOW.wind * wind;
  const w = AXIS_WEIGHTS.transition;
  return w.tide * tide + w.wind * wind + w.rts_slow * rtsSlow;
}

export type RegimeState = {
  code: RegimeCode;
  nameKo: string;
  /** YYYY-MM-DD */
  enteredAt: string;
  /** 진입 후 경과 영업일 */
  dwellDays: number;
  prevRegime?: RegimeCode;
  /** 충족된 조건들 — 화면이 「왜 이 레짐인가」를 그대로 보여 준다 */
  entryReason: string[];
};

/** 신호·승격 쪽에서 오는 상태. ⚠ 여기에도 파도 점수는 없다. */
export type SignalContext = {
  /** 확인된 서로 다른 채널 */
  confirmedChannels: string[];
  /** 바람이 같은 방향으로 이어진 주 수 */
  windPersistenceWeeks: number;
  /** 바람이 개선된 주 수 */
  windImprovingWeeks: number;
  /** 자금시장이 정상인 주 수 */
  fundingNormalWeeks: number;
  /** 조류가 악화 방향인가 */
  tideDeteriorating: boolean;
};

/**
 * ★ 레짐 전이 판정의 입력.
 *
 * ⚠ **`wave`가 없다.** 명세 §2-11의 하드 게이트를 타입으로 강제한다.
 * 파도 점수·파도 방향·파도 커버리지 어느 것도 여기 들어오지 않는다.
 * 급성 경보(파도가 만드는 것)는 이 함수 **바깥**에서 배너로만 처리된다.
 */
export type RegimeTransitionInput = {
  asOf: string;
  tide: AxisScore;
  wind: AxisScore;
  /** ⚠ 파도를 뺀 기둥 스칼라(raw 방향) — `slowSummary()`가 만든다 */
  pillarsSlow: Record<string, number | undefined>;
  signals: SignalContext;
  prev: RegimeState;
  /** 총점 커버리지 — 0.70 미만이면 전이를 차단한다 */
  overallCoverage: number;
};

export type RegimeTransitionResult = {
  state: RegimeState;
  changed: boolean;
  /** 왜 바뀌었는가 / 왜 안 바뀌었는가 */
  reason: string;
  /** 진입 조건을 충족한 레짐들(우선순위 순) */
  candidates: RegimeCode[];
  /** 전이가 차단됐다면 그 이유 */
  blocked?: string;
  /**
   * ⚠ CREDIT과 FUNDING 두 채널이 **모두** 확인될 때만 참이다.
   * 주식만 급락한 것은 위기가 아니다.
   */
  financialCrisis: boolean;
};

/** 조건 묶음을 판정한다. ⚠ 값을 모르면 충족으로 세지 않는다. */
function evaluateConditions(
  conds: { pillar: string; op: "gte" | "lt" | "between" | "gt"; value: number[] }[],
  pillars: Record<string, number | undefined>,
  mode: "all" | "any",
): { ok: boolean; met: string[]; unknown: string[] } {
  const met: string[] = [];
  const unknown: string[] = [];
  let anyTrue = false;
  let allTrue = true;
  for (const c of conds) {
    const r = testCondition(c, pillars[c.pillar]);
    if (r === undefined) {
      unknown.push(c.pillar);
      allTrue = false;
      continue;
    }
    if (r) {
      anyTrue = true;
      met.push(`${c.pillar} ${c.op} ${c.value.join("~")}`);
    } else {
      allTrue = false;
    }
  }
  if (conds.length === 0) return { ok: false, met, unknown };
  return { ok: mode === "all" ? allTrue : anyTrue, met, unknown };
}

/** 신호 쪽 추가 조건. */
function meetsRequires(r: GcrmRegime, s: SignalContext): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const req = r.requires;
  if (req?.windPersistenceWeeks !== undefined && s.windPersistenceWeeks < req.windPersistenceWeeks) {
    missing.push(`바람 지속 ${s.windPersistenceWeeks}주 < ${req.windPersistenceWeeks}주`);
  }
  if (req?.tideDeteriorating && !s.tideDeteriorating) missing.push("조류 악화 확인 없음");
  if (req?.channels) {
    const have = new Set(s.confirmedChannels);
    const lack = req.channels.filter((c) => !have.has(c));
    if (lack.length) missing.push(`채널 미확인: ${lack.join("·")}`);
  }
  return { ok: missing.length === 0, missing };
}

function meetsExitRequires(r: GcrmRegime, s: SignalContext): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const req = r.exitRequires;
  if (req?.windImprovingWeeks !== undefined && s.windImprovingWeeks < req.windImprovingWeeks) {
    missing.push(`바람 개선 ${s.windImprovingWeeks}주 < ${req.windImprovingWeeks}주`);
  }
  if (req?.fundingNormalWeeks !== undefined && s.fundingNormalWeeks < req.fundingNormalWeeks) {
    missing.push(`자금시장 정상화 ${s.fundingNormalWeeks}주 < ${req.fundingNormalWeeks}주`);
  }
  return { ok: missing.length === 0, missing };
}

/** 진입 조건을 충족한 레짐들 — 우선순위 순(`R6 > R5 > R3 > R4 > R2 > R1`). */
export function enterCandidates(
  pillars: Record<string, number | undefined>,
  signals: SignalContext,
): { code: RegimeCode; met: string[] }[] {
  const out: { code: RegimeCode; met: string[] }[] = [];
  for (const code of REGIME_PRIORITY) {
    if (code === "R0") continue;
    const r = GCRM_REGIME_BY_CODE.get(code)!;
    const conds = evaluateConditions(r.enter, pillars, "all");
    if (!conds.ok) continue;
    const req = meetsRequires(r, signals);
    if (!req.ok) continue;
    out.push({ code, met: conds.met });
  }
  return out;
}

const stay = (prev: RegimeState): RegimeState => ({ ...prev, dwellDays: prev.dwellDays + 1 });

/**
 * ★ 레짐 전이 판정.
 *
 * ⚠ **`wave`를 받지 않는다** (§2-11 하드 게이트). 타입에도, 인자에도 없다.
 *
 * 순서:
 * 1. 커버리지가 모자라면 **전이 차단**, 직전 상태 유지 (§2-6)
 * 2. 진입 후보를 우선순위로 고른다
 * 3. 직전 레짐이 여전히 후보면 **머문다**
 * 4. 직전 레짐의 **최소 체류 기간**을 못 채웠으면 머문다 — 단 `R6`은 예외
 * 5. 직전 레짐의 **해제 조건**이 충족되지 않으면 머문다 (이력현상)
 * 6. **전이 그래프**에서 갈 수 없는 레짐이면 머문다 — 단 `R6`은 어디서든 갈 수 있다
 */
export function evaluateRegimeTransition(input: RegimeTransitionInput): RegimeTransitionResult {
  const { pillarsSlow, signals, prev, overallCoverage, asOf } = input;

  const candidates = enterCandidates(pillarsSlow, signals);
  const candidateCodes = candidates.map((c) => c.code);

  const r6 = GCRM_REGIME_BY_CODE.get("R6")!;
  const financialCrisis =
    candidateCodes.includes("R6") && meetsRequires(r6, signals).ok;

  const base = {
    candidates: candidateCodes,
    financialCrisis,
  };

  // 1 — 커버리지 게이트
  if (overallCoverage < BLOCK_TRANSITION_BELOW_COVERAGE) {
    return {
      ...base,
      state: stay(prev),
      changed: false,
      reason: "자료 부족으로 전이를 차단했다 — 직전 레짐을 유지한다",
      blocked: `총점 커버리지 ${(overallCoverage * 100).toFixed(0)}% < ${BLOCK_TRANSITION_BELOW_COVERAGE * 100}%`,
    };
  }

  const target = candidates[0];

  // 2 — 후보가 없으면 R0로 갈 수 있지만, 해제·체류 규칙은 그대로 적용된다
  const next: RegimeCode = target?.code ?? "R0";

  // 3 — 이미 그 레짐이다
  if (next === prev.code) {
    return { ...base, state: stay(prev), changed: false, reason: `${prev.code} 조건이 유지된다` };
  }

  const prevDef = GCRM_REGIME_BY_CODE.get(prev.code)!;

  // 4 — 최소 체류. ⚠ R6으로 가는 길만 예외다
  if (!DWELL_EXEMPT.includes(next) && prev.dwellDays < prevDef.minDwellDays) {
    return {
      ...base,
      state: stay(prev),
      changed: false,
      reason: `${prev.code} 최소 체류 ${prevDef.minDwellDays}영업일 중 ${prev.dwellDays}일째 — 아직 나가지 않는다`,
      blocked: "최소 체류 기간",
    };
  }

  // 5 — 해제 조건(이력현상). ⚠ R0에서 나갈 때는 해제 조건이 없다
  if (prev.code !== "R0" && !DWELL_EXEMPT.includes(next)) {
    const exit = evaluateConditions(prevDef.exit, pillarsSlow, prevDef.exitMode);
    const exitReq = meetsExitRequires(prevDef, signals);
    if (!exit.ok || !exitReq.ok) {
      return {
        ...base,
        state: stay(prev),
        changed: false,
        reason: `${prev.code} 해제 조건이 아직 충족되지 않았다 — 이력현상으로 유지한다`,
        blocked: [
          exit.ok ? null : `해제(${prevDef.exitMode}) 미충족`,
          ...exitReq.missing,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
  }

  // 6 — 전이 그래프
  if (!REGIME_EDGES[prev.code].includes(next)) {
    return {
      ...base,
      state: stay(prev),
      changed: false,
      reason: `${prev.code} → ${next}는 인접하지 않다 — 건너뛰지 않는다`,
      blocked: "전이 그래프",
    };
  }

  const def = GCRM_REGIME_BY_CODE.get(next)!;
  return {
    ...base,
    state: {
      code: next,
      nameKo: def.nameKo,
      enteredAt: asOf,
      dwellDays: 0,
      prevRegime: prev.code,
      entryReason: target?.met ?? ["어느 레짐 조건도 충족하지 않는다"],
    },
    changed: true,
    reason: `${prev.code} → ${next}`,
  };
}

/** 첫 실행용 초기 상태. */
export function initialRegimeState(asOf: string): RegimeState {
  const r0 = GCRM_REGIME_BY_CODE.get("R0")!;
  return { code: "R0", nameKo: r0.nameKo, enteredAt: asOf, dwellDays: 0, entryReason: [] };
}

export { GCRM_REGIMES, GCRM_REGIME_BY_CODE };
