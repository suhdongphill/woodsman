import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../markdown";
import { sanitizeHtml } from "../sanitize-html";
import {
  buildInsightPrompt,
  composeInsightMarkdown,
  OPERATOR_NOTE_MIN,
  verifyInsightDraft,
  type InsightInput,
} from "./draft";

const input: InsightInput = {
  today: "2026-11-14",
  news: [
    { id: "n1", source: "연준 연설", title: "Waller, The Economic Outlook", url: "https://www.federalreserve.gov/a", publishedAt: "2026-11-10T15:00:00Z" },
    { id: "n2", source: "BLS", title: "CPI for all items increases 0.4% in October", url: "https://www.bls.gov/b", publishedAt: "2026-11-10T13:30:00Z" },
  ],
  blogs: [{ entryId: 31, title: "금리 인상 사이클의 끝", summary: "연준 경로 점검", publishedAt: "2026-11-12T00:00:00Z" }],
  briefing: { date: "2026-11-14", headline: "물가 재가속 우려", summary: ["CPI 0.4%"] },
  facts: [{ id: "market_risk.tide.w4", label: "시장위험·지정학 4주 전(2026-10-17) 대비", text: "52점 → 62점(+10)" }],
};

const para = "10월 소비자물가는 한 달 사이 0.4% 올랐습니다. 노동통계국 발표입니다. 같은 주 연준 인사들은 경제 전망을 말했습니다. ".repeat(6);
const good = {
  title: "물가가 다시 오를 때 조류는 무엇을 가리키나",
  lede: "이번 주 물가 발표와 연준 연설을 조류 점수와 나란히 놓아 봅니다. 결론부터 말하면 긴장 쪽 신호가 커졌지만 국면이 바뀌었다고 보기는 이릅니다.",
  sections: [
    { heading: "이번 주 있었던 일", body: para },
    { heading: "조류(1~12개월 흐름)가 말하는 것", body: "시장위험·지정학은 4주 전 52점에서 62점으로 올라왔습니다. 점수가 높을수록 자본에 불리한 항목입니다. ".repeat(5) },
  ],
  blogIds: [31],
  newsIds: ["n1", "n2"],
};

describe("insight draft", () => {
  it("재료 안의 숫자·날짜·id만 쓴 초안은 통과 · 프롬프트에 재료가 들어간다", () => {
    expect(buildInsightPrompt(input)).toContain("[블로그 31]");
    const r = verifyInsightDraft(JSON.stringify(good), input);
    if (!r.ok) throw new Error(r.problems.join(" | "));
  });

  it("⚠ 재료에 없는 숫자 · 없는 블로그/기사 · 직접 링크 · 권유 · 내부 용어 → 실패", () => {
    const r = verifyInsightDraft(
      JSON.stringify({
        ...good,
        lede: good.lede + " 금리는 5.25%까지 갈 수 있으니 지금 매수할 때입니다. https://x.com 기둥.",
        blogIds: [99],
        newsIds: ["n9"],
      }),
      input,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.problems.join(" | ");
      for (const re of [/5\.25/, /블로그 번호: 99/, /기사 id: n9/, /링크/, /매수/, /내부 용어/]) expect(all).toMatch(re);
    }
  });

  it("발행 본문 — 운영자 문단이 짧으면 만들지 않는다 · 블로그는 /go 경유 · 작성 고지", () => {
    const r = verifyInsightDraft(JSON.stringify(good), input);
    if (!r.ok) throw new Error("fixture");
    expect(composeInsightMarkdown(r.body, input, "짧다")).toBeNull();
    const note = "나는 이번 물가 발표를 ".padEnd(OPERATOR_NOTE_MIN + 5, "가");
    const md = composeInsightMarkdown(r.body, input, note)!;
    expect(md).toContain("## Woodsman의 시각");
    expect(md).toContain("(/go/blog-31)");
    expect(md).toContain("(https://www.bls.gov/b)");
    expect(md).toContain("AI가 쓴 초안을 운영자가 편집");
  });
});


describe("발행 본문이 정화를 지나도 링크가 산다", () => {
  it("/go/blog-<번호> · 기사 원문 https · 브리핑 상대 경로", () => {
    const r = verifyInsightDraft(JSON.stringify(good), input);
    if (!r.ok) throw new Error("fixture");
    const md = composeInsightMarkdown(r.body, input, "운영자 시각 ".repeat(20))!;
    const html = sanitizeHtml(markdownToHtml(md));
    expect(html).toContain('href="/go/blog-31"');
    expect(html).toContain('href="https://www.bls.gov/b"');
    expect(html).toContain('href="/briefing/2026-11-14"');
    expect(html).toContain("Woodsman의 시각");
  });
});

describe("운영자가 고친 본문이 발행에 들어간다", () => {
  it("mainMarkdown을 주면 AI 본문 대신 그것을 쓴다", () => {
    const r = verifyInsightDraft(JSON.stringify(good), input);
    if (!r.ok) throw new Error("fixture");
    const md = composeInsightMarkdown(r.body, input, "운영자 시각 ".repeat(20), "운영자가 고친 본문입니다.")!;
    expect(md.startsWith("운영자가 고친 본문입니다.")).toBe(true);
    expect(md).not.toContain("이번 주 있었던 일");
  });
});
