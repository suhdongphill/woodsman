import { describe, expect, it } from "vitest";
import {
  CONTEXT_STALE_DAYS,
  FUNCTION_LABEL_REPORT,
  contextAgeDays,
  describeDrift,
  isContextStale,
  marketAxisEvidence,
  recessionCounts,
  renderContextMarkdown,
  type MacroContext,
  type ReportContextSnapshot,
  type SiteContext,
} from "./context";
import { markdownToHtml } from "../markdown";
import { FUNCTION_LABEL_KO } from "../ai/labels";
import { BUBBLE_TRIGGERS } from "../bubble/catalog";

const MACRO: MacroContext = {
  level: "caution",
  label: "경계",
  line: "경고가 2개입니다.",
  alerts: 2,
  watches: 1,
  unknowns: 0,
  total: 5,
  asOf: "2026-08-14",
  fed: {
    bias: "neutral",
    biasLabel: "중립",
    hike: 0.21,
    hold: 0.62,
    cut: 0.17,
    asOf: "2026-07-31",
  },
};

const EMPTY_MACRO: MacroContext = {
  level: "unknown",
  label: "미수집",
  line: "아직 지표를 가져오지 않았습니다.",
  alerts: 0,
  watches: 0,
  unknowns: 5,
  total: 5,
};

const SNAPSHOT: ReportContextSnapshot = {
  capturedAt: "2026-08-16",
  macro: MACRO,
  bubble: {
    score: 56,
    regime: "경계",
    stance: "신규 확대 보류",
    scored: 30,
    total: 30,
    priorityFired: false,
    firedTriggerKeys: ["trg5"],
  },
  holding: {
    inPortfolio: true,
    functionType: "GROWTH",
    targetWeight: 8,
    thesis: "파운드리 독점 구조",
  },
};

const base = (): SiteContext => ({
  macro: { ...MACRO, fed: { ...MACRO.fed! } },
  bubble: { ...SNAPSHOT.bubble, firedTriggerKeys: [...SNAPSHOT.bubble.firedTriggerKeys] },
  holding: { ...SNAPSHOT.holding },
});

describe("marketAxisEvidence — M축 근거", () => {
  it("근거·출처·기준일을 채우되 점수는 내지 않는다", () => {
    const ev = marketAxisEvidence(MACRO)!;

    expect(ev.evidence).toContain("침체 신호 종합 경계");
    expect(ev.evidence).toContain("경고 2");
    expect(ev.evidence).toContain("연준 중립");
    expect(ev.source).toContain("FRED");
    expect(ev.sourceUrl).toBe("/macro");
    // ⚠ 점수 필드 자체가 없다 — 있으면 언젠가 자동으로 채우게 된다.
    expect("points" in ev).toBe(false);
  });

  it("⚠ 기준일은 더 **오래된** 쪽을 쓴다 — 묵은 판단을 새 것으로 보이게 하지 않는다", () => {
    expect(marketAxisEvidence(MACRO)!.asOf).toBe("2026-07-31");
  });

  it("미수집이면 아무것도 내지 않는다 — 빈 것을 근거 문장으로 만들지 않는다", () => {
    expect(marketAxisEvidence(EMPTY_MACRO)).toBeUndefined();
  });

  it("미수집 지표가 있으면 그 개수를 근거에 적는다", () => {
    const ev = marketAxisEvidence({ ...MACRO, unknowns: 2 })!;
    expect(ev.evidence).toContain("미수집 2");
  });

  it("연준 산출이 없으면 그 문장을 아예 빼고, 남은 기준일을 쓴다", () => {
    const ev = marketAxisEvidence({ ...MACRO, fed: undefined })!;
    expect(ev.evidence).not.toContain("연준");
    expect(ev.asOf).toBe("2026-08-14");
  });
});

describe("recessionCounts — ⚠ 미수집을 숨기지 않는다", () => {
  it("미수집이 없으면 경고·주의만", () => {
    expect(recessionCounts(MACRO)).toBe("경고 2 · 주의 1");
  });

  it("미수집이 있으면 반드시 함께 적는다", () => {
    expect(recessionCounts({ ...MACRO, alerts: 0, watches: 0, unknowns: 1 })).toBe(
      "경고 0 · 주의 0 · 미수집 1",
    );
  });

  it("⚠ 실제로 겪은 구멍 — '안정 · 경고 0 · 주의 0'만 보이면 5개를 다 보고 안전한 것처럼 읽힌다", () => {
    const md = renderContextMarkdown({
      ...SNAPSHOT,
      macro: { ...MACRO, level: "calm", label: "안정", alerts: 0, watches: 0, unknowns: 1 },
    });
    expect(md).toContain("미수집 1");
  });
});

