import { describe, expect, it } from "vitest";
import { accountAllocationRows, accountHoldingWeights, CASH_ROW_KEY, validAccountAllocation, type AccountAllocation } from "./account-allocation";
import { fillProgressPct } from "./allocation";
import type { PortfolioBucket } from "./bucket-target";

const alloc: AccountAllocation = { asOf: "2026-11-07", growthPct: 65, incomePct: 12.5, defensePct: 3, cashPct: 19.5 };
const bucket = (key: string, targetPct: number, sortOrder: number) => ({ key, name: key, targetPct, sortOrder }) as unknown as PortfolioBucket;
const buckets = [bucket("GROWTH", 40, 0), bucket("INCOME", 40, 1), bucket("DEFENSE", 10, 2)];

describe("validAccountAllocation", () => {
  it("합이 100이면 받는다", () => {
    expect(validAccountAllocation(alloc)).toEqual(alloc);
  });

  it("⚠ 합이 어긋나거나 값이 이상하면 믿지 않는다", () => {
    expect(validAccountAllocation({ ...alloc, cashPct: 30 })).toBeNull();
    expect(validAccountAllocation({ ...alloc, growthPct: Number.NaN })).toBeNull();
    expect(validAccountAllocation({ ...alloc, growthPct: -1, cashPct: 85.5 })).toBeNull();
    expect(validAccountAllocation(null)).toBeNull();
  });
});

describe("accountAllocationRows", () => {
  it("목표와 같은 계좌 기준으로 비교하고 현금 행을 더한다", () => {
    const rows = accountAllocationRows(buckets, alloc, 10)!;
    expect(rows.map((r) => [r.functionType, r.currentPct, r.targetPct, r.gapPct])).toEqual([
      ["GROWTH", 65, 40, 25],
      ["INCOME", 12.5, 40, -27.5],
      ["DEFENSE", 3, 10, -7],
      [CASH_ROW_KEY, 19.5, 10, 9.5],
    ]);
    expect(fillProgressPct(rows)).toBe(65.5);
  });

  it("⚠ 볼트에 값이 없는 버킷이 있으면 지어내지 않고 null이다", () => {
    expect(accountAllocationRows([...buckets, bucket("THEME", 5, 3)], alloc, 5)).toBeNull();
  });
});

describe("accountHoldingWeights", () => {
  it("비공개 종목까지 분모에 넣고 현금을 뺀 몫으로 낸다", () => {
    const held = [
      { id: "a", shares: 1, price: 100, currency: "KRW" as const },
      { id: "secret", shares: 3, price: 100, currency: "KRW" as const },
    ];
    const { weights, publishedPct } = accountHoldingWeights(held, new Set(["a"]), 1000, 20);
    expect(weights.get("a")).toBeCloseTo(20);
    expect(weights.has("secret")).toBe(false);
    expect(publishedPct).toBe(20);
  });
});
