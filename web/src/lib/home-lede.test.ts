import { describe, expect, it } from "vitest";
import { macroLede } from "./home-lede";

const base = {
  empty: false,
  summary: { label: "침체 신호 안정", alerts: 0, total: 5 },
  asOf: "2026-08-24",
};

describe("첫 화면 한 줄", () => {
  it("등급 · 지표 수 · 기준일을 한 줄로 낸다", () => {
    expect(macroLede(base)).toBe("침체 신호 안정 · 지표 5개 종합 · 2026-08-24 기준");
  });

  it("경고가 있으면 숫자로 말한다 — '주의하세요'는 아무 정보도 아니다", () => {
    expect(macroLede({ ...base, summary: { label: "경계", alerts: 2, total: 5 } })).toBe(
      "침체 신호 경계 · 경고 2개 · 지표 5개 종합 · 2026-08-24 기준",
    );
  });

  it("⚠ 값이 하나도 없으면 null — 없는 상태를 문장으로 덮지 않는다", () => {
    expect(macroLede({ ...base, empty: true })).toBeNull();
  });

  it("⚠ 판정에 쓴 지표가 0개여도 null — 등급 자체가 성립하지 않는다", () => {
    expect(macroLede({ ...base, summary: { label: "안정", alerts: 0, total: 0 } })).toBeNull();
  });

  it("⚠ 주어를 붙인다 — 등급만 적으면 '무엇이 안정?'이라고 되묻는다", () => {
    expect(macroLede({ ...base, summary: { label: "경계", alerts: 0, total: 5 } })).toContain(
      "침체 신호 경계",
    );
    // 이미 주어가 들어 있으면 두 번 붙이지 않는다
    expect(macroLede(base)).toBe("침체 신호 안정 · 지표 5개 종합 · 2026-08-24 기준");
  });

  it("기준일을 모르면 그 부분만 뺀다 — 날짜를 지어내지 않는다", () => {
    expect(macroLede({ ...base, asOf: undefined })).toBe("침체 신호 안정 · 지표 5개 종합");
  });
});
