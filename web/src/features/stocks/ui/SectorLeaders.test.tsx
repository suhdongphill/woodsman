import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SectorStrength } from "@/lib/sector-strength";
import { SectorLeaders } from "./SectorLeaders";

const ITEM = {
  key: "xlk",
  name: "기술",
  position: 88,
  relative: 4.2,
  changePct: 21.5,
  leading: true,
  asOf: "2026-11-06",
} as unknown as SectorStrength;

describe("SectorLeaders", () => {
  it("시장 전체 표임을 밝히고 같은 화면의 AI 판정으로 잇는다", () => {
    const html = renderToStaticMarkup(<SectorLeaders items={[ITEM]} />);
    expect(html).toContain("시장 전체");
    expect(html).toContain('href="#ai-ecosystem"');
    expect(html).toContain("2026-11-06");
  });

  it("⚠ 「없음」과 「못 읽음」을 가르고, 내부 안내를 내지 않는다", () => {
    const empty = renderToStaticMarkup(<SectorLeaders items={[]} />);
    const failed = renderToStaticMarkup(<SectorLeaders items={[]} failed />);
    expect(empty).toContain("아직 섹터 시세가 없습니다");
    expect(failed).toContain("불러오지 못했습니다");
    expect(empty + failed).not.toContain("관리자");
  });
});
