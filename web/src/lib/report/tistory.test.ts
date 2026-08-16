import { describe, expect, it } from "vitest";
import { TISTORY_DISCLAIMER, inlineBodyHtml, renderTistoryHtml } from "./tistory";
import { markdownToHtml } from "../markdown";
import { sanitizeHtml } from "../sanitize-html";
import type { TistoryExportInput } from "./tistory";
import type { ReportContextSnapshot } from "./context";

const SITE = "https://portfolio-solutions.net";

/** 실제 저장 경로와 같게 만든다 — 원본 → markdown → sanitize → bodyHtml. */
function bodyHtml(markdown: string): string {
  return sanitizeHtml(markdownToHtml(markdown));
}

const SNAPSHOT: ReportContextSnapshot = {
  capturedAt: "2026-08-16",
  macro: {
    level: "caution",
    label: "경계",
    line: "경고가 2개입니다.",
    alerts: 2,
    watches: 1,
    unknowns: 1,
    total: 5,
    asOf: "2026-08-14",
    fed: { bias: "hawkish", biasLabel: "매파(인상 편향)", hike: 0.28, hold: 0.69, cut: 0.03 },
  },
  bubble: {
    score: 54.3,
    regime: "경계",
    stance: "신규 확대 보류",
    scored: 28,
    total: 30,
    priorityFired: false,
    firedTriggerKeys: ["trg5"],
  },
  holding: { inPortfolio: true, functionType: "GROWTH", targetWeight: 20 },
};

function input(overrides: Partial<TistoryExportInput> = {}): TistoryExportInput {
  const base: TistoryExportInput = {
    siteUrl: SITE,
    today: "2026-08-16",
    snapshot: SNAPSHOT,
    report: {
      ticker: "TSM",
      name: "TSMC",
      market: "US",
      industry: "반도체 파운드리",
      status: "PUBLISHED",
      version: 2,
      publishedAt: "2026-08-16T12:00:00.000Z",
      headline: "단일 공정 세대에 올라탄 깊은 해자",
      verdictStructural: "구조적 우위",
      verdictShort: "단기 과열",
      revokeIf: "선단공정 점유율이 2분기 연속 하락하면 이 판정을 접는다",
      nextCheckAt: "2026-11-01",
      valuationLimitation: "PBR은 수주 모멘텀 기업에 본질적 한계가 있습니다.",
      consensusTarget: {
        value: 285,
        currency: "USD",
        source: "18개사 컨센서스 · Investing.com 집계",
        asOf: "2026-08-10",
      },
      blocks: [
        {
          sectionKey: "summary",
          body: "결론 문단",
          tag: "confirmed",
          source: "DART 감사보고서",
          sourceUrl: "/macro",
          asOf: "2026-08-01",
        },
        {
          sectionKey: "flow",
          body: "",
          tag: "na",
          lookupHint: "KRX 정보데이터시스템 · 투자자별 매매동향",
        },
      ],
      checklist: [{ item: "선단공정 점유율", source: "TrendForce", impact: "해자 판정" }],
      html: new Map([
        ["summary", bodyHtml("**깊은 해자**다.\n\n자세한 것은 [거시 지표](/macro)에서 본다.")],
        ["flow", ""],
      ]),
      readings: new Map([
        ["C", { key: "C", points: 8, tag: "confirmed", evidence: "분기 EPS +42% YoY" }],
        ["M", { key: "M", tag: "na", evidence: "침체 신호 종합 경계" }],
      ]),
    },
    ...overrides,
  } as TistoryExportInput;

  return base;
}

describe("inlineBodyHtml — ⚠ 티스토리는 우리 CSS를 안 받는다", () => {
  it("여는 태그마다 style을 박는다", () => {
    const out = inlineBodyHtml("<p>가나다</p>", SITE);
    expect(out).toMatch(/<p style="[^"]*line-height/);
  });

  it("⚠ 내부 링크를 절대경로로 바꾼다 — 안 바꾸면 티스토리에서 404다", () => {
    const out = inlineBodyHtml('<a href="/macro">거시</a>', SITE);
    expect(out).toContain(`href="${SITE}/macro"`);
  });

  it("외부 링크와 프로토콜 상대 주소는 건드리지 않는다", () => {
    expect(inlineBodyHtml('<a href="https://x.com/a">x</a>', SITE)).toContain('href="https://x.com/a"');
    expect(inlineBodyHtml('<a href="//cdn.example/a">c</a>', SITE)).toContain('href="//cdn.example/a"');
  });

  it("사이트 주소 끝의 /가 겹치지 않는다", () => {
    expect(inlineBodyHtml('<a href="/macro">거시</a>', `${SITE}/`)).toContain(`href="${SITE}/macro"`);
  });

  it("기존 속성을 지우지 않는다", () => {
    const out = inlineBodyHtml('<a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>', SITE);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("⚠ 모르는 태그도 지우지 않는다 — 버리면 본문이 조용히 사라진다", () => {
    expect(inlineBodyHtml("<figure><figcaption>설명</figcaption></figure>", SITE)).toContain(
      "<figcaption>설명</figcaption>",
    );
  });

  it("실제 저장 경로(markdown → sanitize)를 거친 본문도 처리한다", () => {
    const out = inlineBodyHtml(bodyHtml("- 첫째\n- 둘째"), SITE);
    expect(out).toMatch(/<ul style="/);
    expect(out).toMatch(/<li style="/);
  });
});

describe("renderTistoryHtml — ⚠ 정직성 규율이 내보낸 뒤에도 살아 있어야 한다", () => {
  it("R3 — 판정과 **철회 조건**이 함께 나간다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("구조적 우위");
    expect(html).toContain("철회 조건");
    expect(html).toContain("선단공정 점유율이 2분기 연속 하락하면");
  });

  it("R7 — 다음 판단 시점이 날짜로 나간다", () => {
    expect(renderTistoryHtml(input())).toContain("2026-11-01");
  });

  it("R2 — 빈 섹션을 지우지 않고 **미조회 고지 + 조회처**로 내보낸다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("원칙에 따라 추정치를 기입하지 않습니다");
    expect(html).toContain("KRX 정보데이터시스템");
  });

  it("R5 — 데이터 태그가 붙는다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("확인");
    expect(html).toContain("N/A");
  });

  it("R6 — 방법론의 한계가 나간다", () => {
    expect(renderTistoryHtml(input())).toContain("PBR은 수주 모멘텀 기업에 본질적 한계가");
  });

  it("R4 — 컨센서스는 제3자 공표치임을 명시하고 우리 판단과 분리한다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("제3자 컨센서스 목표주가");
    expect(html).toContain("18개사 컨센서스");
    expect(html).toContain("2026-08-10");
    expect(html).toContain("Woodsman은 목표주가를 산출하지 않습니다");
  });

  it("R1 — 채점 안 된 축을 0점으로 적지 않는다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("N/A");
    expect(html).toContain("0점이 아니라 분모에서 뺐습니다");
    expect(html).not.toMatch(/>0<\/span> \/ 10/);
  });

  it("⚠ 투자자문업 미인가 고지가 반드시 들어간다", () => {
    expect(renderTistoryHtml(input())).toContain(TISTORY_DISCLAIMER);
  });
});

