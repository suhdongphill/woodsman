import { describe, expect, it } from "vitest";
import { dropFuturePoints } from "./observed";
import { findIndicator } from "./catalog";

describe("관측일이 미래인 점은 관측이 아니다", () => {
  const points = [
    { date: "2026-04-01", value: 1 },
    { date: "2026-07-01", value: 2 },
    { date: "2026-10-01", value: 3 },
    { date: "2036-10-01", value: 4 },
  ];

  it("⚠ 오늘보다 뒤의 점을 버린다 — GDPPOT이 「2036-10-01 기준」이 되지 않게", () => {
    const r = dropFuturePoints(points, "2026-09-14");
    expect(r.kept.map((p) => p.date)).toEqual(["2026-04-01", "2026-07-01"]);
  });

  it("⚠ 버린 개수와 첫 미래 날짜를 돌려준다 — 조용히 버리지 않는다", () => {
    const r = dropFuturePoints(points, "2026-09-14");
    expect(r.dropped).toBe(2);
    expect(r.firstDropped).toBe("2026-10-01");
  });

  it("오늘 날짜의 점은 남긴다 — 오늘 관측한 값은 미래가 아니다", () => {
    const r = dropFuturePoints(points, "2026-07-01");
    expect(r.kept.map((p) => p.date)).toEqual(["2026-04-01", "2026-07-01"]);
  });

  it("미래 점이 없으면 아무것도 버리지 않고 firstDropped도 없다", () => {
    const r = dropFuturePoints(points.slice(0, 2), "2026-09-14");
    expect(r.dropped).toBe(0);
    expect("firstDropped" in r).toBe(false);
  });
});

describe("생산성·공급 묶음", () => {
  /** ⚠ 키를 바꾸면 D1에 쌓인 시계열이 통째로 끊긴다. 묶음만 옮겼다. */
  it("⚠ 노동생산성·단위노동비용은 키를 그대로 두고 supply로 옮겼다", () => {
    expect(findIndicator("prod_yoy")?.group).toBe("supply");
    expect(findIndicator("ulc_yoy")?.group).toBe("supply");
    expect(findIndicator("ngdp_yoy")?.group).toBe("production");
  });

  it("추계 계열(잠재산출)은 추정치라고 스스로 말한다", () => {
    const pot = findIndicator("pot_gdp_yoy")!;
    expect(pot.sourceLabel).toContain("추정");
    expect(pot.what).toContain("추정");
  });
});
