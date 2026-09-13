/**
 * 점수 엔진 — 순수 함수. Score Calculation Specification v1.0 머리말의 순서를 코드로 옮긴다.
 *
 * RAW(이미 변환·파생된 계열) → 측정(수준/변화) → 정규화(10년 Robust Z) → 방향 → 수준·모멘텀 → 지표 점수
 * → 구성요소(여러 계열이면 평균) → 하위 점수 → 합성(커버리지·기여도) → 발행 상태
 *
 * ## ⚠ 이 함수가 지키는 것
 * - **LLM은 점수를 결정하지 않는다** — 여기엔 숫자와 규칙만 있다.
 * - **하위 점수는 발행될 때만** 부모에 들어간다. 발행 못 한 하위 점수는 부모에서 결측이다(명세 §44).
 * - **결측에는 이유가 붙는다** — 「역사 5년 미만」「고갈 구간」「무료 출처 없음」… 화면이 그 문장을 그대로 쓴다.
 * - **평가일 이전 값만** 쓴다(시점 기준). 수정이 잦은 계열의 과거 판정은 부르는 쪽이 `valuesAsOf`로 넘긴다.
 *
 * DB·네트워크 없음 — 부르는 쪽(`features/scores`)이 계열을 모아 넘기고, 결과를 저장한다.
 */
import type { SeriesPoint } from "../macro/series";
import type { ReleaseFreq } from "../macro/freshness";
import { MODEL_VERSION, SCORE_DEFINITIONS, type ScoreKey } from "./config";
import { compose, indicatorScore, type CompositeResult, type ComponentInput } from "./composite";
import { levelScore } from "./normalize";
import { momentumScore } from "./momentum";
import { SCORE_INPUTS, type ComponentSource } from "./inputs";
import { SCORE_MEASURES, type IndicatorMeasure } from "./measures";

export type SeriesInput = { points: SeriesPoint[]; freq: ReleaseFreq };

export type IndicatorResult = {
  indicator: string;
  measure: IndicatorMeasure["measure"];
  score?: number;
  /** 측정값(수준 또는 91일 변화)의 최신값 — 화면이 원래 단위로 함께 보여 준다 */
  latest?: number;
  latestDate?: string;
  momentumUsed: boolean;
  missingReason?: string;
};

export type ComponentResult = {
  key: string;
  weight: number;
  score?: number;
  missingReason?: string;
  indicators: IndicatorResult[];
  /** 하위 점수로 채운 구성요소 */
  subScore?: ScoreKey;
};

export type ScoreResult = CompositeResult & {
  scoreKey: ScoreKey;
  label: string;
  modelVersion: string;
  asOf: string;
  components: ComponentResult[];
  /** 쓰인 계열 중 가장 오래된 최신일 — 이 점수가 얼마나 묵었나 */
  oldestInput?: string;
};

function dayNum(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
}

/** 계열을 측정으로 바꾼다. 91일 변화는 각 점에서 「91일 이전 중 가장 가까운 점」과의 차이. */
export function measureSeries(points: SeriesPoint[], measure: IndicatorMeasure["measure"]): SeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (measure === "level") return sorted;
  const out: SeriesPoint[] = [];
  let j = 0;
  for (let i = 0; i < sorted.length; i++) {
    const target = dayNum(sorted[i].date) - 91;
    while (j + 1 < i && dayNum(sorted[j + 1].date) <= target) j++;
    if (dayNum(sorted[j].date) <= target) out.push({ date: sorted[i].date, value: sorted[i].value - sorted[j].value });
  }
  return out;
}

