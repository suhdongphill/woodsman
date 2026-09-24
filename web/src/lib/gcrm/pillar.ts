/**
 * GCRM v2 — 기둥 집계와 커버리지 게이트 (명세 §2-5 · §2-6). 순수 함수.
 *
 * ```text
 * pillar_score(축) = Σ(지표점수 × eff_weight) / Σ(eff_weight)
 * coverage         = Σ(쓴 지표의 presence_weight) / Σ(설계된 전체 presence_weight)
 * ```
 *
 * ## ⚠ 커버리지의 분모가 이 파일에서 가장 중요한 결정이다
 * 명세는 「Σ(eff of 사용) / Σ(eff of 전체)」라고 적었는데, **그대로 읽으면 뜻이 뒤집힌다.**
 * `eff_weight`에는 신선도가 들어 있고, 한 번도 관측된 적 없는 지표는 신선도가 0이라
 * 분모에서도 사라진다 — 그러면 **안 본 지표가 많을수록 커버리지가 올라간다.**
 *
 * 그래서 분모는 **설계 가중치 전체**로 잡는다.
 * - `presence_weight = base_weight × evidence_factor` — 「완전히 신선할 때의 유효 가중치」
 * - 분모에는 **못 채우는 자리(`unavailable`)도 남는다.** 지우면 커버리지가 늘 100%가 된다
 * - 신선도는 분모에 넣지 않는다. 점수의 **가중 평균**에만 들어가고, 신뢰도(§2-7)가 따로 센다.
 *   양쪽에 넣으면 같은 사실로 두 번 깎는다
 *
 * 따라서 **운영 커버리지는 구조적 커버리지를 넘을 수 없다**(`pillars.ts`의 `structuralCoverage`).
 *
 * ## ⚠ `INSUFFICIENT`는 0이 아니다
 * 게이트에 걸린 기둥은 0점이 아니라 **상위 집계의 분모에서 빠진다.**
 * 0으로 넣으면 「자료가 없다」가 「아주 나쁘다」가 된다.
 *
 * ## ⚠ raw와 oriented를 섞지 않는다
 * 지표 점수는 이미 **우호 방향**이다(높을수록 자본에 우호). 그 가중 평균이 `scoreOri`다.
 * 화면이 쓰는 `scoreRaw`는 스트레스 기둥에서 `100 − scoreOri`다 —
 * 「위험전이 76」은 위험이 크다는 뜻이어야 한다. 레짐 조건(§2-13)도 raw를 본다.
 */
import { flattenPillar, type GcrmPillar } from "./config/pillars";
import { GATES, type Axis, type EvidenceKind } from "./config/model";
import { effectiveWeight, type Staleness } from "./weights";

/** 한 지표가 한 축에 대해 내놓은 것. `score`가 없으면 쓰지 않는다. */
export type IndicatorInput = {
  code: string;
  /**
   * ⚠ 이 축에 **참여하는 지표인가**(명세 §2-4). 분기 지표는 바람·파도에 참여하지 않는다.
   * `false`면 결측이 아니라 **분모에서도 빠진다** — 생산성에 「오늘」이 없는 것은 자료 부족이 아니다.
   * 기본값은 `true`로 본다(주지 않으면 참여한다).
   */
  applicable?: boolean;
  /** 축 점수(0~100, **지표 자신의 polarity 적용 후**). 없으면 결측 */
  score?: number;
  /** 지표 정의의 polarity — 기둥이 부호를 덮어썼는지 판단하는 데 쓴다 */
  polarity: 1 | -1;
  evidence: EvidenceKind;
  staleness: Staleness;
  /** 왜 없는지. ⚠ 화면이 이 문장을 그대로 쓴다 */
  missingReason?: string;
  enabled: boolean;
  /**
   * 백분위를 낼 때 **실제로 쓴 관측 수**(창을 자른 뒤). 신뢰도의 `depth`가 이것을 창 길이로 나눈다.
   * ⚠ 점수에는 들어가지 않는다 — 짧은 역사를 **깎는 것이 아니라 드러내는** 값이다.
   */
  obsCount?: number;
};

export type Contribution = {
  indicator: string;
  path: string;
  baseWeight: number;
  effWeight: number;
  presenceWeight: number;
  /** 기둥에 들어간 점수 — 부호 덮어쓰기까지 반영한 값 */
  score: number;
  /** 점수 × eff / Σeff — 기둥 점수에서 이 지표가 차지한 몫 */
  share: number;
  /** ⚠ 기둥이 부호를 덮어썼는가 */
  polarityFlipped: boolean;
};

