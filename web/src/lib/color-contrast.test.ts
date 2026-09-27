import { describe, expect, it } from "vitest";
import { AA_NORMAL, contrastRatio, isLargeText, parseColor, relativeLuminance } from "./color-contrast";

describe("WCAG 2.1 대비", () => {
  it("⭐ 흰색·검정은 21:1 (공식 확인)", () => {
    expect(contrastRatio(parseColor("#FFFFFF")!, parseColor("#000000")!)).toBeCloseTo(21, 5);
  });
  it("같은 색은 1:1", () => {
    expect(contrastRatio(parseColor("#777")!, parseColor("#777777")!)).toBeCloseTo(1, 5);
  });
  it("상대 휘도 끝값", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });
  it("실측 — 글의 파랑 rgb(5,147,211)는 크림 배경 #F4F1E8에서 약 3.0 · 본문 AA 미달", () => {
    const r = contrastRatio(parseColor("rgb(5, 147, 211)")!, parseColor("#F4F1E8")!);
    expect(r).toBeGreaterThan(2.8);
    expect(r).toBeLessThan(3.3);
    expect(r).toBeLessThan(AA_NORMAL);
  });
  it("색 표기", () => {
    expect(parseColor("#0593d3")).toEqual({ r: 5, g: 147, b: 211 });
    expect(parseColor("rgba(5,147,211,0.5)")).toEqual({ r: 5, g: 147, b: 211 });
    expect(parseColor("white")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("var(--x)")).toBe(null);
  });
  it("큰 글자 — 24px 또는 굵게 18.66px", () => {
    expect(isLargeText(24, false)).toBe(true);
    expect(isLargeText(19, true)).toBe(true);
    expect(isLargeText(19, false)).toBe(false);
    expect(isLargeText(null, true)).toBe(false);
  });
});