function scoreIndicator(m: IndicatorMeasure, series: Map<string, SeriesInput>, asOf: string): IndicatorResult {
  const base: IndicatorResult = { indicator: m.indicator, measure: m.measure, momentumUsed: false };
  const input = series.get(m.indicator);
  /**
   * ⚠ 필요한 구간만 남긴다 — 10년 창 + 91일 변화 + 모멘텀 여유 = **평가일 전 11년**.
   *   1990년부터 쌓인 일간 계열을 통째로 넘기면 계산량만 늘고 결과는 같다(창 밖의 점은 쓰이지 않는다).
   */
  const from = `${Number(asOf.slice(0, 4)) - 11}${asOf.slice(4)}`;
  const known = (input?.points ?? []).filter((p) => p.date <= asOf && p.date >= from);
  if (!input || known.length === 0) return { ...base, missingReason: "값이 없다(수집 전)" };

  const lastLevel = [...known].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
  if (m.guard && lastLevel.value < m.guard.below) return { ...base, missingReason: m.guard.reason };

  const measured = measureSeries(known, m.measure);
  const last = measured.at(-1);
  if (!last) return { ...base, missingReason: "변화를 계산할 만큼 값이 쌓이지 않았다" };

  const level = levelScore(measured, asOf, m.direction);
  if (!level.ok) {
    const why = level.reason === "INSUFFICIENT_HISTORY" ? "역사가 5년이 안 된다(명세 §1 최소 창)" : level.reason === "ZERO_DISPERSION" ? "값이 흩어지지 않아 정규화할 수 없다" : "값이 없다";
    return { ...base, latest: last.value, latestDate: last.date, missingReason: why };
  }
  const momentum = momentumScore(measured, asOf, input.freq, m.direction);
  const combined = indicatorScore(level.score, momentum.score, m.kind);
  return { ...base, score: combined.score, latest: last.value, latestDate: last.date, momentumUsed: combined.momentumUsed };
}

function reasonFromSource(src: ComponentSource | undefined): string {
  if (!src) return "매핑 없음";
  if (src.status === "planned") return `${src.slice}에서 붙인다 — ${src.reason}`;
  if (src.status === "unavailable") return src.reason;
  if (src.status === "computed") return `계산 계열(${src.from})의 점수화는 아직 없다`;
  return "측정 정의가 없다";
}

/**
 * 점수 하나를 계산한다. 하위 점수는 먼저 계산하고 `cache`에 둔다(같은 점수를 두 번 계산하지 않는다).
 */
export function computeScore(
  key: ScoreKey,
  series: Map<string, SeriesInput>,
  asOf: string,
  cache: Map<ScoreKey, ScoreResult> = new Map(),
): ScoreResult {
  const hit = cache.get(key);
  if (hit) return hit;

  const def = SCORE_DEFINITIONS[key];
  const inputs = SCORE_INPUTS[key] ?? {};
  const measures = SCORE_MEASURES[key] ?? {};
  const components: ComponentResult[] = [];
  const composeInputs: ComponentInput[] = [];

  for (const [component, weight] of Object.entries(def.components)) {
    const src = inputs[component];
    let result: ComponentResult = { key: component, weight, indicators: [] };

    if (src?.status === "subscore") {
      const sub = computeScore(src.score, series, asOf, cache);
      result.subScore = src.score;
      if (sub.state === "DO_NOT_PUBLISH" || sub.score === undefined) {
        result.missingReason = `하위 점수 ${sub.label}이 발행 기준 미달(커버리지 ${sub.coverage}%)`;
      } else {
        result.score = sub.score;
      }
    } else if (src?.status === "available" && measures[component]) {
      const indicators = measures[component].map((m) => scoreIndicator(m, series, asOf));
      const scored = indicators.filter((r) => r.score !== undefined);
      result = { ...result, indicators };
      if (scored.length === 0) {
        result.missingReason = indicators.map((r) => `${r.indicator}: ${r.missingReason}`).join(" · ");
      } else {
        result.score = scored.reduce((s, r) => s + r.score!, 0) / scored.length;
      }
    } else {
      result.missingReason = reasonFromSource(src);
    }

    components.push(result);
    composeInputs.push({ key: component, weight, score: result.score, missingReason: result.missingReason });
  }

  const composite = compose(composeInputs);
  const dates = components.flatMap((c) => c.indicators.filter((i) => i.score !== undefined && i.latestDate).map((i) => i.latestDate!));
  const out: ScoreResult = {
    ...composite,
    scoreKey: key,
    label: def.label,
    modelVersion: MODEL_VERSION,
    asOf,
    components,
    ...(dates.length ? { oldestInput: dates.sort()[0] } : {}),
  };
  cache.set(key, out);
  return out;
}

/** 지금 계산하는 점수 — 측정 정의가 있는 점수와 그 부모. ⚠ 정의가 없는 점수를 0%로 저장하지 않는다. */
export const COMPUTED_SCORES: ScoreKey[] = [
  "fed_liquidity",
  "treasury_liquidity",
  "funding",
  "credit_liquidity",
  "rate_liquidity",
  "global_liquidity",
  "engine_heat",
];
