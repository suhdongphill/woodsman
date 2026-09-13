import { describe, expect, it } from "vitest";
import { liquidityCardView, liquidityOneLine, parseStoredDetail, type StoredDetail } from "./summary";

/** 2026-09-12 운영 데이터 읽기 전용 계산(자금시장 보강 후)의 구성 — GLS 50.1 · 80% */
const DETAIL_0912: StoredDetail = {
  components: [
    { key: "fed_system", weight: 0.25, score: 47.8 },
    { key: "treasury", weight: 0.2, missingReason: "하위 점수 Treasury Liquidity이 발행 기준 미달(커버리지 30%)" },
    { key: "funding", weight: 0.15, score: 49.0 },
    { key: "credit", weight: 0.15, score: 61.5 },
    { key: "rates_market", weight: 0.15, score: 40.0 },
    { key: "global_dollar", weight: 0.1, score: 55.6 },
  ],
};

describe("유동성 한 줄 요약", () => {
  it("⭐ 점수 · 방향 · 받치는 계기 · 누르는 계기 · 빠진 계기", () => {
    expect(liquidityOneLine({ value: 50.1, coverage: 80, state: "OK", detail: DETAIL_0912, past4: 46.8 })).toBe(
      "유동성 50 · 보합 — 신용(62)이 받치고 금리시장(40)이 누른다 · 빠진 계기: 재무부",
    );
  });

  it("50과의 차이가 5점 미만이면 받친다/누른다고 말하지 않는다", () => {
    const flat: StoredDetail = { components: [{ key: "credit", weight: 0.5, score: 53 }, { key: "funding", weight: 0.5, score: 47 }] };
    expect(liquidityOneLine({ value: 50, coverage: 100, state: "OK", detail: flat, past4: 50 })).toBe("유동성 50 · 보합");
  });

  it("⚠ 4주 전 점수가 없으면 방향을 말하지 않는다", () => {
    expect(liquidityOneLine({ value: 50.1, coverage: 80, state: "OK", detail: DETAIL_0912 })).toMatch(/^유동성 50 — /);
  });

  it("⚠ 발행하지 않은 점수에는 숫자를 쓰지 않는다", () => {
    const line = liquidityOneLine({ value: null, coverage: 50, state: "DO_NOT_PUBLISH", detail: DETAIL_0912, past4: 47 });
    expect(line).toBe("유동성 판정 보류 · 채운 계기 50% · 빠진 계기: 재무부");
    expect(line).not.toMatch(/유동성 \d/);
  });

  it("⭐ 저장 행 → 카드 한 줄 · 팝업 계기 표(가중치 % · 결측 이유)", () => {
    const view = liquidityCardView(
      { asOf: "2026-09-12", value: 50.1, coverage: 80, state: "OK", detail: JSON.stringify(DETAIL_0912) },
      46.8,
    );
    expect(view?.oneLine).toBe("유동성 50 · 보합 — 신용(62)이 받치고 금리시장(40)이 누른다 · 빠진 계기: 재무부");
    expect(view?.components[1]).toEqual({
      key: "treasury",
      label: "재무부",
      weightPct: 20,
      missingReason: "하위 점수 Treasury Liquidity이 발행 기준 미달(커버리지 30%)",
    });
    expect(view?.components[3]).toMatchObject({ label: "신용", weightPct: 15, score: 61.5 });
  });

  it("⚠ 저장 행이 없거나 detail이 깨졌으면 카드 요약을 만들지 않는다 — 없는 구성을 지어내지 않는다", () => {
    expect(liquidityCardView(undefined)).toBeUndefined();
    expect(parseStoredDetail("{not json")).toBeUndefined();
    expect(liquidityCardView({ asOf: "2026-09-12", value: 50, coverage: 80, state: "OK", detail: "{}" })).toBeUndefined();
  });

  it("⚠ 구성의 서술이지 권유가 아니다 — 매수·매도 말이 들어가지 않는다", () => {
    const lines = [
      liquidityOneLine({ value: 72, coverage: 90, state: "OK", detail: DETAIL_0912, past4: 60 }),
      liquidityOneLine({ value: 30, coverage: 90, state: "OK", detail: DETAIL_0912, past4: 45 }),
    ];
    for (const l of lines) expect(l).not.toMatch(/매수|매도|사세요|파세요|비중|현금/);
  });
});
