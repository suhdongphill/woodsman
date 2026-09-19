/**
 * GCRM v2 — 방향 · 정렬도 · 상태 (명세 §2-8 · §2-9). 순수 함수.
 *
 * ## ⚠ v1의 Dispersion 수식을 쓰지 않는다 (명세 B-3)
 * 원 문서의 `(|C−W| + |W−D| + |C−D|) / 3`은 대수적으로 **`2 × (최대 − 최소) / 3`과 완전히 같다.**
 * 세 값 중 **가운데 값이 계산에 전혀 들어가지 않는다** — 세 시간축을 비교한다고 써 놓고 실제로는 둘만 본다.
 * 게다가 0–100 구간에서 최대가 66.67로 고정돼, dispersion이 50을 넘으면 proximity가 전부 0으로 뭉개진다.
 *
 * 그래서 같은 정보를 더 정직하게 쓴다.
 * ```text
 * spread    = max − min
 * proximity = 100 − spread          // 0–100 전 구간을 선형으로 쓴다
 * alignment = 0.5 × proximity + 0.5 × dir_agreement
 * ```
 * 가운데 값을 살리고 싶으면 표준편차를 **보조 표시**로 붙이되 점수에는 넣지 않는다(해석이 어려워진다).
 *
 * ## ⚠ 상태는 점수 구간이 아니라 **결정 트리**가 정한다 (명세 B-5)
 * v1은 같은 34점에 `DIVERGENT`(§14)와 `TRANSITION`(§15)을 둘 다 적었다.
 * 점수와 범주를 분리하고, **`TRANSITION`을 `DIVERGENT`보다 먼저** 판정한다.
 *
 * ## ⚠ 방향에는 불감대가 있다 (명세 B-12)
 * 「무엇 대비 상승인가」가 없으면 화살표에 뜻이 없고, 불감대가 없으면 소수점 아래 흔들림으로
 * **매일 뒤집힌다.** 축마다 비교 시점(lag)과 불감대가 다르다.
 */
import {
  DIRECTION,
  DIR_AGREEMENT,
  ALIGNMENT_BANDS,
  type Axis,
} from "./config/model";

export type Direction = "UP" | "DOWN" | "FLAT";

export type AlignmentState =
  | "ALIGNED_UP"
  | "ALIGNED_DOWN"
  | "TRANSITION"
  | "DIVERGENT"
  | "MIXED"
  | "UNDETERMINED";

/**
 * 한 축의 방향 (§2-8).
 *
 * ⚠ 비교 대상이 없으면 `FLAT`이 아니라 **`undefined`**다 — 「안 움직였다」와 「모른다」는 다르다.
 * @param lagged `as_of − lag` 시점의 같은 축 점수
 */
export function directionOf(
  axis: Axis,
  current: number | undefined,
  lagged: number | undefined,
): Direction | undefined {
  if (current === undefined || lagged === undefined) return undefined;
  if (!Number.isFinite(current) || !Number.isFinite(lagged)) return undefined;
  const delta = current - lagged;
  const band = DIRECTION.deadband[axis];
  if (Math.abs(delta) <= band) return "FLAT";
  return delta > 0 ? "UP" : "DOWN";
}

/** `as_of − lag`에 해당하는 과거 점수를 고른다. ⚠ 없으면 지어내지 않고 `undefined`. */
export function laggedScore(
  history: { asOf: string; score: number | undefined }[],
  axis: Axis,
  index: number,
): number | undefined {
  const lag = DIRECTION.lag[axis];
  const target = index - lag;
  if (target < 0 || target >= history.length) return undefined;
  return history[target].score;
}

export type DirectionAgreement = {
  value: number;
  /** 어떤 규칙이 적용됐는지 — 화면이 「왜 이 점수인가」를 말할 수 있어야 한다 */
  rule: "ALL_SAME" | "TWO_SAME_ONE_FLAT" | "TWO_SAME_ONE_OPPOSITE" | "OTHERWISE";
};

