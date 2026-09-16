import { describe, expect, it } from "vitest";
import { MACRO_INDICATORS, findIndicator } from "./catalog";
import { validateSectors } from "./registry";
import { TREASURY_SOURCE_IDS } from "./treasury-fetch";

/**
 * ⭐ 2026-09-16(S2-c): `TREASURY_SOURCE_IDS`가 `lib/macro/treasury-fetch.ts`로 옮겨졌다. 그 파일은 **D1을 부르지 않으므로**
 *   이제 소스를 텍스트로 읽지 않고 그대로 import한다 — 정규식으로 남의 파일을 긁던 자리가 없어졌다.
 *   ⚠ 여전히 재는 것은 같다: 카탈로그에 수집기가 모르는 ID가 들어가면 매일 「실패」가 된다.
 */
function treasuryIdsInCollector(): string[] {
  return [...TREASURY_SOURCE_IDS];
}

describe("R2b-2 — 재무부 Fiscal Data", () => {
  it("정의 검증이 깨끗하다", () => {
    expect(validateSectors()).toEqual([]);
  });

  it("⚠ 카탈로그의 TREASURY 지표는 수집기가 아는 소스 ID만 쓴다", () => {
    const known = new Set(treasuryIdsInCollector());
    const treasury = MACRO_INDICATORS.filter((i) => i.source === "TREASURY");
    expect(treasury.length).toBeGreaterThan(0);
    for (const i of treasury) expect(known.has(i.sourceId ?? ""), `${i.key} → ${i.sourceId}`).toBe(true);
  });

  /**
   * ⚠ 2026-09-14 바뀐 결정: 운영 워커에서 Fiscal Data가 525(TLS 핸드셰이크 실패)로 막혀 **입찰 두 계열은 TreasuryDirect**로 받는다.
   *   링크는 **실제로 받는 곳**을 가리켜야 한다 — 받는 곳과 다른 페이지를 출처로 걸면 독자가 되짚을 수 없다.
   *   MSPD 비중 둘은 대체 경로가 없어 Fiscal Data에 남았다.
   */
  it("재무부 지표는 유동성 묶음에 있고, 링크는 실제로 받는 재무부 페이지다", () => {
    const expected: Record<string, RegExp> = {
      tsy_bill_share: /^https:\/\/fiscaldata\.treasury\.gov\//,
      tsy_coupon_share: /^https:\/\/fiscaldata\.treasury\.gov\//,
      auction10y_btc: /^https:\/\/www\.treasurydirect\.gov\//,
      auction10y_yield: /^https:\/\/www\.treasurydirect\.gov\//,
    };
    for (const [key, url] of Object.entries(expected)) {
      const i = findIndicator(key);
      expect(i?.group, key).toBe("liquidity");
      expect(i?.url, key).toMatch(url);
    }
  });

  /** ⚠ 이름이 같은 TIPS가 섞이면 낙찰금리가 절반으로 떨어진다 — 카드가 스스로 그렇게 말해야 한다. */
  it("⚠ 입찰 지표는 명목 10년물이라고 이름·출처에 적는다", () => {
    for (const key of ["auction10y_btc", "auction10y_yield"]) {
      const i = findIndicator(key)!;
      expect(i.name, key).toContain("명목");
      expect(i.sourceLabel, key).toContain("TIPS 제외");
    }
  });
});
