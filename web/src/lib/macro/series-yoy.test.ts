/**
 * 전년비 변환 — ⚠ 2026-09-14 사고의 재발 방지.
 *
 * 주간 계열(수요일 기준)은 1년 전 같은 날짜가 수요일이 아니라 짝이 없어, 전년비가 **통째로 비어** 있었다.
 * 은행 신용 전년비 결측 → 신용 유동성 50% → GLS 판정 보류. 화면의 주간 전년비 카드도 비어 있었다.
 */
import { describe, expect, it } from "vitest";
import { applyTransform, YOY_TOLERANCE_DAYS } from "./series";

const pt = (date: string, value: number) => ({ date, value });

/** `start`부터 7일 간격 `n`주 */
function weekly(start: string, n: number, value: (i: number) => number) {
  return Array.from({ length: n }, (_, i) => pt(new Date(Date.parse(`${start}T00:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10), value(i)));
}

describe("전년비 — 주간 계열", () => {
  it("⭐ 수요일 계열도 전년비가 나온다 — 1년 전 같은 날짜가 없어도 ±3일 안의 점과 비교", () => {
    // 2025-09-03(수) ~ 2026-09-02(수): 2026-09-02의 1년 전 2025-09-02는 화요일이라 정확히 같은 날짜가 없다
    const pts = weekly("2025-09-03", 53, (i) => 100 + i);
    const out = applyTransform(pts, "yoy");
    expect(out.length).toBeGreaterThan(0);
    const last = out.at(-1)!;
    expect(last.date).toBe("2026-09-02");
    // 2025-09-03(값 100)과 비교 → (152 − 100) / 100
    expect(last.value).toBeCloseTo(52, 6);
  });

  it("⚠ 3일을 넘게 벌어진 점과는 비교하지 않는다 — 한 주 전 값을 1년 전이라 부르지 않는다", () => {
    const pts = [pt("2025-08-27", 100), pt("2026-09-02", 150)]; // 1년 전 목표 2025-09-02와 6일 차이
    expect(YOY_TOLERANCE_DAYS).toBe(3);
    expect(applyTransform(pts, "yoy")).toEqual([]);
  });

  it("월간 계열은 그대로 정확히 같은 날짜와 비교한다", () => {
    const pts = [pt("2025-08-01", 200), pt("2025-09-01", 210), pt("2026-08-01", 220), pt("2026-09-01", 231)];
    expect(applyTransform(pts, "yoy")).toEqual([
      { date: "2026-08-01", value: 10 },
      { date: "2026-09-01", value: 10 },
    ]);
  });

  it("정확한 날짜가 있으면 가까운 다른 점보다 그것을 쓴다", () => {
    const pts = [pt("2025-09-01", 100), pt("2025-09-02", 50), pt("2026-09-02", 110)];
    // 2026-09-02의 1년 전 = 2025-09-02(값 50) — 정확히 있으므로 그것
    expect(applyTransform(pts, "yoy").at(-1)?.value).toBeCloseTo(120, 6);
  });
});
