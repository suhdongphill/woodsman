import { describe, expect, it } from "vitest";
import { firstIssue, holdingSchema, rebalanceSchema } from "./schema";

const BASE = {
  name: "TSMC",
  ticker: "TSM",
  market: "NYSE",
  functionType: "GROWTH",
  targetWeight: "20",
  avgCost: "142.5",
  shares: "40",
  currency: "USD",
  price: "",
  priceAsOf: "",
  thesis: "선단 공정 독점을 산다.",
  canslim: "8.4",
  blogUrl: "",
  order: "1",
  published: true,
};

describe("종목 입력 검증", () => {
  it("빈 칸은 undefined가 된다 — ''이나 0으로 저장되지 않는다", () => {
    const parsed = holdingSchema.parse({ ...BASE, ticker: "", canslim: "", blogUrl: "" });
    expect(parsed.ticker).toBeUndefined();
    expect(parsed.canslim).toBeUndefined();
    expect(parsed.blogUrl).toBeUndefined();
  });

  it("콤마를 넣은 원화 단가도 받는다", () => {
    const parsed = holdingSchema.parse({ ...BASE, currency: "KRW", avgCost: "34,200" });
    expect(parsed.avgCost).toBe(34_200);
  });

  it("목표 비중은 0~100 사이만", () => {
    expect(holdingSchema.safeParse({ ...BASE, targetWeight: "120" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...BASE, targetWeight: "-1" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...BASE, targetWeight: "0" }).success).toBe(true);
  });

  it("⚠ 목표 비중 합계는 여기서 막지 않는다 — 한 종목만 100%여도 통과한다", () => {
    // 작성 중에는 합계가 안 맞는 게 정상. 경고는 화면(allocation.targetSumWarning)이 한다.
    expect(holdingSchema.safeParse({ ...BASE, targetWeight: "100" }).success).toBe(true);
  });

  it("⚠ 현재가를 적었으면 기준일도 있어야 한다 — 날짜 없는 숫자는 자동 시세로 읽힌다", () => {
    const noDate = holdingSchema.safeParse({ ...BASE, price: "191.2", priceAsOf: "" });
    expect(noDate.success).toBe(false);
    if (!noDate.success) expect(firstIssue(noDate.error)).toMatch(/시세 기준일/);

    const withDate = holdingSchema.safeParse({
      ...BASE,
      price: "191.2",
      priceAsOf: "2026-08-06",
    });
    expect(withDate.success).toBe(true);
  });

  it("현재가가 없으면 기준일도 없어도 된다(현금성 종목)", () => {
    const parsed = holdingSchema.parse({ ...BASE, name: "달러 MMF·현금", price: "", priceAsOf: "" });
    expect(parsed.price).toBeUndefined();
    expect(parsed.priceAsOf).toBeUndefined();
  });

  it("CANSLIM은 0~10 사이만", () => {
    expect(holdingSchema.safeParse({ ...BASE, canslim: "11" }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...BASE, canslim: "8.4" }).success).toBe(true);
  });

  it("블로그 링크는 http(s)만 받는다", () => {
    expect(holdingSchema.safeParse({ ...BASE, blogUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(
      holdingSchema.safeParse({ ...BASE, blogUrl: "https://suhdp.tistory.com/2" }).success,
    ).toBe(true);
  });

  it("종목명과 기능 분류는 필수다", () => {
    expect(holdingSchema.safeParse({ ...BASE, name: "  " }).success).toBe(false);
    expect(holdingSchema.safeParse({ ...BASE, functionType: "ETC" }).success).toBe(false);
  });

  it("잘못된 기준일 형식은 막는다", () => {
    expect(
      holdingSchema.safeParse({ ...BASE, price: "1", priceAsOf: "2026/08/06" }).success,
    ).toBe(false);
  });
});

describe("리밸런싱 기록 검증", () => {
  it("날짜와 메모가 필요하다", () => {
    expect(rebalanceSchema.safeParse({ date: "2026-07-28", memo: "현금 10% 복원" }).success).toBe(
      true,
    );
    expect(rebalanceSchema.safeParse({ date: "어제", memo: "현금 복원" }).success).toBe(false);
    expect(rebalanceSchema.safeParse({ date: "2026-07-28", memo: " " }).success).toBe(false);
  });
});
