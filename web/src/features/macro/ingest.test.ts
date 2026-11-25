import { describe, expect, it } from "vitest";
import { pointsToWrite, rewriteBackDays } from "./ingest";

const points = [
  { date: "2026-04-01", value: 1 },
  { date: "2026-05-01", value: 2 },
  { date: "2026-06-01", value: 3 },
  { date: "2026-07-01", value: 4 },
];

describe("무엇을 다시 쓸지 고르기", () => {
  it("처음 받는 지표는 전부 쓴다", () => {
    const { toWrite, added } = pointsToWrite(points, undefined);
    expect(toWrite).toHaveLength(4);
    expect(added).toBe(4);
  });

  it("이미 있으면 마지막 기준일 이후만 '새 값'으로 센다", () => {
    const { added } = pointsToWrite(points, "2026-06-01");
    expect(added).toBe(1);
  });

  it("⚠ 최근 60일은 값이 있어도 다시 쓴다 — 통계는 발표 뒤 수정된다", () => {
    const { toWrite } = pointsToWrite(points, "2026-07-01");
    // 07-01에서 60일 전(05-02)부터 → 05-01은 빠지고 06-01·07-01이 다시 쓰인다
    expect(toWrite.map((p) => p.date)).toEqual(["2026-06-01", "2026-07-01"]);
  });

  it("⚠ 전 구간을 다시 쓰지 않는다 — 매번 전체를 쓰면 한 번에 3분이 넘었다", () => {
    const long = Array.from({ length: 500 }, (_, i) => ({
      date: `2025-01-01`.replace("01-01", `01-01`),
      value: i,
    }));
    // 날짜가 모두 같은 극단적 입력이라도, 기준일 이전 구간은 걸러진다
    const { toWrite } = pointsToWrite(long, "2026-07-01");
    expect(toWrite).toHaveLength(0);
  });
});

describe("⚠ 월·분기 계열은 3년을 되감는다(2026-11-25 · BEA 연간 수정 누락 사고)", () => {
  const monthly = Array.from({ length: 48 }, (_, i) => {
    const y = 2023 + Math.floor(i / 12);
    return { date: `${y}-${String((i % 12) + 1).padStart(2, "0")}-01`, value: i };
  });

  it("월간은 마지막 기준일 3년 전 달부터 다시 쓴다 — 2년 전 수정치도 들어온다", () => {
    const { toWrite, added } = pointsToWrite(monthly, "2026-12-01", "m");
    expect(toWrite[0].date).toBe("2023-12-01");
    expect(toWrite.map((p) => p.date)).toContain("2024-10-01");
    expect(added).toBe(0);
  });

  it("분기도 같다", () => {
    expect(pointsToWrite(monthly, "2026-12-01", "q").toWrite[0].date).toBe("2023-12-01");
  });

  it("일·주간은 그대로 60일 — 점이 많아 전 구간을 쓰면 느려진다", () => {
    expect(rewriteBackDays("d")).toBe(60);
    expect(rewriteBackDays("w")).toBe(60);
    expect(pointsToWrite(monthly, "2026-12-01", "d").toWrite.map((p) => p.date)).toEqual(["2026-11-01", "2026-12-01"]); // 12-01에서 60일 전 = 10-02
  });
});
