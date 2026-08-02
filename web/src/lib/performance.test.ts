import { describe, expect, it } from "vitest";
import { accountSnapshots } from "./mock";
import { returnPctAt, sortByDate, summarizePerformance } from "./performance";
import type { AccountSnapshot } from "./types";

const s = (date: string, principal: number, value: number, income = 0): AccountSnapshot => ({
  date,
  principal,
  value,
  income,
});

describe("returnPctAt", () => {
  it("원금 대비 손익률을 계산한다", () => {
    expect(returnPctAt(s("2026-01-31", 100, 110))).toBeCloseTo(10);
    expect(returnPctAt(s("2026-01-31", 100, 90))).toBeCloseTo(-10);
  });

  it("원금이 0이면 0을 돌려준다(0으로 나누지 않는다)", () => {
    expect(returnPctAt(s("2026-01-31", 0, 500))).toBe(0);
  });
});

describe("sortByDate", () => {
  it("입력 배열을 건드리지 않고 오름차순 사본을 만든다", () => {
    const input = [s("2026-03-31", 3, 3), s("2026-01-31", 1, 1)];
    const sorted = sortByDate(input);
    expect(sorted.map((x) => x.date)).toEqual(["2026-01-31", "2026-03-31"]);
    expect(input[0].date).toBe("2026-03-31");
  });
});

describe("summarizePerformance", () => {
  it("기록이 없으면 null", () => {
    expect(summarizePerformance([])).toBeNull();
  });

  it("가장 최근 스냅샷을 기준으로 요약한다(입력 순서와 무관)", () => {
    const p = summarizePerformance([
      s("2026-02-28", 200, 190),
      s("2026-03-31", 300, 330, 5),
      s("2026-01-31", 100, 100),
    ])!;
    expect(p.asOf).toBe("2026-03-31");
    expect(p.principal).toBe(300);
    expect(p.value).toBe(330);
    expect(p.profit).toBe(30);
    expect(p.returnPct).toBeCloseTo(10);
    expect(p.income).toBe(5);
    expect(p.months).toBe(3);
  });

  it("원금을 밑돈 구간을 찾아낸다", () => {
    const p = summarizePerformance([
      s("2026-01-31", 100, 100),
      s("2026-02-28", 200, 190), // -5%
      s("2026-03-31", 300, 291), // -3%
      s("2026-04-30", 400, 440),
    ])!;
    expect(p.underwaterMonths).toBe(2);
    expect(p.worst).toEqual({ date: "2026-02-28", pct: -5 });
  });

  it("한 번도 원금을 밑돈 적이 없으면 '최악 구간'을 지어내지 않는다", () => {
    const p = summarizePerformance([s("2026-01-31", 100, 100), s("2026-02-28", 200, 220)])!;
    expect(p.worst).toBeNull();
    expect(p.underwaterMonths).toBe(0);
  });
});

describe("공개 계좌 데이터", () => {
  const p = summarizePerformance(accountSnapshots)!;

  it("월 단위로 빠짐없이 이어진다", () => {
    const months = sortByDate(accountSnapshots).map((x) => x.date.slice(0, 7));
    expect(new Set(months).size).toBe(months.length);
  });

  it("납입원금은 줄어들지 않는다(누계이므로)", () => {
    const rows = sortByDate(accountSnapshots);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].principal).toBeGreaterThanOrEqual(rows[i - 1].principal);
    }
  });

  it("손실 구간을 지우지 않고 남겨 둔다", () => {
    expect(p.underwaterMonths).toBeGreaterThan(0);
    expect(p.worst).not.toBeNull();
  });
});
