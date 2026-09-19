/**
 * GCRM v2 — 모델 상수. **가중치와 임계는 설정 6벌에만 있다.** 계산 코드는 숫자를 모른다.
 * 명세: `docs/GCRM_설계점검_v2.md` §2-16.
 *
 * ## ⚠ 명세는 YAML을 말하지만 우리는 TS 데이터 파일이다
 * Worker는 실행 중에 파일을 읽지 못한다(`CLAUDE.md` §4 · `lib/scores/config.ts`가 같은 이유로
 * 같은 선택을 했다). **뜻은 그대로 지키고 형식만 바꿨다** — 숫자는 여기 한 곳에만 있고,
 * 바뀌면 `configHash()`가 바뀌며, 테스트가 합계를 대조한다.
 *
 * ## 용어 (명세 §2-1 · 원칙 1)
 * 조류 `tide` · 바람 `wind` · 파도 `wave`. **`current`라는 식별자를 만들지 않는다.**
 * 「현재 레짐」은 `active_regime`이다.
 */

export const MODEL_VERSION = "GCRM_2.0";

export type Axis = "tide" | "wind" | "wave";
export const AXES: readonly Axis[] = ["tide", "wind", "wave"] as const;

/**
 * 레짐 축 가중치.
 * - `core` — 종합 점수(§2-2 [4] overall)
 * - `transition` — 레짐 전이 증거 RTE. ⚠ **`wave`가 0이다**(§2-14 · B-10).
 *   파도가 뒷문으로 레짐을 바꾸지 못하게 하는 것이 이 모델의 가장 중요한 설계 판단이다.
 */
export const AXIS_WEIGHTS = {
  core: { tide: 0.5, wind: 0.35, wave: 0.15 },
  transition: { tide: 0.35, wind: 0.45, wave: 0.0, rts_slow: 0.2 },
} as const;

/**
 * 시간축 안에서 창(window)들을 합성하는 가중치 (§2-4).
 *
 * ⚠ **여기서만 쓴다.** `effective_weight = base_weight × staleness × evidence`에
 *   다시 곱하지 않는다 — 명세 B-6이 지적한 이중 계산이다.
 */
export const HORIZON_WEIGHTS = {
  tide: { M1: 0.35, M3: 0.3, M6: 0.2, M12: 0.15 },
  wind: { W1: 0.45, W4: 0.35, W13: 0.2 },
  wave: { D1: 0.5, D3: 0.3, D5: 0.2 },
} as const;

/** 창 길이(영업일). 정규화가 평균을 낼 구간이다. */
export const HORIZON_DAYS = {
  M1: 21, M3: 63, M6: 126, M12: 252,
  W1: 5, W4: 20, W13: 65,
  D1: 1, D3: 3, D5: 5,
} as const;

/**
 * 커버리지 게이트 (§2-6).
 * ⚠ `INSUFFICIENT`는 0이 아니다. 상위 집계의 **분모에서 빠진다.**
 */
export const GATES = {
  pillarMinCoverage: 0.6,
  axisMinCoverage: 0.7,
  overallMinCoverage: 0.7,
} as const;

/**
 * 방향 판정 (§2-8). `lag`는 영업일, `deadband`는 점수.
 * ⚠ 불감대가 없으면 소수점 아래 흔들림으로 **화살표가 매일 뒤집힌다.**
 */
export const DIRECTION = {
  lag: { tide: 63, wind: 20, wave: 5 },
  deadband: { tide: 2.0, wind: 2.0, wave: 3.0 },
} as const;

/** 정렬도 방향 일치 점수 (§2-9). 점수 구간이 아니라 **결정 트리**가 상태를 정한다. */
export const DIR_AGREEMENT = {
  allSame: 100,
  twoSameOneFlat: 75,
  twoSameOneOpposite: 35,
  otherwise: 0,
} as const;

/** 정렬도 구간 표시 (§2-9). 방향과 **반드시 함께** 보여 준다. */
export const ALIGNMENT_BANDS = [
  { min: 80, label: "강한 정렬" },
  { min: 65, label: "정렬" },
  { min: 45, label: "혼조" },
  { min: 25, label: "이탈" },
  { min: 0, label: "강한 이탈" },
] as const;

/**
 * 신뢰도 (§2-7). ⚠ **점수와 신뢰도를 곱하지 않는다.** 나란히 둘 뿐이다.
 * 화면에는 퍼센트가 아니라 밴드로 적는다(§D-1 — 버블 모니터와 정밀도 철학을 맞춘다).
 */
export const CONFIDENCE_WEIGHTS = {
  coverage: 0.4,
  staleness: 0.25,
  evidence: 0.2,
  channelBreadth: 0.15,
} as const;

export const CONFIDENCE_BANDS = [
  { min: 85, label: "높음" },
  { min: 70, label: "보통" },
  { min: 55, label: "낮음" },
  { min: 0, label: "참고용" },
] as const;

/** 근거 계수 (§2-5 · C-4에서 6단계 → 4단계로 줄였다). */
export const EVIDENCE_FACTOR = {
  official: 1.0,
  market: 0.95,
  manual: 0.9,
  judgment: 0.7,
} as const;
export type EvidenceKind = keyof typeof EVIDENCE_FACTOR;

/**
 * 신선도 계수 (§2-5). **공표 주기 기준**으로 센다 —
 * 분기 지표를 하루 지났다고 깎지 않고, 일간 지표를 일주일 묵은 값으로 파도에 쓰지 않는다.
 */
export const STALENESS_FACTOR = {
  fresh: 1.0,
  withinCycle: 0.9,
  oneCycleLate: 0.7,
  twoCyclesLate: 0.5,
} as const;
/** 세 주기 이상 지나면 계수가 아니라 `MISSING`이다(분모에서 제외). */
export const STALE_DROP_CYCLES = 3;

/** 민감도 분석 (§2-15). */
export const SENSITIVITY = {
  /** 축 가중치 섭동 폭(pp). 나머지 둘은 **원래 비율대로 비례 재배분**한다. */
  axisDeltaPp: 5,
  /** 지표 `base_weight` 섭동 폭(비율). */
  indicatorDeltaRatio: 0.1,
  /** 이만큼 흔들리면 `MODEL_FRAGILITY_WARNING`. */
  fragileOverallDelta: 5,
  /** 한 지표가 기둥을 이만큼 움직이면 `DOMINANT_INDICATOR_WARNING`. */
  dominantPillarDelta: 3,
} as const;

/** 표시 규칙 (§D-1 · §2-20). 내부 저장은 소수 2자리, **화면은 5점 단위 정수**다. */
export const DISPLAY = {
  storeDecimals: 2,
  roundToNearest: 5,
} as const;
