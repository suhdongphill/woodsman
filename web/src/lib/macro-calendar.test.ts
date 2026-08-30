import { describe, expect, it } from "vitest";
import {
  eventStatus,
  groupByDay,
  icsEscape,
  isEventKind,
  isImportance,
  needsReview,
  toIcs,
  toIcsTime,
  upcoming,
  type CalendarEvent,
} from "./macro-calendar";

const TODAY = "2026-08-30";

function ev(id: string, at: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    at,
    title: `일정 ${id}`,
    kind: "INDICATOR",
    country: "US",
    importance: 2,
    source: "MANUAL",
    ...extra,
  };
}

describe("일정의 상태", () => {
  it("아직 안 온 일정은 예정", () => {
    expect(eventStatus(ev("a", "2026-09-05T12:00:00.000Z"), TODAY).kind).toBe("upcoming");
  });

  it("오늘 열리는 일정은 지난 것이 아니다", () => {
    // KST 14:00 — 같은 날이다
    expect(eventStatus(ev("a", "2026-08-30T05:00:00.000Z"), TODAY).kind).toBe("today");
  });

  it("⚠ UTC 늦은 밤은 KST로 이미 다음날이다 — 그래서 '예정'이다", () => {
    // 2026-08-30T23:00Z = KST 2026-08-31 08:00
    expect(eventStatus(ev("a", "2026-08-30T23:00:00.000Z"), TODAY).kind).toBe("upcoming");
  });

  it("지났고 평가 글이 있으면 그 글로 잇는다", () => {
    const s = eventStatus(ev("a", "2026-08-20T12:00:00.000Z", { postSlug: "cpi-2026" }), TODAY);
    expect(s.kind).toBe("reviewed");
    expect(s.kind === "reviewed" && s.slug).toBe("cpi-2026");
  });

  it("⚠ 지났는데 평가가 없으면 그렇게 말한다 — 이게 다음에 쓸 것이다", () => {
    const s = eventStatus(ev("a", "2026-08-20T12:00:00.000Z"), TODAY);
    expect(s.kind).toBe("unreviewed");
    expect(s.label).toContain("아직");
  });

  it("⚠ KST로 판단한다 — UTC로 보면 어제 일이 오늘로 보인다", () => {
    // 2026-08-29T23:00Z = KST 2026-08-30 08:00 → 오늘이다
    expect(eventStatus(ev("a", "2026-08-29T23:00:00.000Z"), TODAY).kind).toBe("today");
  });
});

describe("목록 만들기", () => {
  const events = [
    ev("past-1", "2026-08-10T12:00:00.000Z"),
    ev("past-2", "2026-08-25T12:00:00.000Z", { postSlug: "written" }),
    ev("past-3", "2026-08-28T12:00:00.000Z"),
    ev("today", "2026-08-30T12:00:00.000Z"),
    ev("soon", "2026-09-02T12:00:00.000Z"),
    ev("later", "2026-09-20T12:00:00.000Z"),
  ];

  it("다가오는 일정은 오늘을 포함하고 날짜순이다", () => {
    expect(upcoming(events, TODAY, 3).map((e) => e.id)).toEqual(["today", "soon", "later"]);
  });

  it("⚠ 평가가 밀린 것은 최근 것부터 — 쓸 순서가 그 순서다", () => {
    expect(needsReview(events, TODAY).map((e) => e.id)).toEqual(["past-3", "past-1"]);
  });

  it("평가 글이 붙은 지난 일정은 밀린 목록에서 빠진다", () => {
    expect(needsReview(events, TODAY).map((e) => e.id)).not.toContain("past-2");
  });

  it("날짜별로 묶고 순서를 다시 세운다", () => {
    const days = groupByDay([ev("b", "2026-09-02T12:00:00.000Z"), ev("a", "2026-08-10T12:00:00.000Z")]);
    expect(days.map((d) => d.day)).toEqual(["2026-08-10", "2026-09-02"]);
  });
});

describe("입력 검증", () => {
  it("모르는 종류·중요도를 받지 않는다 — 화면이 표현할 방법이 없다", () => {
    expect(isEventKind("EARNINGS")).toBe(true);
    expect(isEventKind("PARTY")).toBe(false);
    expect(isImportance(3)).toBe(true);
    expect(isImportance(0)).toBe(false);
    expect(isImportance(4)).toBe(false);
  });
});

describe("구글 캘린더 구독(.ics)", () => {
  const ics = toIcs([ev("a", "2026-09-02T12:30:00.000Z", { note: "메모" })], "2026-08-30T00:00:00.000Z");

  it("⚠ 줄바꿈은 CRLF다 — LF만 쓰면 일부 캘린더가 통째로 무시한다", () => {
    expect(ics).toContain("\r\n");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("일정 하나가 VEVENT 하나가 된다", () => {
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260902T123000Z");
    expect(ics).toContain("SUMMARY:[지표] 일정 a");
  });

  it("⚠ 쉼표·세미콜론·역슬래시를 이스케이프한다 — 안 하면 그 줄이 깨진다", () => {
    expect(icsEscape("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    // 역슬래시를 먼저 바꾸지 않으면 이중 이스케이프가 된다
    expect(icsEscape("\\,")).toBe("\\\\\\,");
  });

  it("망가진 시각에도 죽지 않는다", () => {
    expect(toIcsTime("(없음)")).toBe("");
  });
});
