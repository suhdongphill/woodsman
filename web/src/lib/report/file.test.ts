import { describe, expect, it } from "vitest";
import {
  canonicalFor,
  guessHeadline,
  parseReportFileName,
  pickStockBlogUrl,
  reportFileProblems,
  sanitizeReportHtml,
} from "./file";

const BODY = `<div style="max-width:780px;color:#1e3a2b"><p style="color:#c0562a">CANSLIM · 기업분석 · KOSPI 000660</p>
<p style="font-weight:700">SK하이닉스 — 실적은 만점, 수급은 바닥</p><p>요약 문장이 이어지고, 표와 근거가 뒤따르는 본문입니다.</p></div>`;

describe("parseReportFileName", () => {
  it("볼트 초안 이름에서 티커와 종목명을 읽는다 — 앞자리 0을 지키고", () => {
    expect(parseReportFileName("2026-09-25_000660_SK하이닉스_CANSLIM.html")).toEqual({ ticker: "000660", name: "SK하이닉스" });
    expect(parseReportFileName("2026-09-25_JOBY_조비에비에이션_CANSLIM.html")).toEqual({ ticker: "JOBY", name: "조비에비에이션" });
  });

  it("모르면 추측하지 않는다", () => {
    expect(parseReportFileName("보고서 최종.html")).toEqual({});
  });
});

describe("sanitizeReportHtml", () => {
  it("보고서 서식(인라인 스타일)은 살린다", () => {
    const html = sanitizeReportHtml(BODY);
    expect(html).toContain("max-width:780px");
    expect(html).toContain("color:#c0562a");
  });

  it("⚠ 스크립트·이벤트·위험한 스타일은 나가지 않는다", () => {
    const html = sanitizeReportHtml(
      `<head><title>제목글자</title></head><div onclick="x()" style="position:fixed;color:red;background:url(https://evil.test/a.png)">본문</div><script>alert(1)</script><a href="javascript:x()">링크</a><iframe src="https://evil.test"></iframe>`,
    );
    expect(html).not.toMatch(/onclick|position|url\(|script|javascript|iframe|제목글자/i);
    expect(html).toContain("color:red");
    expect(html).toContain("본문");
  });

  it("⚠ 엔티티·주석으로 감춘 스타일도 받지 않는다", () => {
    const html = sanitizeReportHtml(`<div style="background:&#117;rl(x);color:blue;width:ex/**/pression(1)">a</div>`);
    expect(html).not.toMatch(/&#117|pression/);
    expect(html).toContain("color:blue");
  });
});

describe("guessHeadline", () => {
  it("머리표를 건너뛰고 제목을 고른다", () => {
    expect(guessHeadline(sanitizeReportHtml(BODY))).toBe("SK하이닉스 — 실적은 만점, 수급은 바닥");
  });
});

describe("reportFileProblems", () => {
  const ok = { ticker: "000660", name: "SK하이닉스", headline: "제목", hasStoredHtml: false };

  it("HTML이나 블로그 중 하나만 있으면 된다", () => {
    expect(reportFileProblems({ ...ok, blogUrl: "https://suhdp.tistory.com/1" })).toEqual([]);
    expect(reportFileProblems({ ...ok, html: sanitizeReportHtml(BODY) })).toEqual([]);
    expect(reportFileProblems(ok)).toHaveLength(1);
  });

  it("저장된 HTML이 있으면 링크만 고칠 수 있다", () => {
    expect(reportFileProblems({ ...ok, hasStoredHtml: true })).toEqual([]);
  });

  it("⚠ http(s) 아닌 링크와 잘못된 티커를 받지 않는다", () => {
    expect(reportFileProblems({ ...ok, blogUrl: "javascript:alert(1)" }).length).toBeGreaterThan(0);
    expect(reportFileProblems({ ...ok, ticker: "../x", blogUrl: "https://a.test" }).length).toBeGreaterThan(0);
  });

  it("본문 없는 HTML은 받지 않는다", () => {
    expect(reportFileProblems({ ...ok, html: "<div></div>" }).length).toBeGreaterThan(0);
  });
});

describe("연결 규칙", () => {
  it("⚠ 블로그에 같은 글이 있으면 canonical은 원문이다", () => {
    expect(canonicalFor("000660", "https://suhdp.tistory.com/1")).toBe("https://suhdp.tistory.com/1");
    expect(canonicalFor("000660", null)).toBe("/stocks/000660");
  });

  it("저장된 값 중 앞선 http(s) 주소만 고른다", () => {
    expect(pickStockBlogUrl(null, "javascript:x", "https://a.test", "https://b.test")).toBe("https://a.test");
    expect(pickStockBlogUrl(null, undefined)).toBeNull();
  });
});