/**
 * 방향 일치도 (§2-9).
 *
 * ```text
 * 모두 같음                 100
 * 둘이 같고 하나가 FLAT      75
 * 둘이 같고 하나가 반대      35
 * 그 외 / 판정 불가            0
 * ```
 *
 * ## ⚠ 명세가 정하지 않은 두 경우 — 여기서 정했다
 * 1. **셋 다 FLAT**: 글자대로면 「모두 같음」이라 100이다. 그런데 아무것도 움직이지 않는 것을
 *    「강한 정렬」이라 부르면 오독을 부른다. 그래서 **`OTHERWISE`(0)** 로 둔다.
 * 2. **FLAT·FLAT·방향 하나**: 「둘이 같고 하나가 FLAT」의 뜻은 *같은 둘이 방향을 가질 때*다.
 *    멈춘 둘과 움직이는 하나는 정렬의 증거가 아니므로 **0**이다.
 *
 * 둘 다 `provenance.ts`에 `D`(근거 없음)로 올려 뒀다.
 */
export function directionAgreement(dirs: (Direction | undefined)[]): DirectionAgreement {
  if (dirs.length !== 3 || dirs.some((d) => d === undefined)) {
    return { value: DIR_AGREEMENT.otherwise, rule: "OTHERWISE" };
  }
  const [a, b, c] = dirs as Direction[];
  const moving = [a, b, c].filter((d) => d !== "FLAT");

  // ⚠ 움직이는 축이 하나 이하면 정렬을 말할 근거가 없다(위 머리말 1·2).
  if (moving.length <= 1) return { value: DIR_AGREEMENT.otherwise, rule: "OTHERWISE" };

  if (a === b && b === c) return { value: DIR_AGREEMENT.allSame, rule: "ALL_SAME" };

  const flats = [a, b, c].filter((d) => d === "FLAT").length;
  const ups = [a, b, c].filter((d) => d === "UP").length;
  const downs = [a, b, c].filter((d) => d === "DOWN").length;

  // 둘이 같은 방향, 나머지 하나가 FLAT
  if (flats === 1 && (ups === 2 || downs === 2)) {
    return { value: DIR_AGREEMENT.twoSameOneFlat, rule: "TWO_SAME_ONE_FLAT" };
  }
  // 둘이 같은 방향, 나머지 하나가 반대
  if (flats === 0 && (ups === 2 || downs === 2)) {
    return { value: DIR_AGREEMENT.twoSameOneOpposite, rule: "TWO_SAME_ONE_OPPOSITE" };
  }
  return { value: DIR_AGREEMENT.otherwise, rule: "OTHERWISE" };
}

export type AlignmentResult = {
  spread: number;
  proximity: number;
  dirAgreement: number;
  dirRule: DirectionAgreement["rule"];
  alignment: number;
  band: string;
  /** ⚠ 보조 표시 전용 — **점수에 들어가지 않는다**. 가운데 값을 잃지 않으려고 둔다 */
  stdev: number;
};

/** 정렬도 (§2-9). ⚠ 점수는 `alignment`이고 상태는 `alignmentState()`가 따로 정한다. */
export function alignmentOf(
  scores: { tide: number; wind: number; wave: number },
  dirs: { tide?: Direction; wind?: Direction; wave?: Direction },
): AlignmentResult {
  const xs = [scores.tide, scores.wind, scores.wave];
  const spread = Math.max(...xs) - Math.min(...xs);
  const proximity = 100 - spread;
  const agree = directionAgreement([dirs.tide, dirs.wind, dirs.wave]);
  const alignment = 0.5 * proximity + 0.5 * agree.value;
  const mean = xs.reduce((s, x) => s + x, 0) / 3;
  const stdev = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / 3);
  return {
    spread,
    proximity,
    dirAgreement: agree.value,
    dirRule: agree.rule,
    alignment,
    band: alignmentBand(alignment),
    stdev,
  };
}

export function alignmentBand(alignment: number): string {
  for (const b of ALIGNMENT_BANDS) if (alignment >= b.min) return b.label;
  return ALIGNMENT_BANDS[ALIGNMENT_BANDS.length - 1].label;
}

