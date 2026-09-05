import { describe, expect, it } from "vitest";
import { buildExtractPrompt, parseExtract } from "./indicator-extract";
import { containsQuote, decodeEntities, htmlToText } from "./html-text";

const TODAY = "2026-09-05";

const PAGE = [
  "ISM 제조업 보고서",
  "The August Manufacturing PMI® registered 48.7 percent, down 0.5 percentage point from July.",
  "New Orders Index registered 51.4 percent.",
].join("\n");

function answer(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    found: true,
    value: 48.7,
    date: "2026-08-01",
    quote: "The August Manufacturing PMI® registered 48.7 percent, down 0.5 percentage point from July.",
    note: "8월 헤드라인 PMI",
    ...patch,
  });
}

describe("AI가 옮겨 적은 값을 믿기 전에", () => {
  it("본문에 실제로 있는 인용이면 후보가 된다", () => {
    const r = parseExtract(answer(), { pageText: PAGE, today: TODAY });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.point.value).toBe(48.7);
      expect(r.point.date).toBe("2026-08-01");
    }
  });

  /**
   * ⚠ 이 테스트가 이 기능의 존재 이유다. 모델이 「아는 숫자」를 쓰면 인용문도 같이 지어내는데,
   *    그 문장은 원문에 없다. 여기서 걸린다.
   */
  it("⚠ 인용문이 원문에 없으면 버린다 — 지어낸 값이 여기서 걸린다", () => {
    const r = parseExtract(
      answer({ quote: "The August Manufacturing PMI registered 52.1 percent." }),
      { pageText: PAGE, today: TODAY },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("원문에 없습니다");
  });

  /** ⚠ 본문의 아무 문장이나 옮겨 놓고 값만 바꾸는 경로도 막는다. */
  it("⚠ 인용문에 그 숫자가 없으면 버린다", () => {
    const r = parseExtract(
      answer({ value: 52.1, quote: "New Orders Index registered 51.4 percent." }),
      { pageText: PAGE, today: TODAY },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("숫자");
  });

  /** ⚠ 「못 찾았다」는 실패가 아니라 정답이다. 그 길을 막으면 모델은 반드시 지어낸다. */
  it("⚠ 못 찾았다는 답을 그대로 받는다", () => {
    const r = parseExtract(JSON.stringify({ found: false, note: "본문에 8월 수치가 없음" }), {
      pageText: PAGE,
      today: TODAY,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("찾지 못했습니다");
  });

  it("미래 날짜와 형식이 틀린 날짜를 거른다", () => {
    for (const date of ["2027-01-01", "2026년 8월", ""]) {
      const r = parseExtract(answer({ date }), { pageText: PAGE, today: TODAY });
      expect(r.ok, date).toBe(false);
    }
  });

  /** ⚠ 페이지가 옛 발표를 그대로 걸어 두는 일이 흔하다. 사람이 보라고 알린다. */
  it("⚠ 기준일이 너무 오래됐으면 후보로 올리지 않는다", () => {
    const r = parseExtract(answer({ date: "2024-01-01" }), { pageText: PAGE, today: TODAY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("일 전입니다");
  });

  it("값이 숫자가 아니면 버린다", () => {
    expect(parseExtract(answer({ value: "약 48" }), { pageText: PAGE, today: TODAY }).ok).toBe(false);
  });

  it("JSON이 아니면 이유를 남긴다", () => {
    const r = parseExtract("본문에서 찾지 못했습니다.", { pageText: PAGE, today: TODAY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("JSON");
  });

  it("코드 펜스로 감싸 와도 읽는다", () => {
    const r = parseExtract("```json\n" + answer() + "\n```", { pageText: PAGE, today: TODAY });
    expect(r.ok).toBe(true);
  });

  /** ⚠ 모델이 「본문 밖 지식을 쓰지 말라」는 지시를 반드시 받게 한다. */
  it("⚠ 지시문이 본문만 쓰라고 말하고, 본문을 함께 보낸다", () => {
    const prompt = buildExtractPrompt({
      indicatorName: "ISM 제조업 PMI",
      unit: "",
      what: "제조업 구매 담당자 서베이",
      url: "https://example.com/report",
      pageText: PAGE,
      today: TODAY,
    });
    expect(prompt).toContain("본문에 적힌 것만");
    expect(prompt).toContain("48.7");
    expect(prompt).toContain("https://example.com/report");
  });
});

describe("본문 만들기", () => {
  it("스크립트·스타일은 통째로 버린다 — 태그만 지우면 코드가 글로 남는다", () => {
    const html = "<div>값 48.7</div><script>var x = '숨은 코드';</script><style>.a{color:red}</style>";
    const text = htmlToText(html);
    expect(text).toContain("값 48.7");
    expect(text).not.toContain("숨은 코드");
    expect(text).not.toContain("color");
  });

  it("블록 태그는 줄바꿈이 된다 — 표가 한 줄로 뭉치지 않게", () => {
    expect(htmlToText("<tr><td>8월</td></tr><tr><td>48.7</td></tr>")).toBe("8월\n48.7");
  });

  it("엔티티를 되돌린다", () => {
    expect(decodeEntities("PMI&nbsp;48.7&amp;49")).toBe("PMI 48.7&49");
  });

  it("길이를 자른다", () => {
    expect(htmlToText("<p>" + "가".repeat(500) + "</p>", 100)).toHaveLength(100);
  });

  it("인용 대조는 공백 차이만 봐준다", () => {
    expect(containsQuote("PMI   registered\n48.7 percent", "PMI registered 48.7 percent")).toBe(true);
    expect(containsQuote("PMI registered 48.7 percent", "PMI registered 48.8 percent")).toBe(false);
    // ⚠ 너무 짧은 인용은 우연히 맞는다. 근거로 치지 않는다.
    expect(containsQuote("PMI 48.7", "48.7")).toBe(false);
  });
});