describe("renderContextMarkdown — 붙여 넣을 목록", () => {
  it("값이 있으면 값과 기준일을 함께 적는다", () => {
    const md = renderContextMarkdown(SNAPSHOT);

    expect(md).toContain("기준 2026-08-16");
    expect(md).toContain("경계 · 경고 2 · 주의 1");
    expect(md).toContain("2026-08-14");
    expect(md).toContain("56점");
    expect(md).toContain("trg5");
    expect(md).toContain("편입 · 성장 · 목표비중 8%");
  });

  /**
   * ⚠ 실제로 겪은 결함: 처음에 마크다운 **표**로 내보냈는데
   * `lib/markdown.ts`는 표 문법이 없어서 붙여 넣은 자리에서 한 문단으로 뭉개졌다.
   * 붙여 넣을 것을 만드는 모듈은 **붙여 넣은 뒤 무엇이 되는지**까지 봐야 한다.
   */
  it("⚠ 본문에 붙여 넣으면 실제로 목록으로 렌더된다", () => {
    const html = markdownToHtml(renderContextMarkdown(SNAPSHOT));

    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("<strong>침체 신호 종합</strong>");
    // 표 문법의 잔해가 글자로 남으면 안 된다
    expect(html).not.toContain("| ---");
    expect(html).not.toContain("| 항목 |");
  });

  it("출처 링크가 사이트 안으로 이어진다 — 도는 동선이다", () => {
    const html = markdownToHtml(renderContextMarkdown(SNAPSHOT));
    expect(html).toContain('href="/macro"');
    expect(html).toContain('href="/macro/bubble"');
    expect(html).toContain('href="/portfolio"');
  });

  it("⚠ 없는 값은 0이 아니라 —와 조회처로 적는다(R2)", () => {
    const md = renderContextMarkdown({
      ...SNAPSHOT,
      macro: EMPTY_MACRO,
      bubble: { ...SNAPSHOT.bubble, score: undefined, regime: undefined, scored: 0 },
      holding: { inPortfolio: false },
    });

    expect(md).toContain("아직 수집 전입니다");
    expect(md).toContain("Core PCE·기준금리·실업률이 있어야 계산됩니다");
    expect(md).toContain("아직 채점 전입니다");
    expect(md).toContain("미편입 (관찰 종목)");
    expect(md).not.toContain("0점");
  });

  it("우선 경보 3종이 동시에 발화하면 그렇다고 적는다", () => {
    const md = renderContextMarkdown({
      ...SNAPSHOT,
      bubble: { ...SNAPSHOT.bubble, priorityFired: true },
    });
    expect(md).toContain("⚠ 우선 경보 3종 동시 발화");
  });
});

describe("describeDrift — 주입 뒤 움직인 것", () => {
  it("움직이지 않았으면 빈 배열", () => {
    expect(describeDrift(base(), base())).toEqual([]);
  });

  it("침체 등급이 바뀌면 잡는다", () => {
    const now = base();
    now.macro = { ...now.macro, level: "danger", label: "위험" };

    const drift = describeDrift(base(), now);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ label: "침체 신호 종합", before: "경계", after: "위험" });
  });

  it("연준 편향이 사라지면 '미산출'로 잡는다 — 값이 없어진 것도 변화다", () => {
    const now = base();
    now.macro = { ...now.macro, fed: undefined };

    const drift = describeDrift(base(), now);
    expect(drift[0]).toMatchObject({ label: "연준 방향", after: "미산출" });
  });

  it("버블 점수는 1점만 움직여도 잡는다", () => {
    const now = base();
    now.bubble = { ...now.bubble, score: 57 };

    expect(describeDrift(base(), now)[0]).toMatchObject({
      label: "버블 점수",
      before: "56점 · 경계",
      after: "57점 · 경계",
    });
  });

  it("트리거가 발화하거나 해제되면 잡는다", () => {
    const fired = base();
    fired.bubble = { ...fired.bubble, firedTriggerKeys: ["trg5", "trg2"] };
    expect(describeDrift(base(), fired)[0].label).toBe("하드 트리거");

    const cleared = base();
    cleared.bubble = { ...cleared.bubble, firedTriggerKeys: [] };
    expect(describeDrift(base(), cleared)[0]).toMatchObject({ after: "없음" });
  });

  it("편입 여부·목표비중이 바뀌면 잡는다", () => {
    const now = base();
    now.holding = { inPortfolio: false };

    expect(describeDrift(base(), now)[0]).toMatchObject({
      label: "대표 포트폴리오",
      before: "편입 · 성장 · 8%",
      after: "미편입",
    });
  });
});

describe("스냅숏의 나이", () => {
  it("일수를 센다", () => {
    expect(contextAgeDays("2026-08-01", "2026-08-16")).toBe(15);
    expect(contextAgeDays("2026-08-16", "2026-08-16")).toBe(0);
  });

  it("날짜 모양이 아니면 undefined — 억지로 0을 내지 않는다", () => {
    expect(contextAgeDays("2026-8-1", "2026-08-16")).toBeUndefined();
    expect(contextAgeDays("", "2026-08-16")).toBeUndefined();
  });

  it(`${CONTEXT_STALE_DAYS}일을 넘기면 묵은 것으로 본다`, () => {
    expect(contextAgeDays("2026-07-17", "2026-08-16")).toBe(30);
    expect(isContextStale("2026-07-16", "2026-08-16")).toBe(true); // 31일 — 초과
    expect(isContextStale("2026-07-17", "2026-08-16")).toBe(false); // 30일 — 경계는 아직 아니다
  });
});

describe("⚠ 두 곳에 적은 것은 테스트가 대조한다", () => {
  it("기능 라벨 세 사본의 값이 같다", () => {
    expect(FUNCTION_LABEL_REPORT).toEqual(FUNCTION_LABEL_KO);
  });

  it("트리거 키에 쉼표가 없다 — 스냅숏이 키를 쉼표로 이어 저장한다", () => {
    for (const t of BUBBLE_TRIGGERS) {
      expect(t.key).not.toContain(",");
    }
  });
});
