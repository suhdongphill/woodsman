import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MACRO_INDICATORS, findIndicator } from "./catalog";
import { validateSectors } from "./registry";

/**
 * ⚠ `TREASURY_SOURCE_IDS`는 수집기(`features/macro/ingest.ts`)에 있다. 그 파일은 D1·네트워크를 부르므로 테스트에서 import하지 않고
 *   **소스를 읽어** 목록을 꺼낸다 — 카탈로그에 수집기가 모르는 ID가 들어가면 매일 「실패」가 된다.
 */
function treasuryIdsInCollector(): string[] {
  const src = readFileSync(join(process.cwd(), "src", "features", "macro", "ingest.ts"), "utf8");
  const block = src.match(/TREASURY_SOURCE_IDS = \[([\s\S]*?)\] as const/);
  if (!block) throw new Error("ingest.ts에서 TREASURY_SOURCE_IDS를 찾지 못했다");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
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

  it("재무부 지표는 유동성 묶음에 있고, 링크는 Fiscal Data 페이지다", () => {
    for (const key of ["tsy_bill_share", "tsy_coupon_share", "auction10y_btc", "auction10y_yield"]) {
      const i = findIndicator(key);
      expect(i?.group, key).toBe("liquidity");
      expect(i?.url, key).toMatch(/^https:\/\/fiscaldata\.treasury\.gov\//);
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
