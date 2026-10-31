import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_NOTICE,
  articleProblems,
  articleText,
  briefingHtmlToMarkdown,
  dateFromFileName,
  filterParagraph,
  journalize,
  parseBriefingMarkdown,
  snsResidue,
} from "./article";

/**
 * ⚠ 2026-10-31 정기분의 **가명 사본**이다 — 채널 이름·주소·계정만 바꿨다(공개 저장소라 원문을 싣지 않는다).
 *   구조·숫자·문장은 원고 그대로다.
 */
const FIX = join(__dirname, "__fixtures__");
const md = readFileSync(join(FIX, "2026-10-31.md"), "utf8");
const a = parseBriefingMarkdown(md, "2026-10-31");
const text = articleText(a);

describe("SNS 출처를 지운다 (운영자 10/31 「공식적인 출처만」)", () => {
  it("텔레그램·X 주소와 채널 글 번호가 하나도 남지 않는다", () => {
    expect(snsResidue(a)).toEqual([]);
    for (const s of ["t.me/", "x.com/", "#4034", "@example", "채널"]) {
      expect(JSON.stringify(a)).not.toContain(s);
    }
  });

  it("출처가 SNS뿐인 문장은 빼고, 공식 출처가 붙은 문장은 남긴다", () => {
    expect(text).not.toContain("DRAM 4분기 PC 고정가"); // SK증권 텔레그램뿐
    expect(text).not.toContain("고용비용지수"); // X뿐
    expect(text).toContain("무살렘 총재도 AI 투자가"); // 같은 문단의 X 문장만 빠졌다
  });

  it("머리말만 남은 문단(「반박 단서입니다.」)은 통째로 뺀다", () => {
    expect(filterParagraph("반박 단서입니다. 3분기 임금은 둔화했습니다 [X:@someone].")).toBeNull();
  });

  it("공식 출처는 남는다", () => {
    expect(a.sources.map((s) => s.split(" — ")[0])).toEqual(["발표", "보도", "시세·데이터"]);
    expect(text).toContain("Reuters·CNA·Newsquawk");
  });
});

describe("내부 기록은 싣지 않는다", () => {
  it("채널 평가 절과 역할 조정 제안이 없다", () => {
    expect(a.sections.map((s) => s.title).join()).not.toContain("채널 평가");
    expect(text).not.toContain("글의 품질을 지켜봅니다");
    expect(text).not.toContain("핵심 전달 일수");
  });

  it("타당성·데스크 대조·사실 충돌·H-후보 칸이 없다", () => {
    for (const s of ["타당성", "데스크", "사실 충돌", "가설감", "H2·H3·H4"]) expect(text).not.toContain(s);
  });

  it("가설 번호는 떼고 이름만 둔다", () => {
    const h3 = a.sections.flatMap((s) => s.blocks).filter((b) => b.t === "h3");
    expect(h3.map((b) => (b.t === "h3" ? b.text : ""))).toEqual(["유가→물가→긴축", "미국채 뉴노멀"]);
  });
});

describe("기사 틀", () => {
  it("제목은 한 줄 요약, 리드는 3줄 요약", () => {
    expect(a.headline).toMatch(/^반도체는 수요가 아니라 공급 병목/);
    expect(a.summary).toHaveLength(3);
  });

  it("절 번호를 떼고, 출처는 절 끝에 한 묶음", () => {
    expect(a.sections[0].title).toBe("반도체 급락 — 수요가 아니라 공급 병목이 값을 깎았다");
    const blocks = a.sections[0].blocks;
    expect(blocks.at(-1)?.t).toBe("src");
    expect(blocks.filter((b) => b.t === "src")).toHaveLength(1);
  });

  it("[사실]·[해석]·(2차)는 지우고 [미확인]은 남긴다 — 확인 안 된 것을 사실처럼 쓰지 않는다", () => {
    expect(text).not.toMatch(/\[(사실|해석|미확인)\]|\(2차\)/);
    expect(text).toContain("(미확인)");
  });

  it("⚠ AI 활용 고지는 남긴다(문구만 공개용)", () => {
    expect(a.notices[0]).toBe(AI_NOTICE);
    expect(a.notices[1]).toMatch(/^투자 유의사항/);
  });

  it("기준 시각 안내에는 수집 건수·내부 파일 이름이 없다", () => {
    expect(a.basis[0]).toBe("기준일 2026년 10월 31일(토) 07:40(한국시각) · 기간 10-30 07:40 ~ 10-31 07:40 KST");
    expect(a.basis.join()).not.toMatch(/TG|raw\.md|채널/);
  });

  it("숫자는 원고 그대로다", () => {
    for (const n of ["92.07 → 65.76달러(−28.58%)", "117.64달러", "4.98% → 4.94%", "11,131.28"]) expect(text).toContain(n);
  });

  it("문제 없음", () => {
    expect(articleProblems(a)).toEqual([]);
  });
});

