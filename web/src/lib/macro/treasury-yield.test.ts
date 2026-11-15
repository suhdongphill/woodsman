import { describe, expect, it } from "vitest";
import { parseYieldCurveCsv } from "./treasury-fetch";

/** 2026-11-15 재무부 CSV 앞 세 줄 그대로(관측 확인용) */
const CSV = `Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"
11/13/2026,4.10,4.18,4.26,4.32,4.34,4.42,4.65,4.88,4.92,4.98,5.05,5.15,5.52,5.47
11/12/2026,4.12,4.18,4.26,4.32,4.35,4.42,4.65,4.86,4.90,4.95,5.02,5.10,5.48,5.43
11/10/2026,4.05,4.16,4.21,4.30,4.28,4.38,4.56,4.73,4.74,4.81,4.89,,5.39,5.35`;

describe("재무부 수익률 곡선 CSV(2026-11-15)", () => {
  it("10년물 열을 오래된 순으로 — 날짜는 YYYY-MM-DD", () => {
    expect(parseYieldCurveCsv(CSV, "10 Yr")).toEqual([
      { date: "2026-11-12", value: 5.1 },
      { date: "2026-11-13", value: 5.15 },
    ]);
  });
  it("⚠ 빈 칸은 건너뛴다(채우지 않는다)", () => {
    expect(parseYieldCurveCsv(CSV, "10 Yr").map((p) => p.date)).not.toContain("2026-11-10");
  });
  it("없는 열이면 큰 소리로 실패한다", () => {
    expect(() => parseYieldCurveCsv(CSV, "15 Yr")).toThrow(/열이 없습니다/);
  });
});
