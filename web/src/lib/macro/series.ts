/**
 * 시계열 변환·표기 — 순수 계산.
 *
 * 원본은 대부분 **원값(level)**으로 들어온다. 화면에 필요한 건 "작년보다 얼마나"(yoy),
 * "지난달보다 몇 명 늘었나"(momdiff) 같은 가공값이라, 저장은 원값으로 하고 **변환은 읽을 때**
 * 한다. 그래야 규칙이 바뀌어도 쌓아 둔 데이터를 다시 받지 않아도 된다.
 *
 * ⚠ 변환을 저장 시점에 하지 않는 이유가 이것이다. 한 번 가공해서 넣으면 되돌릴 수 없다.
 */
import type { MacroIndicator, MacroTransform } from "./catalog";

export type SeriesPoint = {
  /** YYYY-MM-DD */
  date: string;
  value: number;
};

/** 전년비에서 「1년 전」 짝으로 인정하는 날짜 차이(일). 주간 계열의 요일 밀림(1년에 1~2일)을 흡수한다. */
export const YOY_TOLERANCE_DAYS = 3;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** 오름차순 `days`에서 `target`에 가장 가까운(±`tol`일 안) 위치. 없으면 −1. 이진 탐색. */
function nearestWithin(days: number[], target: number, tol: number): number {
  let lo = 0;
  let hi = days.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  let best = -1;
  for (const i of [lo - 1, lo]) {
    if (i < 0 || i >= days.length) continue;
    const d = Math.abs(days[i] - target);
    if (d <= tol && (best < 0 || d < Math.abs(days[best] - target))) best = i;
  }
  return best;
}

/** 1년 전 같은 날짜 문자열. 월간 시리즈(매월 1일)에서 정확히 맞아떨어진다. */
function yearBefore(date: string): string {
  const year = Number(date.slice(0, 4));
  return `${year - 1}${date.slice(4)}`;
}

/**
 * 저장된 원값을 화면 값으로 바꾼다.
 *
 * 입력은 **날짜 오름차순**을 전제한다(repository가 그렇게 준다).
 * 변환에 필요한 짝을 못 찾은 점은 **버린다** — 0으로 채우면 그래프에 없는 사건이 생긴다.
 */
export function applyTransform(points: SeriesPoint[], tf: MacroTransform): SeriesPoint[] {
  if (tf === "level") return points;
  if (tf === "levelK") return points.map((p) => ({ date: p.date, value: p.value / 1000 }));
  if (tf === "levelM") return points.map((p) => ({ date: p.date, value: p.value / 1_000_000 }));
  // 금리 선물: 가격 96.14 → 금리 3.86%. ⚠ 부호가 뒤집히므로 "오르면 좋다"를 그대로 쓰면 안 된다.
  if (tf === "price100") return points.map((p) => ({ date: p.date, value: 100 - p.value }));

  if (tf === "yoy") {
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    const days = points.map((p) => dayNumber(p.date));
    const out: SeriesPoint[] = [];
    for (const p of points) {
      let before = byDate.get(yearBefore(p.date));
      /**
       * ⚠ 2026-09-14 버그: **주간 계열(수요일 기준)은 1년 전 같은 날짜가 수요일이 아니라** 짝이 없었다 — 은행 신용·예금 전년비가
       *   통째로 비어, 신용 유동성 점수가 결측(→ GLS 판정 보류)이 됐다. 정확히 같은 날짜가 없으면 **1년 전 ±3일 안의 가장 가까운 점**을 쓴다.
       *   ⚠ 3일을 넘게 벌어진 점과는 비교하지 않는다 — 한 주 전 값을 1년 전이라 부르지 않는다. 월간(1일)은 여전히 정확히 맞는다.
       */
      if (before === undefined) {
        const target = dayNumber(yearBefore(p.date));
        const near = nearestWithin(days, target, YOY_TOLERANCE_DAYS);
        if (near >= 0) before = points[near].value;
      }
      if (before === undefined || before === 0) continue;
      out.push({ date: p.date, value: ((p.value - before) / Math.abs(before)) * 100 });
    }
    return out;
  }

  // mom · momdiff — 바로 앞 점과 비교한다.
  const out: SeriesPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].value;
    const cur = points[i].value;
    if (tf === "momdiff") {
      out.push({ date: points[i].date, value: cur - prev });
    } else if (prev !== 0) {
      out.push({ date: points[i].date, value: ((cur - prev) / Math.abs(prev)) * 100 });
    }
  }
  return out;
}

/** 변화율·증감 지표는 부호를 붙여야 방향이 읽힌다(+0.2% / −0.3%). */
function isSigned(tf: MacroTransform): boolean {
  return tf === "yoy" || tf === "mom" || tf === "momdiff";
}

/**
 * 값 표기. 단위는 뒤에 붙인다.
 *
 * ⚠ 마이너스는 하이픈(-)이 아니라 **−(U+2212)**로 쓴다. 작은 글씨에서 하이픈은
 *    옆 숫자에 붙어 잘 안 보인다.
 */
export function formatIndicatorValue(
  indicator: Pick<MacroIndicator, "transform" | "unit" | "decimals">,
  value: number | undefined,
): string {
  if (value === undefined || !Number.isFinite(value)) return "—";

  const abs = Math.abs(value).toLocaleString("ko-KR", {
    minimumFractionDigits: indicator.decimals,
    maximumFractionDigits: indicator.decimals,
  });
  const sign = value < 0 ? "−" : isSigned(indicator.transform) ? "+" : "";
  return `${sign}${abs}${indicator.unit}`;
}

/** 최근 점(마지막). 없으면 undefined. */
export function latestPoint(points: SeriesPoint[]): SeriesPoint | undefined {
  return points.length ? points[points.length - 1] : undefined;
}

/**
 * 직전 값 대비 변화. 화면의 "▲ 0.12" 표기에 쓴다.
 * 값이 하나뿐이면 undefined — 없는 변화를 0으로 만들지 않는다.
 */
export function changeFromPrevious(points: SeriesPoint[]): number | undefined {
  if (points.length < 2) return undefined;
  return points[points.length - 1].value - points[points.length - 2].value;
}

/**
 * 차트에 그을 기준선.
 *
 * 그림에서 "어디가 경계인가"를 못 찾으면 설명이 소용없다. 판정 규칙이 있으면 그 임계값을,
 * 없으면 변화율 지표의 0(작년과 같음)을 긋는다. 원값 지표는 기준선이 없다 —
 * 아무 데나 선을 그으면 없는 의미가 생긴다.
 */
export function chartBaseline(
  indicator: Pick<MacroIndicator, "transform"> & { signal?: { alert: number } },
): { value: number; label: string } | undefined {
  if (indicator.signal) {
    return { value: indicator.signal.alert, label: `${indicator.signal.alert} = 경고선` };
  }
  if (indicator.transform === "yoy") return { value: 0, label: "0 = 작년과 같음" };
  if (indicator.transform === "mom" || indicator.transform === "momdiff") {
    return { value: 0, label: "0 = 지난달과 같음" };
  }
  return undefined;
}

/** 차트에 그릴 구간만 잘라 낸다(최근 N개). */
export function tailPoints(points: SeriesPoint[], count: number): SeriesPoint[] {
  return count >= points.length ? points : points.slice(points.length - count);
}
