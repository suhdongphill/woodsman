import { describe, expect, it } from "vitest";
import {
  aiProviderCatalog,
  buildAiProviderSeeds,
  seedComments,
  seedModelHoldings,
  seedPosts,
  seedRebalances,
} from "./seed-data";

describe("대표 포트폴리오 시드", () => {
  it("목표비중 합이 정확히 100%다", () => {
    const sum = seedModelHoldings.reduce((a, h) => a + h.targetWeight, 0);
    expect(sum).toBe(100);
  });

  it("요구 종목이 지정된 기능 버킷에 들어 있다", () => {
    const byKey = Object.fromEntries(seedModelHoldings.map((h) => [h.key, h.functionType]));
    expect(byKey.TSM).toBe("GROWTH");
    expect(byKey.NVDA).toBe("GROWTH");
    expect(byKey.BRLB33).toBe("INCOME");
    expect(byKey.PFE).toBe("INCOME");
    expect(byKey["088980"]).toBe("INCOME");
    expect(byKey["069500"]).toBe("DEFENSE");
  });

  it("모든 종목이 편입 논리(thesis)와 정렬 순서를 갖는다", () => {
    for (const h of seedModelHoldings) {
      expect(h.thesis.length).toBeGreaterThan(10);
      expect(h.order).toBeGreaterThan(0);
    }
    const orders = seedModelHoldings.map((h) => h.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("리밸런싱 날짜는 YYYY-MM-DD 형식이다", () => {
    for (const r of seedRebalances) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("콘텐츠 시드", () => {
  it("slug가 고유하다", () => {
    const slugs = seedPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("직접작성·종목분석·티스토리·댓글잠금 공지 4종을 모두 포함한다", () => {
    expect(seedPosts).toHaveLength(4);
    expect(seedPosts.some((p) => p.type === "INSIGHT" && p.source === "SELF")).toBe(true);
    expect(seedPosts.some((p) => p.type === "ANALYSIS" && p.ticker)).toBe(true);
    expect(seedPosts.some((p) => p.source === "TISTORY" && p.externalUrl)).toBe(true);
    expect(seedPosts.some((p) => p.type === "NOTICE" && !p.commentsEnabled)).toBe(true);
  });

  it("티스토리 글의 원문 링크는 https다", () => {
    for (const p of seedPosts.filter((x) => x.source === "TISTORY")) {
      expect(p.externalUrl).toMatch(/^https:\/\//);
    }
  });

  it("댓글 시드는 존재하는 글을 참조한다", () => {
    const slugs = new Set(seedPosts.map((p) => p.slug));
    for (const c of seedComments) {
      expect(slugs.has(c.postSlug)).toBe(true);
    }
  });

  it("승인제 동작 확인용 PENDING 댓글이 포함된다", () => {
    expect(seedComments.some((c) => c.status === "PENDING")).toBe(true);
  });
});

describe("AI 제공자 시드", () => {
  it("카탈로그에 키 '값'이 아니라 env 변수명만 담긴다", () => {
    const serialized = JSON.stringify(aiProviderCatalog);
    expect(serialized).not.toMatch(/sk-ant-api\d/);
    expect(serialized).not.toMatch(/gsk_[A-Za-z0-9]{10,}/);
    for (const p of aiProviderCatalog) {
      expect(p.apiKeyEnv).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it("무료 제공자가 유료보다 폴백 우선순위가 앞선다", () => {
    const free = aiProviderCatalog.filter((p) => p.free).map((p) => p.priority);
    const paid = aiProviderCatalog.filter((p) => !p.free).map((p) => p.priority);
    expect(Math.max(...free)).toBeLessThan(Math.min(...paid));
  });

  it("env에 키가 있는 제공자만 활성화된다", () => {
    const seeds = buildAiProviderSeeds((name) => name === "GROQ_API_KEY");
    const enabled = seeds.filter((s) => s.enabled).map((s) => s.apiKeyEnv);
    expect(enabled).toEqual(["GROQ_API_KEY"]);
  });

  it("키가 하나도 없으면 전부 비활성으로 시드된다", () => {
    const seeds = buildAiProviderSeeds(() => false);
    expect(seeds.every((s) => !s.enabled)).toBe(true);
    expect(seeds).toHaveLength(aiProviderCatalog.length);
  });
});
