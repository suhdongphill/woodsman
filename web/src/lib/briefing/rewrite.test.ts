import { describe, expect, it } from "vitest";
import type { BriefingArticle } from "./article";
import {
  applyRewrite,
  buildRewritePrompt,
  editableItems,
  introducedNumbers,
  judgeEdit,
  parseRewriteResponse,
} from "./rewrite";

const article: BriefingArticle = {
  date: "2026-10-31",
  headline: "반도체는 공급 병목에 값이 깎였습니다.",
  summary: ["인텔이 전망을 낮추자 반도체 지수가 8% 빠졌습니다."],
  basis: [],
  sections: [
    {
      title: "반도체 급락",
      blocks: [
        { t: "p", text: "주가는 92.07 → 65.76달러(−28.58%)로 마감했습니다." },
        { t: "src", items: ["NBC·IBD(10/30)"] },
        { t: "watch", text: "11/2(월) SOX가 11,131.28을 되찾는지입니다." },
      ],
    },
  ],
  sources: [],
  notices: [],
};

describe("다듬을 문장", () => {
  it("제목·리드·문단·확인할 것만 — 출처·표는 넘기지 않는다", () => {
    expect(editableItems(article).map((i) => i.id)).toEqual(["headline", "sum0", "s0.title", "s0.b0", "s0.b2"]);
    expect(buildRewritePrompt(editableItems(article))).not.toContain("NBC");
  });
});

describe("⚠ 숫자 대조", () => {
  it("원문에 없는 숫자를 잡는다 — 반올림도", () => {
    expect(introducedNumbers("92.07 → 65.76달러", "92.1 → 65.76달러")).toEqual(["92.1"]);
    expect(introducedNumbers("11,131.28을", "11131.28을")).toEqual([]);
  });

  it("숫자를 빼는 것은 길이로 본다", () => {
    expect(judgeEdit("주가는 92.07 → 65.76달러(−28.58%)로 마감했습니다.", "떨어졌습니다.")).toMatch(/길이/);
  });

  it("「미확인」을 지우면 거부", () => {
    expect(judgeEdit("서한을 보냈다는 보도도 나왔습니다. (미확인)", "서한을 보냈다는 보도가 나왔습니다.")).toMatch(/미확인/);
  });

  it("SNS 흔적이 생기면 거부", () => {
    expect(judgeEdit("반도체 지수가 빠졌습니다.", "반도체 지수가 빠졌습니다(t.me/chan).")).toMatch(/SNS/);
  });
});

describe("되꽂기", () => {
  it("통과한 것만 바꾸고, 걸린 것·빠진 것은 원문을 쓰고 이유를 남긴다", () => {
    const { article: next, accepted, rejected } = applyRewrite(article, {
      headline: "반도체, 공급 병목에 값이 깎였다",
      sum0: "인텔이 전망을 낮추자 반도체 지수가 9% 빠졌습니다.", // 숫자 바뀜
      "s0.title": "반도체 급락",
      "s0.b0": "인텔 주가는 92.07달러에서 65.76달러로 28.58% 내린 채 마감했습니다.",
    });
    expect(next.headline).toBe("반도체, 공급 병목에 값이 깎였다");
    expect(next.summary[0]).toBe(article.summary[0]);
    expect(next.sections[0].blocks[2]).toEqual(article.sections[0].blocks[2]);
    expect(accepted).toBe(3);
    expect(rejected.map((r) => r.id)).toEqual(["sum0", "s0.b2"]);
    expect(article.headline).toBe("반도체는 공급 병목에 값이 깎였습니다."); // 원본은 그대로
  });

  it("코드 블록에 싸여 와도 읽는다 · 못 읽으면 null", () => {
    expect(parseRewriteResponse('```json\n{"headline":"a"}\n```')).toEqual({ headline: "a" });
    expect(parseRewriteResponse("죄송합니다")).toBeNull();
  });
});
