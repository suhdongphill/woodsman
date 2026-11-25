import { describe, expect, it } from "vitest";
import { changeSentence, decomposeYield, type DecompPoint } from "./yield-decomp";

const s = (pairs: [string, number][]): DecompPoint[] => pairs.map(([date, value]) => ({ date, value }));

/** 2026-11-25 FRED 원값(8/21 · 10/23 · 11/20·23·24) — 구성안의 표와 같은 숫자가 나와야 한다. */
const REAL_2026_11: Parameters<typeof decomposeYield>[0] = {
  nominal: s([["2026-08-21", 4.74], ["2026-10-23", 5.0], ["2026-11-23", 4.92]]),
  real: s([["2026-08-21", 2.4], ["2026-10-23", 2.66], ["2026-11-23", 2.79]]),
  // T10YIE는 하루 늦게 올라오는 날이 있다 — 11-24 값은 짝(DGS10 11-24)이 없어 쓰이지 않아야 한다.
  bei: s([["2026-08-21", 2.34], ["2026-10-23", 2.34], ["2026-11-23", 2.13], ["2026-11-24", 2.12]]),
  kwFitted: s([["2026-08-20", 4.8044], ["2026-10-20", 4.9997], ["2026-11-20", 4.9522]]),
  kwTermPremium: s([["2026-08-20", 0.8682], ["2026-10-20", 0.936], ["2026-11-20", 0.8888]]),
};

describe("decomposeYield — 수준", () => {
  it("시장 분해는 세 계열이 모두 있는 마지막 날짜(11-23)만 쓴다", () => {
    const r = decomposeYield(REAL_2026_11);
    expect(r.market).toEqual({ date: "2026-11-23", nominal: 4.92, real: 2.79, bei: 2.13 });
  });

  it("모형 분해: 기대 단기금리 = 적합 − 텀 프리미엄", () => {
    const r = decomposeYield(REAL_2026_11);
    expect(r.model!.date).toBe("2026-11-20");
    expect(r.model!.expected).toBeCloseTo(4.0634, 4);
    expect(r.model!.termPremium).toBeCloseTo(0.8888, 4);
  });

  it("⚠ 성분 하나라도 비면 그 분해는 없다(부분 합성 금지)", () => {
    const r = decomposeYield({ ...REAL_2026_11, real: [] });
    expect(r.market).toBeUndefined();
    expect(r.marketChanges).toEqual([]);
    expect(r.model).toBeDefined();
  });
});

describe("decomposeYield — 변화", () => {
  it("3개월: 10년물 +0.18 = 실질 +0.39 · 기대인플레 −0.21", () => {
    const c = decomposeYield(REAL_2026_11).marketChanges.find((x) => x.months === 3)!;
    expect(c.from).toBe("2026-08-21");
    expect(c.delta.nominal).toBeCloseTo(0.18, 6);
    expect(c.delta.real).toBeCloseTo(0.39, 6);
    expect(c.delta.bei).toBeCloseTo(-0.21, 6);
  });

  it("모형 3개월: 기대 단기금리 +0.13 · 텀 프리미엄 +0.02", () => {
    const c = decomposeYield(REAL_2026_11).modelChanges.find((x) => x.months === 3)!;
    expect(c.delta.expected).toBeCloseTo(0.1272, 4);
    expect(c.delta.termPremium).toBeCloseTo(0.0206, 4);
  });

  it("⚠ k개월 전 7일 안에 공통 날짜가 없으면 그 기간은 비운다", () => {
    const r = decomposeYield({
      ...REAL_2026_11,
      nominal: REAL_2026_11.nominal.filter((p) => p.date !== "2026-08-21"),
    });
    expect(r.marketChanges.map((c) => c.months)).toEqual([1]);
  });

  it("월말 날짜에서 달을 빼도 날짜가 넘치지 않는다(5-31 → 2-28 근방)", () => {
    const r = decomposeYield(
      {
        nominal: s([["2026-02-27", 4], ["2026-05-29", 4.2]]),
        real: s([["2026-02-27", 2], ["2026-05-29", 2.1]]),
        bei: s([["2026-02-27", 2], ["2026-05-29", 2.1]]),
        kwFitted: [],
        kwTermPremium: [],
      },
      [3],
    );
    expect(r.marketChanges[0].from).toBe("2026-02-27");
  });
});

describe("문장", () => {
  it("주된 성분과 상쇄를 말하고, 모형 분해를 덧붙인다", () => {
    const sentence = decomposeYield(REAL_2026_11).sentence!;
    expect(sentence).toContain("최근 3개월 10년물 변화 +0.18%p는");
    expect(sentence).toContain("주로 실질금리");
    expect(sentence).toContain("상쇄");
    expect(sentence).toContain("기대 단기금리 +0.13%p");
    expect(sentence).not.toMatch(/매수|매도|사세요|파세요/);
  });

  it("10년물이 거의 그대로면 「거의 그대로」로 말한다", () => {
    const t = changeSentence(
      [{ months: 3, from: "a", to: "b", delta: { nominal: 0.01, real: 0.2, bei: -0.19 } }],
      [],
      3,
    )!;
    expect(t).toContain("거의 그대로");
  });

  it("기간이 없으면 문장도 없다", () => {
    expect(changeSentence([], [], 3)).toBeUndefined();
  });
});
