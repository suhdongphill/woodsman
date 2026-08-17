import { describe, expect, it } from "vitest";
import { isUsableProfile, looksLikeName, parseTickerProfile } from "./lookup";

function chart(meta: Record<string, unknown>) {
  return { chart: { result: [{ meta }] } };
}

describe("looksLikeName", () => {
  it("보통 이름은 통과한다", () => {
    expect(looksLikeName("NVIDIA Corporation")).toBe(true);
    expect(looksLikeName("Kakao Corp")).toBe(true);
  });

  it("쉼표로 이어 붙인 식별자 나열을 막는다 — 코스닥 shortName이 그렇게 온다", () => {
    expect(looksLikeName("035720.KQ,0P0000AN5S,1145416")).toBe(false);
  });

  it("숫자·점뿐이면 티커지 이름이 아니다", () => {
    expect(looksLikeName("005930")).toBe(false);
    expect(looksLikeName("")).toBe(false);
    expect(looksLikeName(undefined)).toBe(false);
  });
});

describe("parseTickerProfile", () => {
  it("이름·거래소·통화·가격을 읽는다", () => {
    const p = parseTickerProfile(
      chart({
        longName: "NVIDIA Corporation",
        shortName: "NVIDIA Corporation",
        currency: "USD",
        fullExchangeName: "NasdaqGS",
        instrumentType: "EQUITY",
        regularMarketPrice: 225.16,
        regularMarketTime: Math.floor(Date.UTC(2026, 7, 14, 20, 0) / 1000),
      }),
    );
    expect(p?.name).toBe("NVIDIA Corporation");
    expect(p?.currency).toBe("USD");
    expect(p?.exchange).toBe("NasdaqGS");
    expect(p?.price).toBe(225.16);
    expect(p?.asOf).toBe("2026-08-14");
  });

  it("shortName이 깨져 있으면 longName을 쓴다 — 실측된 코스닥 사례", () => {
    const p = parseTickerProfile(
      chart({
        shortName: "035720.KQ,0P0000AN5S,1145416",
        longName: "Kakao Corp",
        currency: "KRW",
      }),
    );
    expect(p?.name).toBe("Kakao Corp");
  });

  it("둘 다 쓸 수 없으면 이름을 비워 둔다 — 티커를 이름으로 쓰지 않는다", () => {
    const p = parseTickerProfile(chart({ shortName: "005930,X", currency: "KRW" }));
    expect(p?.name).toBeUndefined();
  });

  it("거래소 이름이 fullExchangeName에 없으면 exchangeName을 쓴다", () => {
    expect(parseTickerProfile(chart({ exchangeName: "KSC" }))?.exchange).toBe("KSC");
  });

  it("종목 유형을 그대로 낸다 — ETF를 주식으로 적지 않게", () => {
    expect(parseTickerProfile(chart({ instrumentType: "ETF" }))?.instrumentType).toBe("ETF");
  });

  it("meta가 없으면 undefined", () => {
    expect(parseTickerProfile({})).toBeUndefined();
    expect(parseTickerProfile(null)).toBeUndefined();
  });
});

describe("isUsableProfile", () => {
  it("이름이나 가격 중 하나라도 있으면 쓸 만하다", () => {
    expect(isUsableProfile({ name: "NVIDIA" })).toBe(true);
    expect(isUsableProfile({ price: 100 })).toBe(true);
  });

  it("둘 다 없으면 조회 실패로 본다 — 빈 결과를 성공으로 처리하지 않는다", () => {
    expect(isUsableProfile({ currency: "USD" })).toBe(false);
    expect(isUsableProfile(undefined)).toBe(false);
  });
});
