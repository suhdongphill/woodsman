import { describe, expect, it } from "vitest";
import { judgeFreshness, stripDelayLabel, weekdaysAfter } from "./freshness";

const f = (asOf: string, freq: "d" | "w" | "m", now: Date, staleDays?: number) =>
  judgeFreshness({ asOf, fetchedAt: new Date(now.getTime() - 3_600_000).toISOString(), freq, staleDays, manual: false, now });

describe("바람 띠 지연 표시(2026-11-15 · 영업일 2일 초과)", () => {
  it("평일 수 — 금요일 다음 주말은 0", () => {
    expect(weekdaysAfter("2026-11-13", "2026-11-15")).toBe(0);
    expect(weekdaysAfter("2026-11-13", "2026-11-17")).toBe(2);
  });

  it("⚠ 운영 사례: 일요일(11/15 KST 21시)에 10년물 11/12 값 → 지연 아님(FRED 1영업일 지연·주말)", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(stripDelayLabel("d", f("2026-11-12", "d", now), now)).toBeNull();
  });

  it("평일 사흘째 같은 값이면 「지연 3영업일」", () => {
    const now = new Date("2026-11-19T00:00:00Z"); // 미국 11/18(수)
    expect(stripDelayLabel("d", f("2026-11-13", "d", now), now)).toBe("지연 3영업일");
  });

  it("월간은 기존 판정 — 근원 PCE 9월분(staleDays 95)은 11/15에 정상", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(stripDelayLabel("m", f("2026-09-01", "m", now, 95), now)).toBeNull();
    expect(stripDelayLabel("m", f("2026-07-01", "m", now), now)).toMatch(/기한초과/);
  });
});
