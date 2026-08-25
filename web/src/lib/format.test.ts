import { describe, expect, it } from "vitest";
import {
  cx,
  formatCompact,
  formatDate,
  formatNumber,
  formatPct,
  profitColor,
  scoreColor,
  stripEmphasis,
} from "./format";
import { MACRO_INDICATORS } from "./macro/catalog";
import { MACRO_GROUPS } from "./macro/groups";

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

describe("stripEmphasis — 기계가 읽는 자리에서는 표시를 걷어낸다", () => {
  /**
   * ⚠ 2026-08-25 운영에서 확인. 화면은 `Emphasis`가 막고 있었지만 **메타 설명·JSON-LD·AI
   *   색인은 뚫려 있어서** 검색 결과 미리보기에 별표가 그대로 찍혔다.
   */
  it("강조 표시만 지우고 글자는 그대로 둔다", () => {
    expect(stripEmphasis("앞쪽은 **방향과 기울기**를 봅니다")).toBe("앞쪽은 방향과 기울기를 봅니다");
  });

  it("강조가 없으면 그대로다", () => {
    expect(stripEmphasis("별표가 없는 문장")).toBe("별표가 없는 문장");
  });

  it("여러 개도 다 지운다", () => {
    expect(stripEmphasis("**하나** 사이 **둘**")).toBe("하나 사이 둘");
  });

  it("⚠ 결과에 별표가 남지 않는다 — 이게 이 함수의 유일한 약속이다", () => {
    for (const text of [
      "**성격이 다른 두 가지**가 섞여 있습니다",
      "앞에만 **강조",
      "**",
      "짝이 안 맞는 ** 별표 ** 셋 **",
    ]) {
      expect(stripEmphasis(text).includes("**"), text).toBe(false);
    }
  });

  it("⚠ 카탈로그의 모든 설명글이 이 함수를 통과하면 별표가 사라진다", () => {
    for (const g of MACRO_GROUPS) expect(stripEmphasis(g.intro)).not.toContain("**");
    for (const i of MACRO_INDICATORS) {
      for (const field of [i.what, i.why, i.read]) {
        expect(stripEmphasis(field)).not.toContain("**");
      }
    }
  });
});
