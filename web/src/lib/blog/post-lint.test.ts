import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintTistoryPost } from "./post-lint";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("티스토리 글 검사 — 2026-09-27 암호화폐 글 (82 수용 기준)", () => {
  const r = lintTistoryPost(fx("post-20260927-crypto.html"));
  const rules = (id: string) => r.findings.filter((f) => f.rule === id);

  it("Farside ETH 링크 카드 — 원문 표 노출", () => {
    const card = rules("og-card-table");
    expect(card.length).toBeGreaterThan(0);
    expect(String(card[0].detail?.card)).toMatch(/Ethereum ETF Flow/);
  });

  it("설명 머리표 · 396자", () => {
    expect(rules("description-kicker")).toHaveLength(1);
    expect(rules("description-length")[0].detail?.length).toBe(396);
  });

  it("제목 71자", () => {
    expect(rules("title-length")[0].detail?.length).toBe(71);
  });

  it("파랑 rgb(5,147,211) = #0593d3 대비 약 3.0", () => {
    const blue = rules("contrast").find((f) => String(f.detail?.fg).toLowerCase() === "#0593d3");
    expect(blue).toBeDefined();
    expect(Number(blue!.detail?.ratio)).toBeGreaterThan(2.8);
    expect(Number(blue!.detail?.ratio)).toBeLessThan(3.3);
  });

  it("⚠ 오탈자 — 이 글의 **현재 판**에는 「암화화폐」「암호화쳬」가 없다(2026-09-27 확인 · 이미 고쳐진 것으로 보인다)", () => {
    expect(rules("typo")).toEqual([]);
  });
});

describe("규칙 단위", () => {
  const page = (body: string, head = "<title>짧은 제목</title>") => `<html><head>${head}</head><body><div class="tt_article_useless_p_margin">${body}</div></body></html>`;

  it("오탈자 목록 — 기본값과 사용자 정의", () => {
    const r = lintTistoryPost(page("<p>암화화폐 시장과 암호화쳬, 그리고 암화화폐</p>"));
    expect(r.findings.filter((f) => f.rule === "typo").map((f) => f.detail?.count)).toEqual([2, 1]);
    const r2 = lintTistoryPost(page("<p>스테이블코인</p>"), { typos: ["스테이블코인"] });
    expect(r2.findings.some((f) => f.rule === "typo")).toBe(true);
  });

  it("alt 빈 이미지 · 캡션 없는 이미지", () => {
    const r = lintTistoryPost(page('<figure><img src="a" alt=""></figure><figure><img src="b" alt="차트"><figcaption>그림 1</figcaption></figure><img src="c">'));
    expect(r.stats).toMatchObject({ images: 3, imagesWithoutAlt: 2, imagesWithoutCaption: 2 });
  });

  it("대비 — 인라인 배경을 따라가고, 없으면 크림색", () => {
    const r = lintTistoryPost(page('<div style="background-color:#000"><p style="color:#333">어두운 배경 위 어두운 글</p></div><p style="color:#0b6640">숲색 글</p>'));
    const c = r.findings.filter((f) => f.rule === "contrast");
    expect(c.map((f) => f.detail?.bg)).toEqual(["#000"]);
  });

  it("⚠ `background-color`를 글자색으로 읽지 않는다", () => {
    const r = lintTistoryPost(page('<p style="background-color:#ffffff">흰 상자</p>'));
    expect(r.stats.colorsChecked).toBe(0);
  });

  it("큰 글자는 3:1 이상이면 정보(info)로만", () => {
    const r = lintTistoryPost(page('<h2 style="color:#0593d3;font-size:31px">큰 제목</h2>'));
    expect(r.findings.find((f) => f.rule === "contrast")?.level).toBe("info");
  });

  it("짧은 제목·설명은 조용하다", () => {
    const r = lintTistoryPost(page("<p>본문</p>", '<title>짧은 제목</title><meta name="description" content="한 문장 요약입니다.">'));
    expect(r.findings).toEqual([]);
  });
});
