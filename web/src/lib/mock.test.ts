import { describe, expect, it } from "vitest";
import * as mock from "./mock";
import { aiProviders, getStock, mockSeries } from "./mock";

describe("대표 포트폴리오는 목업에서 내려왔다", () => {
  it("⚠ 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 관리자 편집이 무효가 된다", () => {
    // 2026-08-06: 대표 포트폴리오·리밸런싱은 D1로 옮겼다(features/portfolio/repository.ts).
    // 시드 데이터는 lib/seed-data.ts에 있다. 여기에 되살리면 같은 사고가 반복된다.
    expect("modelHoldings" in mock).toBe(false);
    expect("rebalances" in mock).toBe(false);
    expect("functionAllocation" in mock).toBe(false);
  });
});

describe("콘텐츠도 목업에서 내려왔다", () => {
  it("⚠ 글 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 편집이 무효가 된다", () => {
    // 2026-08-06: Post는 D1로 옮겼다(features/posts/repository.ts).
    expect("posts" in mock).toBe(false);
    expect("users" in mock).toBe(false);
    expect("allPosts" in mock).toBe(false);
    expect("getPostBySlug" in mock).toBe(false);
  });
});

describe("댓글·사이트 설정도 목업에서 내려왔다", () => {
  it("⚠ 댓글 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 승인·숨김 버튼이 죽는다", () => {
    // 2026-08-07: 댓글은 D1로 옮겼다(features/comments/repository.ts).
    // 목업을 읽는 동안 /admin/comments의 버튼 3종에 onClick이 없었고,
    // 숨겼다고 믿은 댓글이 계속 노출됐다. 노출 규칙은 lib/comments.test.ts가 지킨다.
    expect("comments" in mock).toBe(false);
    expect("getCommentsByPostId" in mock).toBe(false);
  });

  it("⚠ 사이트 설정 목업을 다시 export하지 않는다 — 토글이 켜도 저장되지 않는다", () => {
    // 정책 스위치는 lib/site-settings.getSiteFlags()가 D1에서 읽는다.
    expect("siteConfig" in mock).toBe(false);
  });

  it("대시보드 요약에서 댓글 숫자를 빼 두었다(실집계로 옮김)", () => {
    expect("newComments" in mock.adminStats).toBe(false);
    expect("pendingComments" in mock.adminStats).toBe(false);
  });
});

describe("AI 제공자 목업", () => {
  it("키 '값'이 아니라 env 변수명만 저장한다", () => {
    for (const p of aiProviders) {
      expect(p.apiKeyEnv).toMatch(/^[A-Z0-9_]+$/);
      expect(JSON.stringify(p)).not.toMatch(/sk-[a-z]/i);
    }
  });

  it("무료 제공자가 유료(Anthropic)보다 우선순위가 앞선다", () => {
    const paid = aiProviders.filter((p) => !p.free).map((p) => p.priority);
    const free = aiProviders.filter((p) => p.free).map((p) => p.priority);
    expect(Math.max(...free)).toBeLessThan(Math.min(...paid));
  });
});

describe("종목 목업", () => {
  it("티커 대소문자 무관하게 조회된다", () => {
    expect(getStock("tsm")?.name).toBe("TSMC");
  });

  it("mockSeries는 결정적이다(같은 입력 → 같은 출력)", () => {
    expect(mockSeries(100, 10)).toEqual(mockSeries(100, 10));
  });
});
