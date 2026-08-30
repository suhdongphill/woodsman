import { describe, expect, it } from "vitest";
import { HOME_BLOCKS, hasBlock, visibleHomeBlocks } from "./home-layout";

describe("홈 블록", () => {
  it("글이 있으면 정의된 순서 그대로 전부 그린다", () => {
    expect(visibleHomeBlocks({ homePostCount: 3 })).toEqual([...HOME_BLOCKS]);
  });

  it("⚠ 계좌는 콘텐츠 뒤에 온다 — 입구가 아니라 증거다 (2026-08-30 Step 2)", () => {
    const blocks = visibleHomeBlocks({ homePostCount: 3 });
    expect(blocks.indexOf("accountStrip")).toBeGreaterThan(blocks.indexOf("latestInsights"));
    expect(blocks.indexOf("macro")).toBeLessThan(blocks.indexOf("accountStrip"));
  });

  it("⚠ 콘텐츠가 맨 앞이다 — 1순위 목적이 블로그 유입이다", () => {
    const blocks = visibleHomeBlocks({ homePostCount: 3 });
    expect(blocks.indexOf("latestInsights")).toBeLessThan(blocks.indexOf("macro"));
    expect(blocks.indexOf("latestInsights")).toBeLessThan(blocks.indexOf("macro"));
  });

  it("⚠ 「어떻게 기록하나요」는 맨 뒤다 — 콘텐츠가 아니라 소개글이다", () => {
    const blocks = visibleHomeBlocks({ homePostCount: 3 });
    expect(blocks[blocks.length - 1]).toBe("principles");
  });

  it("홈에 쌓인 글이 없으면 그 프레임만 뺀다", () => {
    const blocks = visibleHomeBlocks({ homePostCount: 0 });
    expect(blocks).not.toContain("homePosts");
    expect(blocks).toEqual([
      "hero",
      "macroStrip",
      "latestInsights",
      "macro",
      "accountStrip",
      "journalAndReports",
      "principles",
    ]);
  });

  it("⚠ 계좌 띠는 스냅숏이 없어도 남는다 — 없는 값을 0원으로 만들지 않고 없다고 적는다", () => {
    // 스냅숏 여부는 이제 블록의 존재를 가르지 않는다. 화면이 "아직 없다"고 말한다.
    expect(visibleHomeBlocks({ homePostCount: 0 })).toContain("accountStrip");
  });

  it("⚠ 자금 흐름 차트는 홈에 없다 — /portfolio로 옮겼다(같은 차트를 두 번 그리지 않는다)", () => {
    expect(HOME_BLOCKS).not.toContain("capitalFlow" as never);
  });

  it("⚠ 거시 스트립은 히어로 바로 다음이다 — 3초 안에 '지금 무슨 바람인가'를 준다", () => {
    const blocks = visibleHomeBlocks({ homePostCount: 3 });
    expect(blocks[1]).toBe("macroStrip");
    expect(blocks.indexOf("macroStrip")).toBeLessThan(blocks.indexOf("latestInsights"));
  });

  it("hasBlock은 목록을 그대로 읽는다", () => {
    expect(hasBlock(visibleHomeBlocks({ homePostCount: 3 }), "macro")).toBe(true);
    expect(hasBlock(visibleHomeBlocks({ homePostCount: 0 }), "homePosts")).toBe(false);
  });
});
