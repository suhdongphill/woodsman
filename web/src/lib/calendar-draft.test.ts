import { describe, expect, it } from "vitest";
import {
  DRAFT_MAX_ITEMS,
  addDays,
  buildDraftPrompt,
  draftAt,
  draftExternalId,
  extractJsonBlock,
  normalizeTitle,
  parseDraft,
} from "./calendar-draft";
import type { CalendarEvent } from "./macro-calendar";

const TODAY = "2026-09-05";

function event(at: string, title: string): CalendarEvent {
  return {
    id: `ev_${at}_${title}`,
    at,
    title,
    kind: "INDICATOR",
    country: "US",
    importance: 2,
    source: "MANUAL",
  };
}

function payload(...rows: Record<string, unknown>[]): string {
  return JSON.stringify({ events: rows });
}

const ok = {
  day: "2026-09-11",
  title: "8월 CPI 발표",
  kind: "INDICATOR",
  country: "US",
  importance: 3,
  note: "근원 물가가 3%를 밑도는지",
  basis: "미 노동통계국이 공표한 연간 발표 일정",
};

describe("AI 일정 초안 — 받은 것을 믿기 전에", () => {
  it("갖출 것을 갖춘 항목은 후보가 된다", () => {
    const { items, rejected } = parseDraft(payload(ok), { today: TODAY, existing: [] });

    expect(rejected).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("8월 CPI 발표");
    expect(items[0].externalId).toBe(draftExternalId("2026-09-11", "8월 CPI 발표"));
  });

  /**
   * ⚠ 이 테스트가 이 모듈의 존재 이유다. 근거를 못 대는 날짜는 기억이 아니라 추측이고,
   *    추측이 캘린더에 들어가면 화면은 멀쩡한 채로 틀린다.
   */
  it("⚠ 날짜의 근거가 없으면 버린다", () => {
    const { items, rejected } = parseDraft(payload({ ...ok, basis: "" }), {
      today: TODAY,
      existing: [],
    });

    expect(items).toEqual([]);
    expect(rejected[0].reason).toContain("근거");
  });

  it("물어본 기간 밖(과거·너무 먼 미래)은 버린다", () => {
    const { items, rejected } = parseDraft(
      payload({ ...ok, day: "2026-09-01" }, { ...ok, day: "2027-01-01" }),
      { today: TODAY, existing: [] },
    );

    expect(items).toEqual([]);
    expect(rejected).toHaveLength(2);
    for (const r of rejected) expect(r.reason).toContain("기간");
  });

  /** ⚠ 2026-08-30에 FOMC가 실제로 두 줄 들어갔다. 같은 일이 자동으로 반복되지 않게 한다. */
  it("⚠ 이미 캘린더에 있는 일정은 버린다 (표기가 조금 달라도)", () => {
    const existing = [event("2026-09-11T12:00:00.000Z", "8월 CPI 발표")];
    const { items, rejected } = parseDraft(payload({ ...ok, title: "8월 CPI  발표!" }), {
      today: TODAY,
      existing,
    });

    expect(items).toEqual([]);
    expect(rejected[0].reason).toContain("이미");
  });

  it("초안 안에서 같은 것을 두 번 제안하면 하나만 남는다", () => {
    const { items, rejected } = parseDraft(payload(ok, ok), { today: TODAY, existing: [] });

    expect(items).toHaveLength(1);
    expect(rejected[0].reason).toContain("중복");
  });

  it("종류·국가·중요도가 규격 밖이면 버린다", () => {
    const { items, rejected } = parseDraft(
      payload(
        { ...ok, day: "2026-09-12", kind: "GUESS" },
        { ...ok, day: "2026-09-13", country: "JP" },
        { ...ok, day: "2026-09-14", importance: 5 },
      ),
      { today: TODAY, existing: [] },
    );

    expect(items).toEqual([]);
    expect(rejected).toHaveLength(3);
  });

  it("날짜 형식이 아니면 버린다", () => {
    const { items, rejected } = parseDraft(payload({ ...ok, day: "9월 둘째 주" }), {
      today: TODAY,
      existing: [],
    });

    expect(items).toEqual([]);
    expect(rejected[0].reason).toContain("날짜");
  });

  /** ⚠ 조용한 실패를 만들지 않는다 — "못 알아들었다"와 "찾은 게 없다"는 다른 상태다. */
  it("⚠ JSON이 아니면 빈 목록으로 넘기지 않고 이유를 남긴다", () => {
    const { items, rejected } = parseDraft("죄송합니다, 일정을 찾지 못했습니다.", {
      today: TODAY,
      existing: [],
    });

    expect(items).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("JSON");
  });

  it("코드 펜스로 감싸 와도 읽는다", () => {
    const raw = "```json\n" + payload(ok) + "\n```";
    expect(parseDraft(raw, { today: TODAY, existing: [] }).items).toHaveLength(1);
  });

  it("한 번에 받는 건수를 넘기지 않는다", () => {
    const many = Array.from({ length: DRAFT_MAX_ITEMS + 5 }, (_, i) => ({
      ...ok,
      day: addDays(TODAY, i + 1),
      title: `일정 ${i}`,
    }));
    expect(parseDraft(payload(...many), { today: TODAY, existing: [] }).items).toHaveLength(
      DRAFT_MAX_ITEMS,
    );
  });

  it("날짜 순으로 돌려준다", () => {
    const { items } = parseDraft(
      payload({ ...ok, day: "2026-09-20", title: "나중" }, { ...ok, day: "2026-09-08", title: "먼저" }),
      { today: TODAY, existing: [] },
    );
    expect(items.map((i) => i.title)).toEqual(["먼저", "나중"]);
  });
});

describe("초안 프롬프트", () => {
  it("⚠ 이미 있는 일정을 함께 보낸다 — 안 보내면 같은 것을 매번 다시 제안한다", () => {
    const prompt = buildDraftPrompt({
      today: TODAY,
      existing: [event("2026-09-17T12:00:00.000Z", "FOMC 정례회의")],
    });

    expect(prompt).toContain("2026-09-17 FOMC 정례회의");
    expect(prompt).toContain(TODAY);
    expect(prompt).toContain(addDays(TODAY, 56));
  });

  it("⚠ 시각을 적지 말라고 분명히 말한다", () => {
    expect(buildDraftPrompt({ today: TODAY, existing: [] })).toContain("시각");
  });
});

describe("보조 함수", () => {
  it("제목 정규화는 공백·문장부호를 무시한다", () => {
    expect(normalizeTitle("8월 CPI  발표!")).toBe(normalizeTitle("8월CPI발표"));
  });

  it("⚠ 저장 시각은 그 날 정오(UTC)다 — 자정이면 KST에서 하루가 밀린다", () => {
    expect(draftAt("2026-09-11")).toBe("2026-09-11T12:00:00.000Z");
  });

  it("날짜 더하기", () => {
    expect(addDays("2026-09-05", 56)).toBe("2026-10-31");
  });

  it("앞뒤 군말이 붙어도 JSON 본문만 꺼낸다", () => {
    expect(extractJsonBlock('알겠습니다.\n{"events":[]}\n확인해 주세요.')).toBe('{"events":[]}');
  });
});