export type Exclusion = {
  indicator: string | null;
  path: string;
  presenceWeight: number;
  /** MISSING · STALE · DISABLED · UNAVAILABLE */
  kind: "MISSING" | "STALE" | "DISABLED" | "UNAVAILABLE";
  reason: string;
};

export type PillarAxisResult = {
  pillar: string;
  axis: Axis;
  status: "OK" | "INSUFFICIENT";
  /** 화면용 — 원래 방향. 스트레스 기둥이면 높을수록 나쁘다 */
  scoreRaw?: number;
  /** 집계용 — 우호 방향 */
  scoreOri?: number;
  coverage: number;
  nUsed: number;
  nTotal: number;
  /** 기여도 내림차순 */
  contributions: Contribution[];
  /** ⚠ 무엇이 왜 빠졌는지. 보이지 않으면 설명이 아니다 */
  excluded: Exclusion[];
  /** ⚠ 이 축에 참여하지 않아 **분모에서도 뺀** 지표. 결측과 구분해 보여 준다 */
  notApplicable: { indicator: string; path: string; weight: number }[];
};

/**
 * 기둥 × 축 점수.
 *
 * @param inputs 지표 코드 → 그 축의 결과
 */
export function computePillarAxis(
  pillar: GcrmPillar,
  axis: Axis,
  inputs: Map<string, IndicatorInput>,
): PillarAxisResult {
  const flat = flattenPillar(pillar);

  let denom = 0; // 설계된 전체 presence weight
  let usedPresence = 0;
  let effSum = 0;
  let weighted = 0;
  const contributions: Contribution[] = [];
  const excluded: Exclusion[] = [];
  const notApplicable: PillarAxisResult["notApplicable"] = [];
  let nTotal = 0;

  for (const m of flat) {
    if (m.indicator === null) {
      // ⚠ 못 채우는 자리도 분모에 남는다. evidence를 모르므로 1.00으로 본다(분모를 줄이지 않는 쪽).
      denom += m.weight;
      excluded.push({
        indicator: null,
        path: m.path,
        presenceWeight: m.weight,
        kind: "UNAVAILABLE",
        reason: m.reason ?? "채울 수 없는 자리",
      });
      continue;
    }

    const input = inputs.get(m.indicator);

    // ⚠ 명세 §2-4 — 이 축에 참여하지 않는 지표는 **분모에서도 뺀다.**
    //   결측으로 세면 월간·분기 지표가 섞인 기둥은 바람·파도를 영원히 못 낸다.
    //   (2026-09-19: 처음에 분모에 남겨 두어 세 축이 전부 자료 부족으로 나왔다 — 데이터가 아니라 이 줄이 원인이었다)
    if (input && input.applicable === false) {
      notApplicable.push({ indicator: m.indicator, path: m.path, weight: m.weight });
      continue;
    }

    nTotal += 1;

    if (!input || !input.enabled) {
      denom += m.weight;
      excluded.push({
        indicator: m.indicator,
        path: m.path,
        presenceWeight: m.weight,
        kind: "DISABLED",
        reason: input ? "꺼 둔 지표다" : "입력이 없다",
      });
      continue;
    }

    const { effWeight, presenceWeight } = effectiveWeight(m.weight, input.staleness, input.evidence);
    denom += presenceWeight;

    if (input.score === undefined) {
      excluded.push({
        indicator: m.indicator,
        path: m.path,
        presenceWeight,
        kind: "MISSING",
        reason: input.missingReason ?? "점수를 내지 못했다",
      });
      continue;
    }
    if (input.staleness.status === "MISSING") {
      excluded.push({
        indicator: m.indicator,
        path: m.path,
        presenceWeight,
        kind: "STALE",
        reason: input.staleness.detail,
      });
      continue;
    }

    // ⚠ 기둥이 부호를 덮어썼으면 여기서 되돌린다. 지표 점수는 지표 자신의 부호로 계산돼 있다.
    const flipped = m.polarity !== undefined && m.polarity !== input.polarity;
    const score = flipped ? 100 - input.score : input.score;

    usedPresence += presenceWeight;
    effSum += effWeight;
    weighted += effWeight * score;
    contributions.push({
      indicator: m.indicator,
      path: m.path,
      baseWeight: m.weight,
      effWeight,
      presenceWeight,
      score,
      share: 0, // 아래에서 채운다
      polarityFlipped: flipped,
    });
  }

  const coverage = denom === 0 ? 0 : usedPresence / denom;
  const nUsed = contributions.length;

  if (coverage < GATES.pillarMinCoverage || effSum === 0) {
    return {
      pillar: pillar.code,
      axis,
      status: "INSUFFICIENT",
      coverage,
      nUsed,
      nTotal,
      contributions: [],
      excluded,
      notApplicable,
    };
  }

  const scoreOri = weighted / effSum;
  const scoreRaw = pillar.polarity === "stress" ? 100 - scoreOri : scoreOri;

  for (const c of contributions) c.share = (c.effWeight * c.score) / effSum;
  contributions.sort((a, b) => b.effWeight - a.effWeight);

  return {
    pillar: pillar.code,
    axis,
    status: "OK",
    scoreRaw,
    scoreOri,
    coverage,
    nUsed,
    nTotal,
    contributions,
    excluded,
    notApplicable,
  };
}

