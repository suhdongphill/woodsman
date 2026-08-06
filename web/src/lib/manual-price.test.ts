import { describe, expect, it } from "vitest";
import { priceAgeDays, summarizeManualPrices, STALE_AFTER_DAYS } from "./manual-price";

const TODAY = "2026-08-06";

describe("priceAgeDays", () => {
  it("같은 날은 0일이다", () => {
    expect(priceAgeDays("2026-08-06", TODAY)).toBe(0);
  });

  it("달을 넘어가도 일수로 센다", () => {
    expect(priceAgeDays("2026-07-28", TODAY)).toBe(9);
  });

  it("기준일이 없거나 형식이 아니면 undefined", () => {
    expect(priceAgeDays(undefined, TODAY)).toBeUndefined();
    expect(priceAgeDays("어제", TODAY)).toBeUndefined();
  });
});

describe("summarizeManualPrices", () => {
  it("가장 오래된 기준일을 대표로 삼는다 — 최신 날짜를 쓰면 실제보다 최신으로 읽힌다", () => {
    const s = summarizeManualPrices(
      [
        { price: 100, priceAsOf: "2026-08-05", shares: 1 },
        { price: 200, priceAsOf: "2026-07-01", shares: 1 },
      ],
      TODAY,
    );
    expect(s.asOf).toBe("2026-07-01");
    expect(s.ageDays).toBe(36);
  });

  it(`${STALE_AFTER_DAYS}일이 지나면 오래된 값으로 표시하고 경과일을 문장에 넣는다`, () => {
    const fresh = summarizeManualPrices([{ price: 1, priceAsOf: "2026-08-01", shares: 1 }], TODAY);
    expect(fresh.stale).toBe(false);
    expect(fresh.note).not.toMatch(/일 지났습니다/);

    const old = summarizeManualPrices([{ price: 1, priceAsOf: "2026-06-01", shares: 1 }], TODAY);
    expect(old.stale).toBe(true);
    expect(old.note).toMatch(/66일 지났습니다/);
  });

  it("수량은 있는데 시세가 없는 종목을 센다 — 그만큼 평가액이 비어 있다", () => {
    const s = summarizeManualPrices(
      [
        { price: 100, priceAsOf: TODAY, shares: 10 },
        { shares: 5 },
        { shares: 7 },
        { price: 0, priceAsOf: TODAY }, // 현금성: 수량이 없으면 세지 않는다
      ],
      TODAY,
    );
    expect(s.missing).toBe(2);
    expect(s.note).toMatch(/2개 종목/);
  });

  it("⚠ 자동 시세로 오해되지 않게 항상 '직접 입력'임을 밝힌다", () => {
    const s = summarizeManualPrices([{ price: 100, priceAsOf: TODAY, shares: 1 }], TODAY);
    expect(s.note).toMatch(/직접 입력/);
    expect(s.note).toMatch(/실시간 시세 아님/);
    expect(s.note).toContain(TODAY);
  });

  it("기준일을 안 적었으면 그 사실을 말한다 — 조용히 넘어가지 않는다", () => {
    const s = summarizeManualPrices([{ price: 100, shares: 1 }], TODAY);
    expect(s.asOf).toBeUndefined();
    expect(s.stale).toBe(false);
    expect(s.note).toMatch(/기준일이 적혀 있지 않습니다/);
  });

  it("아무 값도 없으면 비중이 계산되지 않는다고 말한다", () => {
    const s = summarizeManualPrices([{ shares: 10 }], TODAY);
    expect(s.note).toMatch(/계산되지 않습니다/);
  });
});
