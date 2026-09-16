/**
 * 읽는 창 테스트 — **원자료가 다 있는데 화면이 「미수집」이라 말하는 길**을 막는다.
 *
 * 2026-09-16에 실제로 난 일: 계열당 14점만 읽었더니 주간 전년비와 20일 실현변동성이
 * 영원히 빈 배열이었다. 값이 틀린 게 아니라 **없는 것처럼 보였다** — 고장과 결측이
 * 구분되지 않는 종류라, 여기서는 "창이 모자라면 값이 안 나온다"를 직접 재현해 둔다.
 */
import { describe, expect, it } from "vitest";
import { MACRO_INDICATORS, findIndicator, type MacroIndicator } from "./catalog";
import { composeDerived } from "./derived";
import { applyTransform, type SeriesPoint } from "./series";
import { BASE_POINTS, pointsForDerived, pointsForTransform, pointsNeededBySeries } from "./window";
import type { ReleaseFreq } from "./freshness";

/** 2026-09-16 수요일 — 주간 계열(수요일 기준)과 같은 요일에 맞춰 둔다. */
const END = "2026-09-16";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 발표 주기대로 `count`개를 만든다(오름차순).
 * ⚠ 일간은 **영업일**이다 — 주말을 넣으면 실제로 오지 않는 점으로 창을 채우게 된다.
 */
function seriesOf(freq: ReleaseFreq, count: number): SeriesPoint[] {
  const dates: string[] = [];
  const cursor = new Date(`${END}T00:00:00Z`);
  while (dates.length < count) {
    if (freq === "d") {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) dates.push(iso(cursor));
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (freq === "w") {
      dates.push(iso(cursor));
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    } else {
      dates.push(iso(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))));
      cursor.setUTCMonth(cursor.getUTCMonth() - (freq === "q" ? 3 : 1));
    }
  }
  return dates
    .reverse()
    .map((date, i) => ({ date, value: 100 + i * 0.5 + (i % 3) * 0.2 }));
}

/** 이 지표를 그 창으로 그리면 값이 나오나. 화면(`sourceFor` → `buildView`)과 같은 경로다. */
function valueCount(indicator: MacroIndicator, points: number): number {
  if (indicator.derived) {
    const parts = indicator.derived.from.map((key) => {
      const part = findIndicator(key);
      return part ? applyTransform(seriesOf(part.freq, points), part.transform) : [];
    });
    return composeDerived(indicator.derived, parts).length;
  }
  return applyTransform(seriesOf(indicator.freq, points), indicator.transform).length;
}

describe("계열당 필요한 점 수", () => {
  it("전년비는 한 해치를 요구하고, 나머지는 기본 창이면 된다", () => {
    expect(pointsForTransform("yoy", "w")).toBeGreaterThan(52);
    expect(pointsForTransform("yoy", "m")).toBeGreaterThan(12);
    expect(pointsForTransform("momdiff", "d")).toBe(BASE_POINTS);
    expect(pointsForTransform("level", "w")).toBe(BASE_POINTS);
  });

  it("실현변동성은 창보다 많이 요구한다 — 창이 꽉 차야 첫 값이 나온다", () => {
    expect(pointsForDerived({ op: "realizedVolBp", from: ["x"], carryDays: 5, window: 20 })).toBe(22);
  });

  it("⭐ 요구는 파생이 아니라 성분 계열에 붙는다 — 파생은 DB에 자기 행이 없다", () => {
    const need = pointsNeededBySeries(MACRO_INDICATORS);
    expect(need.get("sofr")).toBeGreaterThanOrEqual(22);
    expect(need.get("ust10y")).toBeGreaterThanOrEqual(22);
    // 파생 자신을 읽으려 하지 않는다.
    expect(need.has("sofr_rvol")).toBe(false);
    expect(need.has("ust10y_rvol")).toBe(false);
  });

  it("한 계열이 여러 쓰임을 가지면 가장 많이 요구하는 쪽을 따른다", () => {
    const need = pointsNeededBySeries([
      { key: "a", transform: "level", freq: "d" } as MacroIndicator,
      {
        key: "b",
        transform: "level",
        freq: "d",
        derived: { op: "realizedVolBp", from: ["a"], carryDays: 5, window: 20 },
      } as MacroIndicator,
    ]);
    expect(need.get("a")).toBe(22);
  });
});

describe("⚠ 2026-09-16 회귀 — 원자료가 있는데 화면이 비어 있던 넷", () => {
  const BROKEN = ["bank_credit_yoy", "deposits_yoy", "sofr_rvol", "ust10y_rvol"];

  it.each(BROKEN)("%s — 14점으로는 값이 하나도 안 나온다(그때의 증상)", (key) => {
    const indicator = findIndicator(key);
    expect(indicator, `${key}가 카탈로그에 없다`).toBeDefined();
    expect(valueCount(indicator!, BASE_POINTS)).toBe(0);
  });

  it.each(BROKEN)("%s — 카탈로그가 정한 창이면 값이 나온다", (key) => {
    const indicator = findIndicator(key)!;
    const need = pointsNeededBySeries(MACRO_INDICATORS);
    const points = indicator.derived
      ? Math.max(...indicator.derived.from.map((k) => need.get(k) ?? BASE_POINTS))
      : (need.get(key) ?? BASE_POINTS);
    expect(valueCount(indicator, points)).toBeGreaterThan(0);
  });
});

describe("⭐ 게이트 — 카탈로그의 모든 전년비·실현변동성이 자기 창에서 값을 낸다", () => {
  const need = pointsNeededBySeries(MACRO_INDICATORS);

  const historyDependent = MACRO_INDICATORS.filter(
    (i) => i.transform === "yoy" || i.derived?.op === "realizedVolBp",
  );

  it("잴 대상이 실제로 있다(필터가 조용히 비면 게이트가 통과처럼 보인다)", () => {
    expect(historyDependent.length).toBeGreaterThan(5);
  });

  it.each(historyDependent.map((i) => [i.key, i] as const))("%s", (_key, indicator) => {
    const points = indicator.derived
      ? Math.max(...indicator.derived.from.map((k) => need.get(k) ?? BASE_POINTS))
      : (need.get(indicator.key) ?? BASE_POINTS);
    expect(valueCount(indicator, points)).toBeGreaterThan(0);
  });
});
