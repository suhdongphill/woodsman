import { describe, expect, it } from "vitest";
import {
  cx,
  formatCompact,
  formatDate,
  formatNumber,
  formatPct,
  profitColor,
  scoreColor,
} from "./format";

describe("formatNumber", () => {
  it("원화는 천단위 구분 + '원'", () => {
    expect(formatNumber(36980, "KRW")).toBe("36,980원");
  });
  it("달러는 소수 2자리 고정", () => {
    expect(formatNumber(191.2, "USD")).toBe("$191.20");
  });
});

describe("formatCompact", () => {
  it("억/만 단위로 축약한다", () => {
    expect(formatCompact(123_000_000, "KRW")).toBe("1.2억");
    expect(formatCompact(50_000, "KRW")).toBe("5만");
  });
  it("달러는 K/M 단위로 축약한다", () => {
    expect(formatCompact(2_400_000, "USD")).toBe("$2.4M");
    expect(formatCompact(7_600, "USD")).toBe("$7.6K");
  });
});

describe("formatPct", () => {
  it("양수에 + 부호를 붙인다", () => {
    expect(formatPct(1.238)).toBe("+1.24%");
    expect(formatPct(-0.86)).toBe("-0.86%");
  });
});

describe("scoreColor (CANSLIM 색상 규칙)", () => {
  it("7점 이상은 초록", () => {
    expect(scoreColor(8.4).text).toBe("text-emerald-400");
  });
  it("5~7점은 노랑", () => {
    expect(scoreColor(5.2).text).toBe("text-yellow-400");
  });
  it("5점 미만은 빨강", () => {
    expect(scoreColor(4.6).text).toBe("text-red-400");
  });
});

describe("profitColor", () => {
  it("0 이상은 초록, 음수는 빨강", () => {
    expect(profitColor(0)).toBe("text-emerald-400");
    expect(profitColor(-0.1)).toBe("text-red-400");
  });
});

describe("formatDate", () => {
  it("KST 고정 포맷으로 SSR/CSR 결과가 같다", () => {
    expect(formatDate("2026-07-28T09:00:00+09:00")).toBe("2026. 07. 28");
  });
  it("값이 없으면 '-'", () => {
    expect(formatDate(undefined)).toBe("-");
  });
});

describe("cx", () => {
  it("falsy 값을 걸러내고 공백으로 잇는다", () => {
    expect(cx("a", false, undefined, "b")).toBe("a b");
  });
});
