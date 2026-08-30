/**
 * 경제 캘린더 — 판단·표현을 맡는 순수 모듈.
 *
 * ## 무엇을 정하나
 * - 지난 일정인가 다가올 일정인가 (⚠ **KST 기준**)
 * - 지난 일정에 **평가 글이 붙었는가** — 안 붙었으면 그렇게 말한다
 * - 화면에 쓰는 이름표
 *
 * ## ⚠ 왜 "평가 없음"을 감추지 않나
 * 이 캘린더는 **콘텐츠 파이프라인**이다. 지나갔는데 글이 없는 항목이 곧 **다음에 쓸 것**이다.
 * 그걸 숨기면 캘린더는 그냥 달력이 되고, 사이트는 최신성을 잃는다.
 */
import { seoulDay } from "./kst";

export const EVENT_KINDS = ["EARNINGS", "INDICATOR", "CENTRAL_BANK", "OTHER"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  EARNINGS: "실적",
  INDICATOR: "지표",
  CENTRAL_BANK: "중앙은행",
  OTHER: "기타",
};

export const EVENT_COUNTRIES = ["US", "KR", "GLOBAL"] as const;
export type EventCountry = (typeof EVENT_COUNTRIES)[number];

export const EVENT_COUNTRY_LABEL: Record<EventCountry, string> = {
  US: "미국",
  KR: "한국",
  GLOBAL: "글로벌",
};

/** 1 참고 · 2 주목 · 3 중요. ⚠ 0이나 4는 받지 않는다 — 화면이 표현할 방법이 없다. */
export const IMPORTANCE_LABEL: Record<number, string> = {
  1: "참고",
  2: "주목",
  3: "중요",
};

export type CalendarEvent = {
  id: string;
  at: string;
  title: string;
  kind: string;
  country: string;
  importance: number;
  note?: string;
  postSlug?: string;
  source: string;
};

export function kindLabel(kind: string): string {
  return EVENT_KIND_LABEL[kind as EventKind] ?? kind;
}

export function countryLabel(country: string): string {
  return EVENT_COUNTRY_LABEL[country as EventCountry] ?? country;
}

export function importanceLabel(importance: number): string {
  return IMPORTANCE_LABEL[importance] ?? String(importance);
}

/** 입력 검증 — 액션이 쓴다. ⚠ 모르는 값을 저장하면 화면이 그것을 표현할 수 없다. */
export function isEventKind(raw: string): raw is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(raw);
}

export function isEventCountry(raw: string): raw is EventCountry {
  return (EVENT_COUNTRIES as readonly string[]).includes(raw);
}

export function isImportance(raw: number): boolean {
  return raw === 1 || raw === 2 || raw === 3;
}

/**
 * 지난 일정인가. ⚠ **KST 날짜로** 판단한다 — 그 날이 지났는지는 보는 사람의 달력 기준이다.
 * 오늘 열리는 일정은 **지나지 않은 것**으로 본다(아직 오늘이다).
 */
export function isPast(event: { at: string }, today: string): boolean {
  return seoulDay(event.at) < today;
}

export type EventStatus =
  /** 아직 안 왔다 */
  | { kind: "upcoming"; label: string }
  /** 오늘이다 */
  | { kind: "today"; label: string }
  /** 지났고 평가 글이 있다 */
  | { kind: "reviewed"; label: string; slug: string }
  /** ⚠ 지났는데 평가가 없다 — 이게 다음에 쓸 것이다 */
  | { kind: "unreviewed"; label: string };

export function eventStatus(event: CalendarEvent, today: string): EventStatus {
  const day = seoulDay(event.at);
  if (day > today) return { kind: "upcoming", label: "예정" };
  if (day === today) return { kind: "today", label: "오늘" };
  if (event.postSlug) return { kind: "reviewed", label: "평가 있음", slug: event.postSlug };
  return { kind: "unreviewed", label: "아직 평가 없음" };
}

/**
 * 다가오는 일정 N건 — 오늘 것을 **포함**한다.
 * ⚠ 목록은 날짜 오름차순이어야 한다. 저장소가 어떤 순서로 주든 여기서 다시 세운다.
 */
export function upcoming(events: CalendarEvent[], today: string, limit = 3): CalendarEvent[] {
  return events
    .filter((e) => seoulDay(e.at) >= today)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, limit);
}

/** 지났는데 평가 글이 없는 것 — **다음에 쓸 목록**이다. 최근 것부터. */
export function needsReview(events: CalendarEvent[], today: string, limit = 5): CalendarEvent[] {
  return events
    .filter((e) => seoulDay(e.at) < today && !e.postSlug)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** 날짜(KST)별로 묶는다. 목록은 이미 정렬돼 온다고 보지 않고 여기서 세운다. */
export function groupByDay(events: CalendarEvent[]): { day: string; items: CalendarEvent[] }[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const days: { day: string; items: CalendarEvent[] }[] = [];
  for (const event of sorted) {
    const day = seoulDay(event.at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(event);
    else days.push({ day, items: [event] });
  }
  return days;
}

/**
 * iCalendar(.ics) 본문.
 *
 * ## 왜 있나
 * ⚠ 구글 캘린더 **연동에 회원 가입이 필요하지 않다.** 이 주소를 캘린더에 "구독"으로 걸면
 * 일정이 그대로 들어간다. 회원 기능은 나중에 열리지만, 구독은 지금 바로 쓸 수 있다.
 *
 * ⚠ 줄바꿈은 **CRLF**여야 한다(RFC 5545). LF만 쓰면 일부 캘린더가 통째로 무시한다.
 * ⚠ 제목에 든 `,` `;` `\` 는 이스케이프한다. 안 하면 그 줄이 깨져 일정이 사라진다.
 */
export function toIcs(events: CalendarEvent[], now: string): string {
  const stamp = toIcsTime(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Woodsman//Macro Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Woodsman 경제 캘린더",
    "X-WR-TIMEZONE:Asia/Seoul",
  ];

  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@woodsman`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsTime(e.at)}`,
      `SUMMARY:${icsEscape(`[${kindLabel(e.kind)}] ${e.title}`)}`,
      ...(e.note ? [`DESCRIPTION:${icsEscape(e.note)}`] : []),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** ISO → `20260830T120000Z`. 값이 이상하면 그대로 두지 않고 빈 문자열을 만든다. */
export function toIcsTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** ⚠ 순서가 중요하다 — 역슬래시를 먼저 바꾸지 않으면 뒤의 이스케이프가 다시 이스케이프된다. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
