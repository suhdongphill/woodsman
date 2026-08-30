import { describe, expect, it } from "vitest";
import { HOME_BLOCKS, hasBlock, visibleHomeBlocks } from "./home-layout";

const full = { hasAccountCurve: true, homePostCount: 3 };

describe("홈 블록", () => {
  it("다 있으면 정의된 순서 그대로 전부 그린다", () => {
    expect(visibleHomeBlocks(full)).toEqual([...HOME_BLOCKS]);
  });

  it("⚠ 순서가 곧 화면이다 — 조건부 블록을 빼도 나머지 순서는 그대로다", () => {
    const blocks = visibleHomeBlocks({ hasAccountCurve: false, homePostCount: 0 });
    expect(blocks).toEqual(["hero", "macro", "principles", "latestInsights", "journalAndReports"]);
  });

  it("계좌 스냅숏이 없으면 자금 흐름을 빼다 — 0원짜리 차트를 그리지 않는다", () => {
    expect(visibleHomeBlocks({ ...full, hasAccountCurve: false })).not.toContain("capitalFlow");
  });

  it("홈에 쌓인 글이 없으면 그 프레임을 뺀다", () => {
    expect(visibleHomeBlocks({ ...full, homePostCount: 0 })).not.toContain("homePosts");
  });

  it("⚠ 값이 없어도 남는 블록들 — 자기 자리에서 '아직 없다'고 말해야 하는 자리다", () => {
    const blocks = visibleHomeBlocks({ hasAccountCurve: false, homePostCount: 0 });
    for (const kept of ["hero", "macro", "principles", "latestInsights", "journalAndReports"]) {
      expect(blocks, kept).toContain(kept);
    }
  });

  it("hasBlock은 목록을 그대로 읽는다", () => {
    const blocks = visibleHomeBlocks(full);
    expect(hasBlock(blocks, "macro")).toBe(true);
    expect(hasBlock(visibleHomeBlocks({ ...full, homePostCount: 0 }), "homePosts")).toBe(false);
  });
});