export type AxisResult = {
  axis: Axis;
  status: "OK" | "INSUFFICIENT";
  /** 우호 방향 종합 점수 */
  score?: number;
  /** ⚠ 게이트가 보는 값 — **점수를 낸 기둥**의 가중치 비율 */
  coverage: number;
  /**
   * 참고용 — 기둥 커버리지까지 전파한 값. 「얼마나 온전한 증거로 냈나」.
   * ⚠ **게이트에 쓰지 않는다.** 쓰면 같은 부족분을 두 번 깎는다(아래 머리말).
   */
  depth: number;
  /** 집계에 들어간 기둥 */
  used: string[];
  /** ⚠ 빠진 기둥과 사유 */
  dropped: { pillar: string; coverage: number; reason: string }[];
  /** 이 축에 애초에 참여하지 않는 기둥 — 분모에서도 빠진다 */
  notApplicable: string[];
};

/**
 * 기둥들을 한 축 점수로 모은다 (§2-6).
 *
 * ⚠ `INSUFFICIENT` 기둥은 **분모에서 빠진다** — 0점으로 넣지 않는다.
 *
 * ## ⚠ 축 커버리지는 기둥 커버리지를 전파하지 **않는다**
 * 처음에 전파하게 만들었더니 세 축이 전부 게이트를 못 넘었다. 원인은 데이터가 아니라 산식이었다 —
 * 기둥 게이트(60%)를 **이미 통과한** 기둥을 축에서 커버리지만큼 또 깎으면, 기둥들이 게이트 언저리에
 * 있을 때 축 게이트(70%)는 **구조적으로 도달 불가능**해진다. 같은 부족분을 두 번 세는 것이다.
 *
 * 명세의 층별 게이트는 각 층이 자기 몫을 보게 되어 있다 —
 * 기둥 게이트는 「이 기둥이 충분히 채워졌나」, 축 게이트는 「점수를 낸 기둥이 충분한가」.
 * 전파한 값은 `depth`로 **따로 돌려준다**(버리지 않는다. 화면과 신뢰도가 쓴다).
 *
 * ## ⚠ 참여하지 않는 기둥은 분모에서도 빠진다
 * 생산성·자본형성으로 이뤄진 기둥에 「파도」는 없다. 없는 것을 결측으로 세면
 * 파도 축은 영원히 자료 부족이 된다. `summaryWeights[axis] === 0`이 그 선언이다
 * (분기 지표를 바람·파도에서 빼는 것과 같은 규칙).
 */
export function computeAxis(
  pillars: GcrmPillar[],
  results: PillarAxisResult[],
  axis: Axis,
): AxisResult {
  const byCode = new Map(results.filter((r) => r.axis === axis).map((r) => [r.pillar, r]));
  let totalWeight = 0;
  let usedWeight = 0;
  let coveredWeight = 0;
  let weighted = 0;
  const used: string[] = [];
  const dropped: AxisResult["dropped"] = [];
  const notApplicable: string[] = [];

  for (const p of pillars) {
    if (p.summaryWeights[axis] === 0) {
      notApplicable.push(p.code);
      continue;
    }
    totalWeight += p.axisWeight;
    const r = byCode.get(p.code);
    if (!r || r.status !== "OK" || r.scoreOri === undefined) {
      dropped.push({
        pillar: p.code,
        coverage: r?.coverage ?? 0,
        reason: r ? `반영률 ${(r.coverage * 100).toFixed(0)}% — 자료 부족` : "계산되지 않았다",
      });
      continue;
    }
    used.push(p.code);
    usedWeight += p.axisWeight;
    coveredWeight += p.axisWeight * r.coverage;
    weighted += p.axisWeight * r.scoreOri;
  }

  const coverage = totalWeight === 0 ? 0 : usedWeight / totalWeight;
  const depth = totalWeight === 0 ? 0 : coveredWeight / totalWeight;
  if (coverage < GATES.axisMinCoverage || usedWeight === 0) {
    return { axis, status: "INSUFFICIENT", coverage, depth, used, dropped, notApplicable };
  }
  return { axis, status: "OK", score: weighted / usedWeight, coverage, depth, used, dropped, notApplicable };
}
