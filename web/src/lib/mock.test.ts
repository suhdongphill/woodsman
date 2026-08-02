import { describe, expect, it } from "vitest";
import {
  aiProviders,
  comments,
  functionAllocation,
  getCommentsByPostId,
  getPostById,
  getPostBySlug,
  getStock,
  mockSeries,
  modelHoldings,
  posts,
} from "./mock";

describe("대표 포트폴리오 목업", () => {
  it("공개 종목의 기능별 목표비중 합이 100%다", () => {
    const a = functionAllocation();
    expect(a.GROWTH + a.INCOME + a.DEFENSE).toBe(100);
  });

  it("모든 보유 종목은 기능 분류를 갖는다", () => {
    for (const h of modelHoldings) {
      expect(["GROWTH", "INCOME", "DEFENSE"]).toContain(h.functionType);
    }
  });

  it("성장 버킷에는 TSMC와 엔비디아가 있다", () => {
    const growth = modelHoldings.filter((h) => h.functionType === "GROWTH").map((h) => h.ticker);
    expect(growth).toContain("TSM");
    expect(growth).toContain("NVDA");
  });
});

describe("콘텐츠 목업", () => {
  it("slug가 중복되지 않는다", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slug/id로 글을 찾을 수 있다", () => {
    expect(getPostBySlug("tsmc-2nm-cycle")?.ticker).toBe("TSM");
    expect(getPostById("p_1")?.type).toBe("INSIGHT");
    expect(getPostBySlug("없는-slug")).toBeUndefined();
  });

  it("티스토리 출처 글은 원문 링크를 갖는다", () => {
    for (const p of posts.filter((x) => x.source === "TISTORY")) {
      expect(p.externalUrl).toMatch(/^https:\/\//);
    }
  });

  it("댓글 잠금 글은 댓글 수가 0이다", () => {
    for (const p of posts.filter((x) => !x.commentsEnabled)) {
      expect(p.commentCount).toBe(0);
    }
  });
});

describe("댓글 노출 규칙", () => {
  it("VISIBLE 상태만 공개 목록에 포함된다", () => {
    const hidden = comments.filter((c) => c.status !== "VISIBLE");
    expect(hidden.length).toBeGreaterThan(0);
    for (const c of hidden) {
      expect(getCommentsByPostId(c.postId).map((x) => x.id)).not.toContain(c.id);
    }
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
