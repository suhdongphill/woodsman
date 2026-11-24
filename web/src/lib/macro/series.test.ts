import { describe, expect, it } from "vitest";
import { yoyGapNote } from "./series";
import { shortObsDate } from "./series";
describe("전년비 공백 안내(2026-11-15)", () => {
  const m = (date: string, value: number) => ({ date, value });
  it("⚠ 운영 사례: 2025-10 CPI 공란 → 2026-10 전년비 없음 · 이유를 말한다(값은 채우지 않는다)", () => {
    const raw = [m("2025-09-01", 324.245), m("2025-11-01", 325.063), m("2026-09-01", 336.298), m("2026-10-01", 337.476)];
    const note = yoyGapNote(raw, "yoy");
    expect(note).toContain("2026-10-01분까지");
    expect(note).toContain("1년 전(2025-10-01)");
    expect(note).toContain("2026-09-01분");
  });
  it("정상이면 null", () => {
    expect(yoyGapNote([m("2025-10-01", 1), m("2026-10-01", 2)], "yoy")).toBeNull();
    expect(yoyGapNote([m("2026-10-01", 2)], "level")).toBeNull();
  });
});

describe("shortObsDate — 목록 한 줄의 관측일", () => {
  it("월간은 달까지만", () => {
    expect(shortObsDate("2026-09-01", "m", "2026-11-24")).toBe("2026-09");
  });
  it("일간은 올해면 월-일, 지난해면 전체", () => {
    expect(shortObsDate("2026-11-20", "d", "2026-11-24")).toBe("11-20");
    expect(shortObsDate("2025-12-31", "d", "2026-01-02")).toBe("2025-12-31");
  });
  it("값이 없으면 날짜도 없다", () => {
    expect(shortObsDate(undefined, "m", "2026-11-24")).toBeUndefined();
  });
});