describe("renderTistoryHtml — ⚠ 티스토리에서 살아남는 모양", () => {
  it("style 블록도 class도 쓰지 않는다 — 편집기가 날린다", () => {
    const html = renderTistoryHtml(input());
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
  });

  it("문서가 아니라 조각이다 — html·head·body를 만들지 않는다", () => {
    const html = renderTistoryHtml(input());
    expect(html).not.toMatch(/<!doctype/i);
    expect(html).not.toMatch(/<html\b/i);
    expect(html).not.toMatch(/<head\b/i);
    expect(html.trimStart().startsWith("<div")).toBe(true);
  });

  it("⚠ grid를 쓰지 않는다 — 옛 편집기에서 무너진다", () => {
    expect(renderTistoryHtml(input())).not.toContain("display:grid");
  });

  it("⚠ **모든** 표가 가로 스크롤 컨테이너 바로 안에 있다 — 모바일에서 화면을 밀어낸다", () => {
    const html = renderTistoryHtml(input());
    const tables = html.split("<table").length - 1;
    expect(tables).toBeGreaterThan(0);

    // 여는 <table> 앞에는 반드시 스크롤 컨테이너의 닫는 꺾쇠가 바로 붙어 있어야 한다.
    const wrapped = html.split(/overflow-x:auto;-webkit-overflow-scrolling:touch;[^"]*"><table/).length - 1;
    expect(wrapped).toBe(tables);
  });

  /**
   * ⚠ 티스토리에는 우리 CSS 리셋이 없다. `box-sizing`이 없으면 패딩이 너비에 더해져
   * 모바일에서 글 상자가 화면을 밀어낸다(기본값 `content-box`).
   */
  it("⚠ 너비가 걸린 채 패딩이 있는 상자에는 box-sizing이 붙어 있다", () => {
    const html = renderTistoryHtml(input());
    const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    const risky = styles.filter(
      (s) => /(^|;)padding:/.test(s) && /(max-width|width:100%)/.test(s),
    );
    for (const s of risky) {
      expect(s).toContain("box-sizing:border-box");
    }
    // 바깥 상자가 실제로 검사 대상에 잡혔는지 — 통과가 "검사할 게 없었다"는 뜻이면 안 된다
    expect(risky.length).toBeGreaterThan(0);
  });

  it("원문으로 돌아오는 링크가 절대경로다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain(`${SITE}/stocks/TSM`);
  });

  it("본문 안의 내부 링크도 절대경로가 된다", () => {
    expect(renderTistoryHtml(input())).toContain(`href="${SITE}/macro"`);
  });
});

describe("renderTistoryHtml — 사이트 자료", () => {
  it("주입한 스냅숏은 **기준일과 함께** 나가고 지금 값 링크를 준다", () => {
    const html = renderTistoryHtml(input());
    expect(html).toContain("작성 시점 사이트 자료 · 기준 2026-08-16");
    expect(html).toContain("54.3점");
    expect(html).toContain("미수집 1");
    expect(html).toContain("갱신하지 않고 그대로 둡니다");
    expect(html).toContain(`${SITE}/macro/bubble`);
  });

  it("발화한 트리거는 **문장**으로 나간다 — 키만 적으면 읽는 사람이 모른다", () => {
    expect(renderTistoryHtml(input())).toContain("10년물");
  });

  it("주입하지 않았으면 그 상자를 아예 만들지 않는다 — 빈 카드를 두지 않는다", () => {
    const html = renderTistoryHtml(input({ snapshot: null }));
    expect(html).not.toContain("작성 시점 사이트 자료");
  });
});

describe("renderTistoryHtml — 안전", () => {
  it("종목명·논지의 특수문자를 이스케이프한다", () => {
    const i = input();
    i.report.name = '<img src=x onerror="alert(1)">';
    const html = renderTistoryHtml(i);
    // ⚠ 태그가 만들어지지 않았는지를 본다. 글자로 남은 `onerror=&quot;`는 무해하다.
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("onerror=&quot;");
  });
});