export type StateInput = {
  alignment: number;
  dirs: { tide?: Direction; wind?: Direction; wave?: Direction };
  /** 어느 축이라도 자료 부족이면 상태를 내지 않는다 */
  anyAxisInsufficient: boolean;
  /** 바람이 같은 방향으로 이어진 주 수 (§2-11) */
  windPersistenceWeeks: number;
};

export type StateResult = {
  state: AlignmentState;
  /** 트리의 몇 번에서 결정됐는가 — 화면이 「왜」를 말할 수 있어야 한다 */
  rule: 1 | 2 | 3 | 4 | 5;
  reason: string;
};

/**
 * 상태 결정 트리 (§2-9).
 *
 * ```text
 * 1. 축 중 INSUFFICIENT가 있으면                     → UNDETERMINED
 * 2. 세 방향이 모두 같고 alignment ≥ 65
 *      우호 방향   → ALIGNED_UP
 *      스트레스 방향 → ALIGNED_DOWN
 * 3. tide 방향과 (wind, wave)가 반대이고
 *    wind persistence ≥ 3주                          → TRANSITION
 * 4. alignment < 45                                  → DIVERGENT
 * 5. 그 외                                           → MIXED
 * ```
 *
 * ⚠ **`TRANSITION`이 `DIVERGENT`보다 먼저**다. 순서를 바꾸면 전환 국면이 이탈로 분류된다.
 * ⚠ 축 점수는 **우호 방향**이므로 `UP`이 곧 자본에 우호다.
 */
export function alignmentState(input: StateInput): StateResult {
  const { alignment, dirs, anyAxisInsufficient, windPersistenceWeeks } = input;

  if (anyAxisInsufficient || !dirs.tide || !dirs.wind || !dirs.wave) {
    return {
      state: "UNDETERMINED",
      rule: 1,
      reason: anyAxisInsufficient
        ? "축 하나 이상이 자료 부족이다 — 정렬을 말할 수 없다"
        : "방향을 판정할 수 없는 축이 있다(비교할 과거 점수가 없다)",
    };
  }

  const { tide, wind, wave } = dirs;

  // 2 — 세 방향이 모두 같고 충분히 가깝다
  if (tide === wind && wind === wave && alignment >= 65) {
    if (tide === "UP") {
      return { state: "ALIGNED_UP", rule: 2, reason: "세 시간축이 모두 우호 방향으로 정렬됐다" };
    }
    if (tide === "DOWN") {
      return { state: "ALIGNED_DOWN", rule: 2, reason: "세 시간축이 모두 스트레스 방향으로 정렬됐다" };
    }
    // ⚠ 셋 다 FLAT — 명세가 정하지 않았다. 정렬로 부르지 않고 아래로 흘려보낸다
  }

  // 3 — 전환. ⚠ DIVERGENT보다 먼저 본다
  const opposite = (x: Direction, y: Direction) =>
    (x === "UP" && y === "DOWN") || (x === "DOWN" && y === "UP");
  if (
    wind === wave &&
    opposite(tide, wind) &&
    windPersistenceWeeks >= 3
  ) {
    return {
      state: "TRANSITION",
      rule: 3,
      reason: `조류는 ${tide === "UP" ? "버티는데" : "돌아섰는데"} 바람·파도가 반대로 ${windPersistenceWeeks}주 이어졌다`,
    };
  }

  // 4 — 이탈
  if (alignment < 45) {
    return { state: "DIVERGENT", rule: 4, reason: `정렬도 ${alignment.toFixed(1)} — 세 시간축이 따로 논다` };
  }

  // 5
  return { state: "MIXED", rule: 5, reason: "방향이 갈리지만 이탈이라 부를 정도는 아니다" };
}

/** 화면 표기 — ⚠ 정렬도는 **방향과 반드시 함께** 보여 준다(§2-9). */
export const STATE_LABEL: Record<AlignmentState, string> = {
  ALIGNED_UP: "상승 정렬",
  ALIGNED_DOWN: "하락 정렬",
  TRANSITION: "전환",
  DIVERGENT: "이탈",
  MIXED: "혼조",
  UNDETERMINED: "판정 보류",
};
