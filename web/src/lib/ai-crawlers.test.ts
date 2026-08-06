import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, CRAWLER_DISALLOW, aiCrawlerRules } from "./ai-crawlers";

describe("AI 크롤러 정책", () => {
  it("⚠ Google-Extended를 연다 — 막으면 AI 개요에서 사라진다(2026-08-06 결정)", () => {
    const google = AI_CRAWLERS.find((c) => c.userAgent === "Google-Extended");
    expect(google).toBeTruthy();
    expect(aiCrawlerRules().find((r) => r.userAgent === "Google-Extended")?.allow).toBe("/");
  });

  it("답변에 인용하는 크롤러가 포함돼 있다 — 유입으로 이어지는 경로", () => {
    const answering = AI_CRAWLERS.filter((c) => c.purpose === "answer").map((c) => c.userAgent);
    expect(answering).toContain("OAI-SearchBot");
    expect(answering).toContain("PerplexityBot");
    expect(answering).toContain("Claude-SearchBot");
  });

  it("⚠ 크롤러에게도 관리 화면·API는 열지 않는다", () => {
    for (const rule of aiCrawlerRules()) {
      expect(rule.disallow, rule.userAgent).toContain("/admin");
      expect(rule.disallow, rule.userAgent).toContain("/api/");
      expect(rule.disallow, rule.userAgent).toContain("/login");
    }
  });

  it("차단 목록은 한 곳에서 온다 — 두 벌이면 정책이 갈린다", () => {
    for (const rule of aiCrawlerRules()) {
      expect(rule.disallow).toEqual(CRAWLER_DISALLOW);
    }
  });

  it("이름이 중복되지 않고, 모두 이유가 적혀 있다", () => {
    const names = AI_CRAWLERS.map((c) => c.userAgent);
    expect(new Set(names).size).toBe(names.length);
    for (const c of AI_CRAWLERS) {
      expect(c.note.length, c.userAgent).toBeGreaterThan(5);
      expect(c.operator.length, c.userAgent).toBeGreaterThan(1);
    }
  });
});
