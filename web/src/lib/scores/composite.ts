/**
 * 합성 점수 · 커버리지 · 신뢰도 · 하드 트리거 — 순수 함수. Score Calculation Specification v1.0 §4 · §42~§45.
 *
 * ## ⚠ 결측은 분모에서 뺀다 — 그리고 반드시 커버리지를 함께 낸다
 * 없는 입력을 0점이나 50점으로 채우면 「안 본 것」이 판정이 된다(버블 점수와 같은 원칙).
 *
 * ## 커버리지 규칙 (명세 §44)
 * | 가용 가중치 | 처리 |
 * |---|---|
 * | ≥ 80% | 재정규화해서 낸다 |
 * | 60% ~ 80% | 재정규화해서 계산하되 **LOW_CONFIDENCE** 표시 |
 * | < 60% | **DO_NOT_PUBLISH** — 점수를 내지 않는다 |
 *
 * ⚠ 명세는 60~80% 구간을 「LOW CONFIDENCE」라고만 적었다. 재정규화 없이는 계산이 안 되므로
 *   **재정규화하되 표시한다**로 읽었다(설계서 11장에 이 해석을 적었다).
 *
 * ## ⚠ 기여도를 함께 낸다
 * 72점이면 무엇이 몇 점을 냈는지. 기여도 없는 종합점수는 믿을 이유가 없다.
 */

/** 명세 §4 — 일반 지표 0.70·0.30, 스트레스 지표 0.60·0.40. */
export const LEVEL_MOMENTUM_WEIGHTS = {
  general: { level: 0.7, momentum: 0.3 },
  stress: { level: 0.6, momentum: 0.4 },
} as const;

/** 명세 §44 */
export const COVERAGE_RENORMALIZE = 80;
export const COVERAGE_PUBLISH = 60;

export type PublishState = "OK" | "LOW_CONFIDENCE" | "DO_NOT_PUBLISH";

export type ComponentInput = {
  key: string;
  weight: number;
  /** 0~100. 없으면 결측 */
  score?: number;
  /** 결측 이유(「무료 출처 없음」 · 「역사 5년 미만」 …) — 화면이 그대로 말한다 */
  missingReason?: string;
};

export type Contribution = {
  key: string;
  weight: number;
  /** 재정규화 뒤 실제로 쓰인 가중치. 결측이면 0 */
  effectiveWeight: number;
  score?: number;
  /** 합성 점수에 보탠 점수 = effectiveWeight × score */
  points: number;
  missingReason?: string;
};

export type CompositeResult = {
  /** ⚠ DO_NOT_PUBLISH면 undefined — 계산값이 있어도 내보내지 않는다 */
  score?: number;
  coverage: number;
  state: PublishState;
  contributions: Contribution[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 명세 §43 — 가용 가중치 / 전체 가중치 × 100 */
export function coverageOf(components: ComponentInput[]): number {
  const total = components.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return 0;
  const available = components.filter((c) => isScore(c.score)).reduce((s, c) => s + c.weight, 0);
  return round1((available / total) * 100);
}

function isScore(v: number | undefined): v is number {
  return v !== undefined && Number.isFinite(v);
}

export function publishState(coverage: number): PublishState {
  if (coverage < COVERAGE_PUBLISH) return "DO_NOT_PUBLISH";
  if (coverage < COVERAGE_RENORMALIZE) return "LOW_CONFIDENCE";
  return "OK";
}

/**
 * 가중 합성(명세 §6~§41의 모든 식이 이 함수를 지난다).
 * 가중치는 **설정에서 온다**(`config.ts`) — 이 함수는 숫자를 모른다.
 */
export function compose(components: ComponentInput[]): CompositeResult {
  const coverage = coverageOf(components);
  const state = publishState(coverage);
  const availableWeight = components.filter((c) => isScore(c.score)).reduce((s, c) => s + c.weight, 0);

  const contributions: Contribution[] = components.map((c) => {
    const effectiveWeight = isScore(c.score) && availableWeight > 0 ? c.weight / availableWeight : 0;
    return {
      key: c.key,
      weight: c.weight,
      effectiveWeight,
      score: c.score,
      points: isScore(c.score) ? effectiveWeight * c.score : 0,
      ...(c.missingReason && !isScore(c.score) ? { missingReason: c.missingReason } : {}),
    };
  });

  const raw = contributions.reduce((s, c) => s + c.points, 0);
  return {
    score: state === "DO_NOT_PUBLISH" || availableWeight === 0 ? undefined : round1(raw),
    coverage,
    state,
    contributions,
  };
}

/** 명세 §4 — 수준·모멘텀을 합친다. 모멘텀이 없으면 **수준만** 쓰고 그 사실을 돌려준다. */
export function indicatorScore(
  level: number | undefined,
  momentum: number | undefined,
  kind: "general" | "stress",
): { score?: number; momentumUsed: boolean } {
  if (!isScore(level)) return { score: undefined, momentumUsed: false };
  if (!isScore(momentum)) return { score: level, momentumUsed: false };
  const w = LEVEL_MOMENTUM_WEIGHTS[kind];
  return { score: w.level * level + w.momentum * momentum, momentumUsed: true };
}

/** 명세 §42 — 신뢰도 구성 가중치. */
export const CONFIDENCE_WEIGHTS = {
  sourceQuality: 0.3,
  freshness: 0.25,
  coverage: 0.2,
  revisionStability: 0.1,
  frequencyMatch: 0.1,
  crossConfirmation: 0.05,
} as const;

export type ConfidenceParts = { [K in keyof typeof CONFIDENCE_WEIGHTS]: number };

/** 명세 §42 — 각 부분 0~100을 받아 가중합. ⚠ 부분을 모르면 부르는 쪽이 채우지 말고 compose로 결측 처리한다. */
export function confidence(parts: ConfidenceParts): number {
  return round1(
    (Object.keys(CONFIDENCE_WEIGHTS) as (keyof ConfidenceParts)[]).reduce(
      (s, k) => s + CONFIDENCE_WEIGHTS[k] * Math.min(100, Math.max(0, parts[k])),
      0,
    ),
  );
}

export type HardTrigger = {
  id: string;
  /** 발동하면 점수 상한 */
  cap: number;
  fired: boolean;
};

/**
 * 명세 §45 — 하드 트리거. 발동한 것 중 **가장 낮은 상한**을 적용한다.
 * ⚠ 임계값(85·80·…)은 여기 없다 — 부르는 쪽이 설정에서 판정해 `fired`로 넘긴다(백테스트로 교정할 수 있게).
 */
export function applyHardTriggers(
  score: number | undefined,
  triggers: HardTrigger[],
): { score?: number; applied: string[] } {
  if (!isScore(score)) return { score, applied: [] };
  const fired = triggers.filter((t) => t.fired);
  if (fired.length === 0) return { score, applied: [] };
  const cap = Math.min(...fired.map((t) => t.cap));
  return { score: Math.min(score, cap), applied: fired.filter((t) => score > t.cap).map((t) => t.id) };
}
