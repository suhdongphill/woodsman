import { describe, expect, it } from "vitest";
import {
  fillProgressPct,
  holdingValueKrw,
  summarizeAllocation,
  targetSumPct,
  totalValue,
  underweightBuckets,
  type AllocationInput,
} from "./allocation";
import {
  DEFAULT_DATA_MODE,
  dataModeNotice,
  isRealMoney,
  normalizeDataMode,
  returnSuffix,
} from "./data-mode";

const PLAN: AllocationInput[] = [
  { functionType: "GROWTH", targetWeight: 40 },
  { functionType: "INCOME", targetWeight: 35 },
  { functionType: "DEFENSE", targetWeight: 25 },
];

describe("목표 대비 현재 비중", () => {
  it("⚠ 평가액이 없으면 현재 비중은 0이다 — 목표를 현재인 척하지 않는다", () => {
    const rows = summarizeAllocation(PLAN);
    expect(rows.map((r) => r.currentPct)).toEqual([0, 0, 0]);
    expect(rows.map((r) => r.targetPct)).toEqual([40, 35, 25]);
    expect(fillProgressPct(rows)).toBe(0);
  });

  it("한 버킷만 채우면 그만큼만 완료율에 잡힌다", () => {
    // 성장에만 100만원. 총액이 그것뿐이라 현재 비중은 성장 100%.
    const rows = summarizeAllocation([
      { functionType: "GROWTH", targetWeight: 40, marketValue: 1_000_000 },
      { functionType: "INCOME", targetWeight: 35 },
      { functionType: "DEFENSE", targetWeight: 25 },
    ]);
    expect(rows[0].currentPct).toBe(100);
    expect(rows[0].gapPct).toBe(60);
    // 겹치는 부분은 성장의 40%뿐 → 40/100
    expect(fillProgressPct(rows)).toBe(40);
  });

  it("목표대로 채우면 100%", () => {
    const rows = summarizeAllocation([
      { functionType: "GROWTH", targetWeight: 40, marketValue: 400 },
      { functionType: "INCOME", targetWeight: 35, marketValue: 350 },
      { functionType: "DEFENSE", targetWeight: 25, marketValue: 250 },
    ]);
    expect(fillProgressPct(rows)).toBe(100);
    expect(rows.every((r) => r.gapPct === 0)).toBe(true);
  });

  it("미달 버킷을 부족한 순서로 돌려준다", () => {
    const rows = summarizeAllocation([
      { functionType: "GROWTH", targetWeight: 40, marketValue: 800 },
      { functionType: "INCOME", targetWeight: 35, marketValue: 200 },
      { functionType: "DEFENSE", targetWeight: 25 },
    ]);
    const under = underweightBuckets(rows);
    expect(under[0].functionType).toBe("DEFENSE"); // -25
    expect(under[1].functionType).toBe("INCOME"); // -15
    expect(under).toHaveLength(2);
  });

  it("목표 합계를 그대로 돌려준다(100%가 아니면 화면이 경고한다)", () => {
    expect(targetSumPct(summarizeAllocation(PLAN))).toBe(100);
    expect(
      targetSumPct(summarizeAllocation([{ functionType: "GROWTH", targetWeight: 40 }])),
    ).toBe(40);
  });

  it("종목이 하나도 없어도 죽지 않는다", () => {
    expect(totalValue([])).toBe(0);
    expect(fillProgressPct(summarizeAllocation([]))).toBe(0);
  });
});

describe("통화 환산", () => {
  it("⚠ 달러 종목을 원화로 환산한다 — 안 하면 비중이 통째로 틀린다", () => {
    // 실제로 겪은 값: TSMC 40주 × $191.20
    expect(holdingValueKrw({ shares: 40, price: 191.2, currency: "USD" }, 1350)).toBeCloseTo(
      40 * 191.2 * 1350,
    );
  });

  it("원화 종목은 그대로 둔다", () => {
    expect(holdingValueKrw({ shares: 900, price: 11_800, currency: "KRW" }, 1350)).toBe(10_620_000);
    // 통화 미지정도 원화로 본다(스키마 기본값이 KRW)
    expect(holdingValueKrw({ shares: 10, price: 1000 }, 1350)).toBe(10_000);
  });

  it("수량이나 가격이 없으면 undefined — 0으로 치지 않는다", () => {
    expect(holdingValueKrw({ shares: 10 }, 1350)).toBeUndefined();
    expect(holdingValueKrw({ price: 100 }, 1350)).toBeUndefined();
  });

  it("환산하면 통화가 섞인 계좌의 비중이 뒤집힌다", () => {
    const holdings = [
      { functionType: "GROWTH" as const, targetWeight: 50, shares: 40, price: 191.2, currency: "USD" as const },
      { functionType: "DEFENSE" as const, targetWeight: 50, shares: 320, price: 34_200, currency: "KRW" as const },
    ];

    // 환산 없이 더하면 성장이 0.07%로 묻힌다 — 예전 버그의 재현
    const wrong = summarizeAllocation(
      holdings.map((h) => ({ ...h, marketValue: h.shares * h.price })),
    );
    expect(wrong[0].currentPct).toBeLessThan(1);

    // 환산하면 성장이 제 몫을 찾는다
    const right = summarizeAllocation(
      holdings.map((h) => ({ ...h, marketValue: holdingValueKrw(h, 1350) })),
    );
    expect(right[0].currentPct).toBeGreaterThan(45);
  });
});

describe("모의/실계좌 표시", () => {
  it("⚠ 기본값은 '모의 투자'다 — 못 읽었을 때 실계좌로 보이면 안 된다", () => {
    expect(DEFAULT_DATA_MODE).toBe("PAPER");
    expect(normalizeDataMode(undefined)).toBe("PAPER");
    expect(normalizeDataMode("아무거나")).toBe("PAPER");
    expect(isRealMoney(normalizeDataMode(null))).toBe(false);
  });

  it("모의 표시는 '무엇이 가상이고 무엇이 실제인지'를 구분해 적는다", () => {
    const notice = dataModeNotice("PAPER");
    expect(notice.badge).toBe("모의 투자");
    expect(notice.isRealMoney).toBe(false);
    // 매매는 가상, 시세는 실제 — 둘 다 명시해야 사과가 아니라 설명이 된다.
    expect(notice.line).toContain("가상");
    expect(notice.line).toContain("실제 시장가격");
    // 신뢰를 스스로 깎는 표현을 쓰지 않는다.
    expect(notice.line).not.toContain("믿");
  });

  it("실계좌만 실제 자금 성과로 인용할 수 있다", () => {
    expect(isRealMoney("LIVE")).toBe(true);
    expect(isRealMoney("PAPER")).toBe(false);
  });

  it("수익률 꼬리표는 모의일 때만 붙는다", () => {
    expect(returnSuffix("PAPER")).toBe("모의");
    expect(returnSuffix("LIVE")).toBeNull();
  });
});
