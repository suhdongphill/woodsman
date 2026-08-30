import { describe, expect, it } from "vitest";
import { nextAvailableSlug, slugify } from "./slug";

describe("slugify", () => {
  it("한글 제목에서 영문 키워드 주소를 만든다", () => {
    expect(slugify("금리는 오르는데, 비트코인은 왜 오르는 것일까?", 2026)).toBe(
      "rate-bitcoin-2026",
    );
    expect(slugify("반도체는 내리는데 비트코인만 오릅니다.", 2026)).toBe(
      "semiconductor-bitcoin-2026",
    );
  });

  it("영문·티커·숫자는 그대로 살린다", () => {
    expect(slugify("NVDA 실적 분석", 2026)).toBe("nvda-earnings-analysis-2026");
  });

  it("제목에 연도가 있으면 그 연도를 쓴다 — 넘겨받은 연도가 아니라", () => {
    expect(slugify("2025년 금리 전망", 2026)).toBe("rate-outlook-2025");
  });

  it("긴 단어가 먼저 걸린다 — 기준금리가 금리로 잘리지 않는다", () => {
    expect(slugify("기준금리 동결", 2026)).toBe("policy-rate-hold-2026");
  });

  it("같은 키워드가 두 번 나와도 한 번만 넣는다", () => {
    expect(slugify("금리, 금리, 그리고 금리 인하", 2026)).toBe("rate-cut-2026");
  });

  it("토막은 연도 포함 5개를 넘지 않는다", () => {
    const s = slugify("미국 금리 인하와 반도체 성장주 포트폴리오 리밸런싱 전략", 2026);
    expect(s.split("-").length).toBeLessThanOrEqual(6); // 하이픈 포함 키워드가 있어 여유를 둔다
    expect(s.endsWith("-2026")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(80);
  });

  it("사전에 하나도 안 걸리면 로마자로 떨어진다", () => {
    const s = slugify("아버지가 방에 들어가신다", 2026);
    expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(s.endsWith("-2026")).toBe(true);
  });

  it("⚠ 빈 주소를 돌려주지 않는다 — 저장이 막히고 이유도 안 보인다", () => {
    expect(slugify("", 2026)).toBe("insight-2026");
    expect(slugify("!!! ??? ...", 2026)).toBe("insight-2026");
    expect(slugify("2026", 2026)).toBe("insight-2026");
  });

  it("결과는 언제나 저장 규칙(영문 소문자·숫자·하이픈)을 만족한다", () => {
    for (const title of ["금리 인하", "NVDA 2026 실적", "가나다라", "  ", "A/B 테스트!!"]) {
      expect(slugify(title, 2026), title).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe("nextAvailableSlug", () => {
  it("비어 있으면 그대로 쓴다", () => {
    expect(nextAvailableSlug("rate-2026", [])).toBe("rate-2026");
    expect(nextAvailableSlug("rate-2026", ["other"])).toBe("rate-2026");
  });

  it("이미 쓰이면 비켜 간다 — 막지 않는다", () => {
    expect(nextAvailableSlug("rate-2026", ["rate-2026"])).toBe("rate-2026-2");
    expect(nextAvailableSlug("rate-2026", ["rate-2026", "rate-2026-2"])).toBe("rate-2026-3");
  });
});
