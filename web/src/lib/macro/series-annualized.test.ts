import { describe, expect, it } from "vitest";
import { annualizedChange, type SeriesPoint } from "./series";
import { findIndicator, MACRO_SECTORS } from "./catalog";
import { validateSectors } from "./registry";

/** 2026-01 ~ 2026-10 월간 지수 — 매달 0.25%씩 오른다(연율 약 3.04%). */
const monthly = (n: number, start = 100, rate = 0.0025): SeriesPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-${String(i + 1).padStart(2, "0")}-01`,
    value: start * (1 + rate) ** i,
  }));

describe("annualizedChange — 3·6개월 연율", () => {
  it("매달 같은 속도면 3·6개월 연율이 같다 — (1.0025)^12 − 1", () => {
    const pts = monthly(10);
    const want = (1.0025 ** 12 - 1) * 100;
    expect(annualizedChange(pts, 3)!.value).toBeCloseTo(want, 10);
    expect(annualizedChange(pts, 6)!.value).toBeCloseTo(want, 10);
  });

  it("기준 달과 비교 달을 함께 낸다", () => {
    const r = annualizedChange(monthly(10), 3)!;
    expect(r.asOf).toBe("2026-10-01");
    expect(r.base).toBe("2026-07-01");
    expect(annualizedChange(monthly(10), 6)!.base).toBe("2026-04-01");
  });

  it("해를 넘어 비교 달을 찾는다", () => {
    const pts = [
      { date: "2025-10-01", value: 100 },
      { date: "2026-01-01", value: 101 },
    ];
    const r = annualizedChange(pts, 3)!;
    expect(r.base).toBe("2025-10-01");
    expect(r.value).toBeCloseTo((1.01 ** 4 - 1) * 100, 10);
  });

  it("⚠ 정확히 k개월 전 달이 비면 계산하지 않는다(이웃 달로 대신하지 않는다)", () => {
    const pts = monthly(10).filter((p) => p.date !== "2026-07-01");
    expect(annualizedChange(pts, 3)).toBeUndefined();
    expect(annualizedChange(pts, 6)).toBeDefined();
  });

  it("점이 모자라거나 0·음수면 계산하지 않는다", () => {
    expect(annualizedChange(monthly(3), 3)).toBeUndefined();
    expect(annualizedChange([], 6)).toBeUndefined();
    expect(annualizedChange([{ date: "2026-01-01", value: 0 }, { date: "2026-04-01", value: 1 }], 3)).toBeUndefined();
  });

  it("최근 석 달이 빨라지면 3개월 연율이 6개월 연율보다 크다", () => {
    const pts = monthly(7); // 1~7월 0.25%씩
    const last = pts[6].value;
    pts.push(
      { date: "2026-08-01", value: last * 1.005 },
      { date: "2026-09-01", value: last * 1.005 ** 2 },
      { date: "2026-10-01", value: last * 1.005 ** 3 },
    );
    expect(annualizedChange(pts, 3)!.value).toBeGreaterThan(annualizedChange(pts, 6)!.value);
  });
});


describe("카탈로그 게이트 — 연율은 월간 지수에만", () => {
  it("현재 카탈로그는 통과하고, 대상 8개에 붙어 있다", () => {
    expect(validateSectors()).toEqual([]);
    for (const k of ["cpi_yoy", "core_cpi_yoy", "core_pce_yoy", "pce_yoy", "pce_supercore_yoy", "cpi_svc_ex_energy_yoy", "cpi_shelter_yoy", "cpi_median_yoy"]) {
      expect(findIndicator(k)?.annualized).toBe(true);
    }
  });

  it("⚠ 이미 %인 계열(level)에 붙이면 막는다", () => {
    const bad = MACRO_SECTORS.map((s) => ({
      ...s,
      indicators: s.indicators.map((i) => (i.key === "pce_trimmed_yoy" ? { ...i, annualized: true } : i)),
    }));
    expect(validateSectors(bad).some((p) => p.startsWith("pce_trimmed_yoy: 연율"))).toBe(true);
  });
});
