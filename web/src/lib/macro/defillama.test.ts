import { describe, expect, it } from "vitest";
import { MACRO_INDICATORS } from "./catalog";
import { DEFILLAMA_SOURCE_IDS, parseStablecoinChart } from "./defillama";
import { applyTransform } from "./series";

// 2026-09-26 운영 응답과 같은 꼴(날짜는 유닉스 초 문자열 · UTC 자정)
const row = (date: string, usd?: number) => ({
  date: String(Date.parse(`${date}T00:00:00Z`) / 1000),
  totalCirculating: {},
  totalCirculatingUSD: usd === undefined ? { peggedEUR: 1 } : { peggedUSD: usd, peggedEUR: 1 },
});

describe("DefiLlama — 달러 스테이블코인 잔액", () => {
  it("peggedUSD만 골라 날짜순으로 돌려준다", () => {
    const json = [row("2026-09-25", 312_317_650_053), row("2017-11-29", 110_105)];
    expect(parseStablecoinChart(json, "peggedUSD", "1990-01-01")).toEqual([
      { date: "2017-11-29", value: 110_105 },
      { date: "2026-09-25", value: 312_317_650_053 },
    ]);
  });

  it("from 이전은 버리고, 값이 없는 날은 결측으로 건너뛴다", () => {
    const json = [row("2026-09-23", 1), row("2026-09-24"), row("2026-09-25", 3)];
    expect(parseStablecoinChart(json, "peggedUSD", "2026-09-24")).toEqual([{ date: "2026-09-25", value: 3 }]);
  });

  it("⚠ UTC 자정이 아닌 날짜·겹친 날짜·배열 아닌 응답은 던진다", () => {
    expect(() => parseStablecoinChart([{ date: "1790380801", totalCirculatingUSD: { peggedUSD: 1 } }], "peggedUSD", "1990-01-01")).toThrow(/자정/);
    expect(() => parseStablecoinChart([row("2026-09-25", 1), row("2026-09-25", 2)], "peggedUSD", "1990-01-01")).toThrow(/두 번/);
    expect(() => parseStablecoinChart({ error: "x" }, "peggedUSD", "1990-01-01")).toThrow(/배열/);
  });

  it("화면은 십억 달러로 읽는다(levelB)", () => {
    expect(applyTransform([{ date: "2026-09-25", value: 312_317_650_053 }], "levelB")[0].value).toBeCloseTo(312.32, 2);
  });

  it("⚠ 카탈로그의 DEFILLAMA 지표는 수집기가 아는 소스 ID만 쓴다", () => {
    const known = new Set<string>(DEFILLAMA_SOURCE_IDS);
    const list = MACRO_INDICATORS.filter((i) => i.source === "DEFILLAMA");
    expect(list.length).toBeGreaterThan(0);
    for (const i of list) expect(known.has(i.sourceId ?? ""), `${i.key} → ${i.sourceId}`).toBe(true);
  });
});
