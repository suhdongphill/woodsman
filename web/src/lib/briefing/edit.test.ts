import { describe, expect, it } from "vitest";
import type { BriefingArticle } from "./article";
import { applyHumanEdit, editorAfterHumanEdit, parseEditedArticle } from "./edit";

const stored: BriefingArticle = {
  date: "2026-11-07",
  headline: "고용이 금리 경로를 되돌렸습니다.",
  summary: ["첫째 줄 8%", "둘째 줄"],
  basis: ["기준 시각 07:00"],
  sections: [
    {
      title: "금리",
      blocks: [
        { t: "p", text: "금리는 3.88%입니다." },
        { t: "table", head: ["지표", "값"], rows: [["DFF", "3.88"]] },
        { t: "ul", items: ["가", "나"] },
      ],
    },
  ],
  closing: "맺음",
  sources: ["FRED"],
  notices: ["AI 활용 고지", "투자 유의사항"],
};

const clone = () => JSON.parse(JSON.stringify(stored)) as BriefingArticle;

describe("applyHumanEdit", () => {
  it("고치지 않으면 changed가 false이고 새 숫자가 없다", () => {
    expect(applyHumanEdit(stored, clone())).toMatchObject({ ok: true, changed: false, newNumbers: [] });
  });

  it("문장을 고치면 저장본에 반영되고 원본은 그대로다", () => {
    const e = clone();
    e.headline = "  새 제목  ";
    const r = applyHumanEdit(stored, e);
    if (!r.ok) throw new Error("통과해야 한다");
    expect(r.article.headline).toBe("새 제목");
    expect(r.changed).toBe(true);
    expect(stored.headline).toBe("고용이 금리 경로를 되돌렸습니다.");
  });

  it("⚠ 요청에 실려 온 날짜와 고지는 받지 않는다", () => {
    const r = applyHumanEdit(stored, { ...clone(), date: "2020-01-01", notices: [] } as BriefingArticle);
    if (!r.ok) throw new Error("통과해야 한다");
    expect(r.article.date).toBe("2026-11-07");
    expect(r.article.notices).toEqual(stored.notices);
  });

  it("⚠ SNS 흔적이 생기면 저장하지 않는다", () => {
    const e = clone();
    e.sections[0].blocks[0] = { t: "p", text: "텔레그램에서 본 내용 t.me/abc" };
    expect(applyHumanEdit(stored, e).ok).toBe(false);
  });

  it("제목을 비우면 저장하지 않는다", () => {
    const e = clone();
    e.headline = "   ";
    expect(applyHumanEdit(stored, e).ok).toBe(false);
  });

  it("본문 절을 모두 비우면 저장하지 않는다", () => {
    const e = clone();
    e.sections = [{ title: " ", blocks: [{ t: "p", text: "" }] }];
    expect(applyHumanEdit(stored, e).ok).toBe(false);
  });

  it("내용이 남았는데 절 제목만 비면 저장하지 않는다", () => {
    const e = clone();
    e.sections[0].title = "";
    const r = applyHumanEdit(stored, e);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toContain("제목이 빈 절");
  });

  it("빈 문단·빈 목록 항목·빈 표 행을 뺀다", () => {
    const e = clone();
    e.sections[0].blocks = [
      { t: "p", text: "  " },
      { t: "ul", items: ["가", " "] },
      { t: "table", head: ["지표", "값"], rows: [["", " "], ["DFF", "3.88"]] },
    ];
    const r = applyHumanEdit(stored, e);
    if (!r.ok) throw new Error("통과해야 한다");
    expect(r.article.sections[0].blocks).toEqual([
      { t: "ul", items: ["가"] },
      { t: "table", head: ["지표", "값"], rows: [["DFF", "3.88"]] },
    ]);
  });

  it("맺음을 비우면 칸 자체가 없어진다", () => {
    const e = clone();
    e.closing = " ";
    const r = applyHumanEdit(stored, e);
    if (!r.ok) throw new Error("통과해야 한다");
    expect("closing" in r.article).toBe(false);
  });

  it("⚠ 숫자를 고치는 건 막지 않되 새 숫자를 알린다", () => {
    const e = clone();
    e.sections[0].blocks[0] = { t: "p", text: "금리는 4.12%입니다." };
    const r = applyHumanEdit(stored, e);
    if (!r.ok) throw new Error("통과해야 한다");
    expect(r.newNumbers).toEqual(["4.12"]);
  });
});

describe("parseEditedArticle", () => {
  it("저장된 꼴을 그대로 읽는다", () => {
    const parsed = parseEditedArticle(JSON.stringify(stored));
    expect(parsed?.headline).toBe(stored.headline);
    expect(parsed?.sections).toEqual(stored.sections);
  });

  it("고지와 날짜는 읽어 들이지 않는다", () => {
    const parsed = parseEditedArticle(JSON.stringify(stored));
    expect(parsed && "notices" in parsed).toBe(false);
    expect(parsed && "date" in parsed).toBe(false);
  });

  it.each([
    ["JSON이 아님", "{"],
    ["배열", "[]"],
    ["제목이 문자가 아님", JSON.stringify({ ...stored, headline: 1 })],
    ["모르는 블록", JSON.stringify({ ...stored, sections: [{ title: "a", blocks: [{ t: "html", text: "x" }] }] })],
    ["표 행 꼴이 틀림", JSON.stringify({ ...stored, sections: [{ title: "a", blocks: [{ t: "table", head: [], rows: ["x"] }] }] })],
  ])("모양이 다르면 null — %s", (_name, json) => {
    expect(parseEditedArticle(json)).toBeNull();
  });
});

describe("editorAfterHumanEdit", () => {
  it("한 번만 붙는다", () => {
    expect(editorAfterHumanEdit("ai:claude-sonnet-5")).toBe("ai:claude-sonnet-5+사람");
    expect(editorAfterHumanEdit("ai:claude-sonnet-5+사람")).toBe("ai:claude-sonnet-5+사람");
    expect(editorAfterHumanEdit("rules")).toBe("rules+사람");
  });
});
