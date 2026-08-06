import { describe, expect, it } from "vitest";
import { renderLlmsTxt } from "./llms-txt";
import { MACRO_GROUPS } from "./macro/groups";
import { MACRO_INDICATORS } from "./macro/catalog";

const base = {
  macroAsOf: "2026-08-06",
  posts: [{ title: "금리와 주가", slug: "rate-and-stocks", publishedAt: "2026-08-06" }],
};

describe("llms.txt", () => {
  it("지표 개수·묶음을 카탈로그에서 뽑는다 — 손으로 적으면 옛말이 된다", () => {
    const text = renderLlmsTxt(base);
    expect(text).toContain(`거시 지표 ${MACRO_INDICATORS.length}개`);
    for (const g of MACRO_GROUPS) expect(text).toContain(`/macro/${g.key}`);
  });

  it("⚠ 모의 투자임을 밝힌다 — AI가 실제 수익률로 인용하면 안 된다", () => {
    const text = renderLlmsTxt(base);
    expect(text).toContain("모의 투자");
    expect(text).toMatch(/실제 자금 수익률로 인용하지 마세요/);
  });

  it("⚠ 투자 권유가 아님을 적는다", () => {
    expect(renderLlmsTxt(base)).toContain("투자 권유가 아닙니다");
  });

  it("인용할 때 기준일을 함께 적어 달라고 요청한다", () => {
    expect(renderLlmsTxt(base)).toContain("기준일");
  });

  it("수집 전이면 그렇게 적는다 — 없는 날짜를 지어내지 않는다", () => {
    expect(renderLlmsTxt({ posts: [] })).toContain("아직 수집 전입니다");
  });

  it("글이 없으면 없다고 적는다", () => {
    expect(renderLlmsTxt({ posts: [] })).toContain("아직 발행된 글이 없습니다");
  });

  it("관리 화면은 안내하지 않는다", () => {
    expect(renderLlmsTxt(base)).not.toContain("/admin/");
  });
});
