import { describe, expect, it } from "vitest";
import { buildSectorFlowView, type SectorFlowRow } from "./sector-flow";

const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const row = (ticker: string, values: number[]): SectorFlowRow[] =>
  values.map((flowPct, i) => ({ month: months[i], ticker, name: ticker, flowPct }));

describe("buildSectorFlowView", () => {
  it("1·3개월 합과 순위 변화를 낸다", () => {
    const v = buildSectorFlowView([...row("A", [5, 5, 5, 0, 0, 0]), ...row("B", [0, 0, 0, 2, 2, 2])]);
    expect(v.asOf).toBe("2026-06");
    expect(v.items[0]).toMatchObject({ ticker: "B", m1: 2, m3: 6, rank: 1, rankThen: 2 });
    expect(v.items[1]).toMatchObject({ ticker: "A", m3: 0, rank: 2, rankThen: 1 });
  });

  it("⚠ 12개월 자료가 없으면 0이 아니라 null이다", () => {
    expect(buildSectorFlowView(row("A", [1, 1, 1, 1, 1, 1])).items[0].m12).toBeNull();
  });

  it("⚠ 빠진 달이 있으면 합을 내지 않는다", () => {
    const rows = row("A", [1, 1, 1, 1, 1, 1]).filter((r) => r.month !== "2026-05");
    rows.push(...row("B", [1, 1, 1, 1, 1, 1]));
    const a = buildSectorFlowView(rows).items.find((i) => i.ticker === "A");
    expect(a?.m3).toBeNull();
    expect(a?.rank).toBeNull();
  });

  it("자료가 없으면 빈 표다", () => {
    expect(buildSectorFlowView([])).toEqual({ asOf: null, items: [] });
  });
});
