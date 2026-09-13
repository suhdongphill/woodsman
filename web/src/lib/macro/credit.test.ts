import { describe, expect, it } from "vitest";
import { findIndicator, MACRO_INDICATORS } from "./catalog";
import { MACRO_GROUPS, validateSectors } from "./registry";

describe("신용·자금 원자료 (R2a)", () => {
  it("정의 검증이 깨끗하다 — 새 파생·새 묶음이 조용히 반쯤 동작하지 않는다", () => {
    expect(validateSectors()).toEqual([]);
  });

  it("신용·자금 묶음은 유동성 바로 뒤에 온다", () => {
    const order = [...MACRO_GROUPS].sort((a, b) => a.order - b.order).map((g) => g.key);
    expect(order.indexOf("credit")).toBe(order.indexOf("liquidity") + 1);
  });

  /**
   * ⚠ 2026-09-13 보고서가 경고한 오류. 연준 대차대조표의 역레포 ~3,500억 달러는 거의 전부 해외 공적 풀이고
   *   국내 ON RRP는 ~50억 달러다. 둘을 섞으면 해외 풀 감소가 「시장으로 나온 돈」으로 읽힌다.
   */
  it("⚠ 해외 공적 역레포는 순유동성 계산에 들어가지 않는다 — 국내 ON RRP만 쓴다", () => {
    const netliq = findIndicator("netliq")!;
    expect(netliq.derived?.from).toContain("rrp");
    expect(netliq.derived?.from).not.toContain("rrp_foreign");
    expect(findIndicator("rrp")?.sourceId).toBe("RRPONTSYD");
    expect(findIndicator("rrp_foreign")?.sourceId).toBe("WLRRAFOIAL");
  });

  it("⚠ 백만 달러 단위 계열은 조 달러로 나눈다 — 1000배 틀리지 않게", () => {
    for (const key of ["reserves", "rrp_foreign"]) {
      expect(findIndicator(key)?.transform, key).toBe("levelM");
    }
  });

  it("파생 두 개는 기준 계열이 앞에 온다", () => {
    expect(findIndicator("sofr_iorb")?.derived?.from).toEqual(["sofr", "iorb"]);
    expect(findIndicator("baa_spread")?.derived?.from).toEqual(["baa_yield", "ust10y"]);
  });

  it("⚠ 원 발표 기관을 댄다 — FRED는 배급처다", () => {
    for (const key of ["ci_loans_yoy", "bank_credit_yoy", "deposits_yoy", "sloos_ci", "baa_yield"]) {
      expect(findIndicator(key)?.sourceLabel, key).toMatch(/원 발표/);
    }
  });

  it("키가 겹치지 않는다", () => {
    const keys = MACRO_INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
