import { describe, expect, it } from "vitest";
import { fallbackSymbol, parseYahooQuotes, planSymbol } from "./parse";

/** 2026-03-02, 2026-03-03 (UTC 정오 근처) */
const T1 = Math.floor(Date.UTC(2026, 2, 2, 14, 30) / 1000);
const T2 = Math.floor(Date.UTC(2026, 2, 3, 14, 30) / 1000);

function chart(close: (number | null)[], volume?: (number | null)[]) {
  return {
    chart: {
      result: [
        {
          timestamp: [T1, T2].slice(0, close.length),
          indicators: { quote: [{ close, volume }] },
        },
      ],
    },
  };
}

describe("parseYahooQuotes", () => {
  it("종가와 거래량을 함께 읽는다", () => {
    expect(parseYahooQuotes(chart([100, 110], [1000, 2000]))).toEqual([
      { date: "2026-03-02", close: 100, volume: 1000 },
      { date: "2026-03-03", close: 110, volume: 2000 },
    ]);
  });

  it("휴장일(close null)은 버린다 — 0으로 꽂히면 차트가 무너진다", () => {
    expect(parseYahooQuotes(chart([null, 110], [0, 2000]))).toEqual([
      { date: "2026-03-03", close: 110, volume: 2000 },
    ]);
  });

  it("거래량만 없으면 버리지 않는다 — 종가는 쓸 수 있다", () => {
    expect(parseYahooQuotes(chart([100], [null]))).toEqual([
      { date: "2026-03-02", close: 100, volume: undefined },
    ]);
  });

  it("거래량 배열이 아예 없어도 종가는 읽는다", () => {
    expect(parseYahooQuotes(chart([100]))).toEqual([
      { date: "2026-03-02", close: 100, volume: undefined },
    ]);
  });

  it("응답이 비어 있으면 빈 배열", () => {
    expect(parseYahooQuotes({})).toEqual([]);
    expect(parseYahooQuotes(null)).toEqual([]);
    expect(parseYahooQuotes({ chart: { result: [] } })).toEqual([]);
  });
});

describe("planSymbol", () => {
  it("미국 티커는 대문자 그대로 쓴다", () => {
    expect(planSymbol("nvda", "US")).toEqual({ symbol: "NVDA", reliability: "ok" });
  });

  it("점·하이픈이 든 미국 티커도 받는다", () => {
    expect(planSymbol("BRK-B", "US")?.symbol).toBe("BRK-B");
    expect(planSymbol("BF.B", "US")?.symbol).toBe("BF.B");
  });

  it("국내 티커는 6자리 숫자 그대로에 .KS를 붙인다 — 앞의 0이 잘리면 종목이 바뀐다", () => {
    const plan = planSymbol("005930", "KR");
    expect(plan?.symbol).toBe("005930.KS");
  });

  it("국내 시세는 덜 믿을 값으로 표시한다", () => {
    const plan = planSymbol("005930", "KR");
    expect(plan?.reliability).toBe("delayed");
    expect(plan?.caveat).toContain("지연");
  });

  it("미국 시세에는 단서를 붙이지 않는다", () => {
    expect(planSymbol("NVDA", "US")?.caveat).toBeUndefined();
  });

  it("시장에 맞지 않는 모양이면 계획을 내지 않는다", () => {
    expect(planSymbol("005930", "US")).toBeUndefined();
    expect(planSymbol("NVDA", "KR")).toBeUndefined();
    expect(planSymbol("12345", "KR")).toBeUndefined();
    expect(planSymbol("", "US")).toBeUndefined();
  });

  it("모르는 시장이면 계획을 내지 않는다 — 임의로 미국으로 떨어뜨리지 않는다", () => {
    expect(planSymbol("NVDA", "JP")).toBeUndefined();
  });
});

describe("fallbackSymbol", () => {
  it("코스피에서 못 찾으면 코스닥으로 되묻는다", () => {
    expect(fallbackSymbol({ symbol: "035720.KS", reliability: "delayed" })).toBe("035720.KQ");
  });

  it("미국은 되물을 것이 없다", () => {
    expect(fallbackSymbol({ symbol: "NVDA", reliability: "ok" })).toBeUndefined();
  });
});