describe("기자 표기", () => {
  it("꼬리표를 괄호 출처로", () => {
    expect(journalize("낮다고 봤습니다 [발표:댈러스 연은]. [사실]")).toBe("낮다고 봤습니다(댈러스 연은).");
  });
});

describe("HTML 원고도 같은 규칙으로", () => {
  /** 티스토리용 완성본의 꼴(소제목이 굵은 문단, 울타리 블록 없음)을 줄인 합성 예시. */
  const html = `<p>WOODSMAN · MORNING BRIEF · 2026.10.31</p>
<p>기준일 2026년 10월 31일(토) 07:40(한국시각) · 기간 10-30 07:40 ~ 10-31 07:40 KST · TG 207건</p>
<p><b>한 줄 요약</b></p><p>반도체는 공급 병목에 값이 깎였습니다.</p>
<p><b>3줄 요약</b></p><p>1. 인텔이 전망을 낮췄습니다.</p><p>2. 유가가 올랐습니다.</p>
<h2>1. 반도체 급락 — 공급 병목</h2>
<p><b>핵심</b></p><p>주가는 92.07 → 65.76달러로 마감했습니다. [사실](2차)</p>
<p>[뉴스:NBC·IBD](인텔, 10/30)</p><p>(채널가 #4034, 10-30 10:47 KST, https://t.me/example/4034)</p>
<p><b>타당성 · 높음</b></p><p>보도 여러 곳이 일치합니다.</p>
<p><b>확인할 것</b></p><p>SOX가 11,131.28을 되찾는지입니다.</p>
<h2>5. 채널 평가 — 주간 성적표</h2><p>오늘 핵심은 채널가가 전했습니다.</p>
<h2>출처</h2><p>보도 — [뉴스:NBC·IBD](인텔, 10/30)</p><p>텔레그램 — 채널가 #4034</p>`;
  const h = parseBriefingMarkdown(briefingHtmlToMarkdown(html), "2026-10-31");

  it("제목·리드·절을 알아보고 SNS·내부 칸·채널 평가를 지운다", () => {
    expect(h.headline).toBe("반도체는 공급 병목에 값이 깎였습니다.");
    expect(h.summary).toEqual(["인텔이 전망을 낮췄습니다.", "유가가 올랐습니다."]);
    expect(h.sections.map((s) => s.title)).toEqual(["반도체 급락 — 공급 병목"]);
    expect(h.sections[0].blocks.map((b) => b.t)).toEqual(["p", "watch", "src"]);
    expect(h.sources).toEqual(["보도 — NBC·IBD(인텔, 10/30)"]);
    expect(h.basis[0]).not.toContain("TG");
    expect(articleProblems(h)).toEqual([]);
  });
});

describe("관문", () => {
  it("비었거나 SNS가 남으면 문제를 말한다", () => {
    const bad = { ...a, headline: "", sections: [{ title: "x", blocks: [{ t: "p" as const, text: "https://t.me/a/1" }] }] };
    const p = articleProblems(bad);
    expect(p.join()).toContain("제목");
    expect(p.join()).toContain("SNS");
  });

  it("파일 이름에서 날짜", () => {
    expect(dateFromFileName("2026-10-31.md")).toBe("2026-10-31");
    expect(dateFromFileName("brief.md")).toBeNull();
  });
});
