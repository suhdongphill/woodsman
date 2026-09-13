/**
 * 점수 엔진에 넣을 계열을 만든다 — 순수 함수. DB 원값(`MacroPoint`) → 카탈로그 변환 → 파생 합성.
 *
 * ## ⚠ 화면과 **같은 변환**을 쓴다
 * 홈·허브는 `features/macro/service.ts`의 `sourceFor`로 원값을 변환한다. 점수가 다른 변환을 쓰면
 * **화면의 「근원 CPI 3.1%」와 점수가 본 숫자가 갈린다.** 그래서 변환은 카탈로그(`transform`)와
 * `applyTransform` · `composeDerived` 한 곳만 쓴다 — 여기서 단위를 다시 맞추지 않는다.
 *
 * ## ⚠ 읽는 구간
 * 10년 창 + 91일 변화 + 모멘텀 여유 + **전년비 변환에 필요한 1년** = 평가일 전 12년. 그보다 오래된 점은 결과를 바꾸지 않는다.
 */
import { findIndicator, withDerivedComponents } from "../macro/catalog";
import { applyTransform, type SeriesPoint } from "../macro/series";
import { composeDerived } from "../macro/derived";
import { SCORE_MEASURES } from "./measures";
import type { SeriesInput } from "./engine";

/** DB에서 읽을 햇수 — 머리말 참고 */
export const HISTORY_YEARS = 12;

/** 가장 이른 평가일에서 `HISTORY_YEARS`년 전(YYYY-MM-DD). */
export function historyStart(earliestAsOf: string): string {
  return `${Number(earliestAsOf.slice(0, 4)) - HISTORY_YEARS}${earliestAsOf.slice(4)}`;
}

/** 측정 정의가 쓰는 지표 키(중복 없음 · 정렬). */
export function scoreIndicatorKeys(): string[] {
  const keys = new Set<string>();
  for (const comps of Object.values(SCORE_MEASURES)) {
    for (const measures of Object.values(comps ?? {})) for (const m of measures) keys.add(m.indicator);
  }
  return [...keys].sort();
}

/** DB에서 읽을 계열 키 — 파생 지표는 **성분**을 함께 읽는다(파생은 DB에 자기 행이 없다). */
export function scoreSeriesKeys(): string[] {
  return withDerivedComponents(scoreIndicatorKeys()).sort();
}

/**
 * 원값 → 점수 입력. ⚠ 카탈로그에 없는 지표·값이 없는 지표는 **넣지 않는다** — 엔진이 「값이 없다(수집 전)」라고 센다.
 */
export function buildScoreSeries(raw: Map<string, SeriesPoint[]>): Map<string, SeriesInput> {
  const out = new Map<string, SeriesInput>();
  for (const key of scoreIndicatorKeys()) {
    const indicator = findIndicator(key);
    if (!indicator) {
      console.error(`[scores] 측정 정의의 지표 ${key}가 카탈로그에 없다`);
      continue;
    }
    let points: SeriesPoint[];
    if (indicator.derived) {
      const spec = indicator.derived;
      const parts = spec.from.map((from) => {
        const part = findIndicator(from);
        return part ? applyTransform(raw.get(from) ?? [], part.transform) : [];
      });
      points = composeDerived(spec, parts);
    } else {
      points = applyTransform(raw.get(key) ?? [], indicator.transform);
    }
    if (points.length > 0) out.set(key, { points, freq: indicator.freq });
  }
  return out;
}
