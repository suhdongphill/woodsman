import { describe, expect, it } from "vitest";
import * as mock from "./mock";
import {
  aiProviders,
  comments,
  getCommentsByPostId,
  getStock,
  mockSeries,
} from "./mock";

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
