import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COVERAGE_LABEL, coverageText } from "./public-terms";
import { buildGcrmFrame } from "./gcrm/home-frame";

/** 주석을 지운 소스 — 주석의 「커버리지」(설계 설명)는 화면에 나가지 않는다 */
function codeOnly(rel: string): string {
  const src = readFileSync(join(__dirname, "..", rel), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
}

describe("공개 화면 용어 — 「커버리지」 대신 「반영률」(2026-11-15)", () => {
  it("문구는 한 곳에서 나온다", () => {
    expect(COVERAGE_LABEL).toBe("반영률");
    expect(coverageText(70.6)).toBe("반영률 71%");
  });

  it("⚠ 홈에 그리는 파일과 홈 문구를 만드는 모듈에 「커버리지」 글자가 없다", () => {
    // 이 목록은 2026-11-15 운영 홈 HTML에서 「커버리지」가 나온 출처 전부다(칩 · 자료 부족 사유 · 조류 카드 머리줄 · 유동성 대화창 사유)
    for (const f of [
      "features/home/ui/CapitalRegimeFrame.tsx",
      "features/home/ui/TideSection.tsx",
      "features/home/ui/LiquidityDialog.tsx",
      "lib/gcrm/home-frame.ts",
      "lib/scores/engine.ts",
    ]) {
      expect(codeOnly(f), f).not.toMatch(/커버리지/);
    }
  });

  it("자료 부족 칩은 반영률로 이유를 적는다", () => {
    const f = buildGcrmFrame({
      asOf: "2026-11-15",
      regimeLabel: null,
      pillars: [{ pillar: "rate_absorption", axis: "tide", scoreRaw: null, coverage: 0.4, status: "INSUFFICIENT" }],
    });
    const chip = f.chips.find((c) => c.scoreKey === "rate_absorption");
    expect(chip?.pendingReason).toBe("자료 부족 · 반영률 40%");
  });
});
