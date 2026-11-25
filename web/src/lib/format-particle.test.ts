import { describe, expect, it } from "vitest";
import { objectParticle } from "./format";

describe("objectParticle — 을/를", () => {
  it("받침이 있으면 을", () => {
    for (const w of ["고용", "환율", "유동성", "부동산", "신용·자금", "투자·자본형성", "생산성·공급", "물가 압력"]) {
      expect(objectParticle(w)).toBe("을");
    }
  });
  it("받침이 없으면 를", () => {
    for (const w of ["물가", "금리", "원자재", "반도체", "소비·심리", "재정·국채", "생산·제조", "주도주 섹터"]) {
      expect(objectParticle(w)).toBe("를");
    }
  });
  it("한글로 끝나지 않으면 둘 다 적는다", () => {
    expect(objectParticle("CPI")).toBe("을(를)");
    expect(objectParticle("")).toBe("을(를)");
  });
});
