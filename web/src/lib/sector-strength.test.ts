import { describe, expect, it } from "vitest";
import {
  LEADER_POSITION,
  MIN_POINTS,
  leadersLede,
  periodChangePct,
  positionInRange,
  rankByStrength,
  sectorStrength,
  type PricePoint,
  type SectorStrength,
} from "./sector-strength";

/** 값이 오르는 시계열 n개. */
function series(from: number, to: number, n = 120): PricePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    value: from + ((to - from) * i) / (n - 1),
  }));
}

describe("52주 위치", () => {
  it("신고가면 100에 가깝다", () => {
    expect(positionInRange(series(100, 200))).toBeCloseTo(100, 5);
  });

  it("바닥이면 0에 가깝다", () => {
    expect(positionInRange(series(200, 100))).toBeCloseTo(0, 5);
  });

  it(`⚠ 점이 ${MIN_POINTS}개 미만이면 판정하지 않는다 — 짧은 시계열의 고가는 고가가 아니다`, () => {
    expect(positionInRange(series(100, 200, MIN_POINTS - 1))).toBeNull();
  });

  it("⚠ 값이 평평하면 나눌 수 없다", () => {
    expect(positionInRange(series(100, 100))).toBeNull();
  });
});

describe("기간 수익률", () => {
  it("시작 대비 끝을 본다", () => {
    expect(periodChangePct(series(100, 150), 120)).toBeCloseTo(50, 5);
  });

  it("⚠ 시작값이 0 이하면 비율이 성립하지 않는다", () => {
    expect(periodChangePct([{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 5 }], 2)).toBeNull();
  });
});

describe("섹터 강도", () => {
  const bench = series(100, 110); // 시장 +10%

  it("시장보다 앞서고 신고가 근처면 주도주다", () => {
    const s = sectorStrength({ key: "tech", name: "기술", points: series(100, 150) }, bench);
    expect(s).not.toBeNull();
    expect(s!.leading).toBe(true);
    expect(s!.relative).toBeCloseTo(40, 5);
    expect(s!.position).toBeGreaterThanOrEqual(LEADER_POSITION);
  });

  it("⚠ 기준(시장)이 없으면 주도주라고 부르지 않는다 — 기준 없는 강함은 없다", () => {
    const s = sectorStrength({ key: "tech", name: "기술", points: series(100, 150) }, undefined);
    expect(s!.relative).toBeUndefined();
    expect(s!.leading).toBe(false);
  });

  it("시장보다 뒤처지면 신고가 근처여도 주도주가 아니다", () => {
    const s = sectorStrength({ key: "x", name: "X", points: series(100, 105) }, bench);
    expect(s!.leading).toBe(false);
  });

  it("⚠ 값이 모자라면 null — 화면이 '판정할 수 없음'을 적는다", () => {
    expect(sectorStrength({ key: "x", name: "X", points: series(100, 150, 10) }, bench)).toBeNull();
  });

  it("기준일을 함께 낸다 — 날짜 없는 숫자는 실시간으로 읽힌다", () => {
    const s = sectorStrength({ key: "x", name: "X", points: series(100, 150) }, bench);
    expect(s!.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("순위와 한 줄 결론", () => {
  const items: SectorStrength[] = [
    { key: "a", name: "기술", position: 98, changePct: 40, relative: 30, asOf: "2026-08-30", leading: true },
    { key: "b", name: "반도체", position: 95, changePct: 35, relative: 25, asOf: "2026-08-30", leading: true },
    { key: "c", name: "유틸", position: 40, changePct: 2, relative: -8, asOf: "2026-08-30", leading: false },
  ];

  it("상대강도 순으로 세운다", () => {
    expect(rankByStrength(items).map((s) => s.key)).toEqual(["a", "b", "c"]);
  });

  it("가져갈 한 문장을 만든다", () => {
    expect(leadersLede(items)).toContain("기술 · 반도체");
  });

  it("⚠ 주도 섹터가 없으면 없다고 말한다 — 억지로 뽑지 않는다", () => {
    const flat = items.map((s) => ({ ...s, leading: false }));
    expect(leadersLede(flat)).toContain("뚜렷한 주도 섹터는 없습니다");
  });

  it("⚠ 만들 수 없으면 null", () => {
    expect(leadersLede([])).toBeNull();
  });
});
