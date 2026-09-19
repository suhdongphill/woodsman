/**
 * GCRM v2 — 유효 가중치 (명세 §2-5). 순수 함수.
 *
 * ```text
 * quality_factor   = staleness_factor × evidence_factor
 * effective_weight = base_weight × quality_factor
 * ```
 *
 * ## ⚠ `horizon_weight`는 여기 들어오지 않는다
 * 시간축 합성(`horizon.ts`)에서 이미 쓰였다. 다시 곱하면 이중 계산이다(명세 B-6).
 *
 * ## ⚠ 신선도는 **공표 주기 기준**이다
 * 분기 지표를 하루 지났다고 깎지 않고, 일간 지표를 일주일 묵은 값으로 파도에 쓰지 않는다.
 * 같은 「5일」이 일간 계열에서는 다섯 주기이고 분기 계열에서는 0.05주기다.
 */
import {
  STALENESS_FACTOR,
  STALENESS_CYCLES,
  CYCLE_DAYS,
  EVIDENCE_FACTOR,
  type EvidenceKind,
} from "./config/model";
import type { Freq } from "./config/indicators";

/** 달력일 차이. 음수면 관측일이 as_of보다 뒤라는 뜻이다 — 있으면 안 되는 일이다. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type Staleness =
  | { status: "OK"; factor: number; cycles: number; ageDays: number; label: string }
  | { status: "MISSING"; cycles: number; ageDays: number; detail: string };

/**
 * 신선도 계수.
 *
 * ⚠ 세 주기 이상 지나면 계수가 아니라 **`MISSING`**이다 — 분모에서 빠진다.
 * 0.3 같은 작은 계수로 남겨 두면 「아주 오래된 값을 조금 반영했다」가 되는데,
 * 그건 반영한 것도 안 한 것도 아니다.
 */
export function stalenessOf(freq: Freq, obsDate: string, asOf: string): Staleness {
  const ageDays = daysBetween(obsDate, asOf);
  const cycle = CYCLE_DAYS[freq];
  const cycles = ageDays / cycle;

  // ⚠ 관측일이 as_of보다 뒤면 미래 데이터다. 정규화가 잘라 주지만 여기서도 막는다.
  if (ageDays < 0) {
    return {
      status: "MISSING",
      cycles,
      ageDays,
      detail: `관측일 ${obsDate}이 기준일 ${asOf}보다 뒤다 — 미래 값이다`,
    };
  }
  if (cycles < STALENESS_CYCLES.fresh)
    return { status: "OK", factor: STALENESS_FACTOR.fresh, cycles, ageDays, label: "최신 발표" };
  if (cycles < STALENESS_CYCLES.withinCycle)
    return { status: "OK", factor: STALENESS_FACTOR.withinCycle, cycles, ageDays, label: "공표주기 이내" };
  if (cycles < STALENESS_CYCLES.oneCycleLate)
    return { status: "OK", factor: STALENESS_FACTOR.oneCycleLate, cycles, ageDays, label: "한 주기 경과" };
  if (cycles < STALENESS_CYCLES.twoCyclesLate)
    return { status: "OK", factor: STALENESS_FACTOR.twoCyclesLate, cycles, ageDays, label: "두 주기 경과" };
  return {
    status: "MISSING",
    cycles,
    ageDays,
    detail: `${cycles.toFixed(1)}주기(${ageDays}일) 지났다 — 세 주기 이상은 쓰지 않는다`,
  };
}

export function evidenceOf(kind: EvidenceKind): number {
  return EVIDENCE_FACTOR[kind];
}

/**
 * 유효 가중치. `staleness`가 `MISSING`이면 이 지표는 쓰지 않는다.
 *
 * ⚠ `presenceWeight`를 함께 돌려주는 이유는 커버리지 때문이다 — `pillar.ts` 머리말 참조.
 */
export function effectiveWeight(
  baseWeight: number,
  staleness: Staleness,
  evidence: EvidenceKind,
): { effWeight: number; presenceWeight: number; quality: number } {
  const ev = evidenceOf(evidence);
  const presenceWeight = baseWeight * ev;
  if (staleness.status === "MISSING") return { effWeight: 0, presenceWeight, quality: 0 };
  const quality = staleness.factor * ev;
  return { effWeight: baseWeight * quality, presenceWeight, quality };
}
