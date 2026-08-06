import { describe, expect, it } from "vitest";
import { markdownToHtml, toPlainText } from "./markdown";
import { looksDangerous, sanitizeHtml } from "./sanitize-html";

describe("마크다운 → HTML", () => {
  it("제목은 h2부터 시작한다 — h1은 페이지 제목의 자리다", () => {
    expect(markdownToHtml("# 제목")).toBe("<h2>제목</h2>");
    expect(markdownToHtml("## 소제목")).toBe("<h3>소제목</h3>");
  });

  it("문단은 빈 줄로 끊고, 이어진 줄은 한 문단으로 묶는다", () => {
    expect(markdownToHtml("첫 줄\n이어짐\n\n둘째 문단")).toBe(
      "<p>첫 줄 이어짐</p>\n<p>둘째 문단</p>",
    );
  });

  it("굵게·기울임·인라인 코드", () => {
    expect(markdownToHtml("**굵게** *기울임* `코드`")).toContain("<strong>굵게</strong>");
    expect(markdownToHtml("**굵게** *기울임* `코드`")).toContain("<em>기울임</em>");
    expect(markdownToHtml("`a*b*c`")).toContain("<code>a*b*c</code>");
  });

  it("목록은 종류가 바뀌면 새로 연다", () => {
    const html = markdownToHtml("- 하나\n- 둘\n\n1. 첫째");
    expect(html).toContain("<ul>\n<li>하나</li>\n<li>둘</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>첫째</li>\n</ol>");
  });

  it("인용·구분선·코드블록", () => {
    expect(markdownToHtml("> 인용문")).toBe("<blockquote><p>인용문</p></blockquote>");
    expect(markdownToHtml("---")).toBe("<hr />");
    expect(markdownToHtml("```\nconst a = 1 < 2;\n```")).toBe(
      "<pre><code>const a = 1 &lt; 2;</code></pre>",
    );
  });

  it("링크는 외부면 새 창 + rel을 붙인다", () => {
    const html = markdownToHtml("[글](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    // 내부 링크는 그대로 같은 창에서 연다
    expect(markdownToHtml("[포트폴리오](/portfolio)")).toContain('<a href="/portfolio">');
  });

  it("⚠ javascript: 링크는 링크로 만들지 않는다", () => {
    const html = markdownToHtml("[누르지마](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("누르지마");
  });

  it("⚠ 본문에 섞인 HTML은 글자로 바뀐다", () => {
    const html = markdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("요약은 태그를 걷어내고 길이를 자른다", () => {
    expect(toPlainText("<p>안녕 <strong>세상</strong></p>")).toBe("안녕 세상");
    expect(toPlainText("<p>가나다라마바사</p>", 3)).toBe("가나다…");
  });
});

describe("HTML 정화 (허용 목록)", () => {
  it("허용한 태그는 남긴다", () => {
    expect(sanitizeHtml("<p>글 <strong>강조</strong></p>")).toBe("<p>글 <strong>강조</strong></p>");
  });

  it("⚠ script·iframe은 내용까지 지운다", () => {
    expect(sanitizeHtml("<script>alert(1)</script><p>본문</p>")).toBe("<p>본문</p>");
    expect(sanitizeHtml("<iframe src='http://x'></iframe>")).toBe("");
  });

  it("⚠ 이벤트 핸들러와 style은 버린다", () => {
    const out = sanitizeHtml('<p onclick="alert(1)" style="color:red">글</p>');
    expect(out).toBe("<p>글</p>");
    expect(looksDangerous(out)).toBe(false);
  });

  it("⚠ javascript: 주소는 링크 속성에서 제거한다", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">누르지마</a>');
    expect(out).toBe("<a>누르지마</a>");
  });

  it("새 창 링크에는 rel을 강제한다", () => {
    const out = sanitizeHtml('<a href="https://x.com" target="_blank">밖</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("모르는 태그는 껍데기만 벗기고 글자는 남긴다", () => {
    expect(sanitizeHtml("<marquee>움직임</marquee>")).toBe("움직임");
  });

  it("이미지는 http(s)와 붙여넣은 data:image만 허용한다", () => {
    expect(sanitizeHtml('<img src="https://x/y.png" alt="그림">')).toContain('src="https://x/y.png"');
    expect(sanitizeHtml('<img src="data:image/png;base64,AAA" alt="">')).toContain("data:image/png");
    expect(sanitizeHtml('<img src="data:text/html,<script>">')).not.toContain("data:text/html");
  });

  it("빈 입력은 빈 문자열", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
