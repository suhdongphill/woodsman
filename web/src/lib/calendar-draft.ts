/**
 * 캘린더 초안 — AI가 제안한 일정을 **믿기 전에 거르는** 순수 모듈.
 *
 * ## 왜 만들었나
 * 캘린더는 이 사이트의 콘텐츠 파이프라인이다(`macro-calendar.ts`). 그런데 일정을 넣는 일이
 * ⚠ **사람의 기억에 걸려 있었다** — 자동 수집이 사람 손에 걸려 있어 환율이 열흘 늙었던 것과
 *    같은 자리다(2026-09-01). 그래서 AI에게 다음 몇 주의 일정을 물어 **초안**을 받는다.
 *
 * ## ⚠ 그러나 AI가 캘린더에 직접 쓰지는 않는다
 * 날짜는 이 사이트에서 가장 위험한 자리다. 지표 발표일을 하루 틀리게 적으면 화면은 아무 일도
 * 없었던 것처럼 멀쩡하고, **틀렸다는 사실만 조용히 사라진다.** 언어 모델은 날짜를 그럴듯하게
 * 지어내는 데 특히 능하다. 그래서 이 모듈은 다음을 강제한다.
 *
 * - ⚠ **채택은 사람(Woodsman)이 한다.** 초안은 화면에 후보로만 뜬다. 저장은 고른 것만.
 * - ⚠ **시각은 받지 않는다.** 날짜까지만 쓰고 `timeKnown: false`로 넣는다 —
 *   화면이 시각을 지운다(`eventTime`). 모르는 것을 아는 것처럼 적지 않는다(2026-08-30).
 * - ⚠ **근거(`basis`)가 없는 항목은 버린다.** "무엇이 이 날짜를 공표했는가"를 못 대면
 *   그것은 기억이 아니라 추측이다.
 * - ⚠ **기간 밖·과거 날짜는 버린다.** 물어본 창 안의 것만 받는다.
 * - ⚠ **이미 있는 일정은 버린다.** 같은 날 같은 제목이 두 줄로 서면 캘린더가 낙서가 된다.
 *   (2026-08-30에 실제로 FOMC가 중복으로 들어갔다.)
 * - ⚠ **버린 것을 숨기지 않는다.** 무엇을 왜 버렸는지 함께 돌려준다. 조용히 사라지면
 *   "AI가 아무것도 못 찾았다"와 "전부 거절당했다"가 같아 보인다.
 */
import {
  EVENT_COUNTRIES,
  EVENT_KINDS,
  isEventCountry,
  isEventKind,
  isImportance,
  type CalendarEvent,
} from "./macro-calendar";

/** 한 번에 물어보는 기간(일). 8주 — 분기 실적과 다음 FOMC가 한 번에 들어오는 창이다. */
export const DRAFT_HORIZON_DAYS = 56;

/** 한 번에 받는 최대 건수. 넘게 오면 잘라 낸다 — 화면이 감당할 수 없는 목록은 검토되지 않는다. */
export const DRAFT_MAX_ITEMS = 25;

export type DraftEvent = {
  /** YYYY-MM-DD (KST 기준) */
  day: string;
  title: string;
  kind: string;
  country: string;
  importance: number;
  /** 무엇을 볼 것인가 — 한 줄 */
  note: string;
  /** ⚠ 이 날짜를 무엇이 공표했는가. 없으면 채택 후보가 되지 못한다. */
  basis: string;
  /** 같은 초안을 두 번 저장하지 않기 위한 키 */
  externalId: string;
};

export type RejectedDraft = { raw: string; reason: string };

export type DraftParseResult = {
  items: DraftEvent[];
  rejected: RejectedDraft[];
};

/** 제목 비교용 정규화 — 공백·문장부호·대소문자 차이로 중복을 놓치지 않게. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s.,·()[\]{}''""\-–—:;!?]/g, "")
    .trim();
}

/** 초안 하나의 고유 키. 같은 날 같은 제목이면 같은 키다. */
export function draftExternalId(day: string, title: string): string {
  return `ai:${day}:${normalizeTitle(title)}`;
}

/** KST 기준으로 `days`일 뒤의 날짜(YYYY-MM-DD). */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * 모델에게 줄 지시문.
 *
 * ⚠ 기존 일정을 **함께 보낸다.** 안 보내면 같은 FOMC를 매번 다시 제안하고,
 *   사람이 매번 같은 것을 걸러 내야 한다 — 그러면 이 기능은 곧 안 쓰이게 된다.
 */
export function buildDraftPrompt(input: {
  today: string;
  existing: readonly CalendarEvent[];
  horizonDays?: number;
}): string {
  const horizon = input.horizonDays ?? DRAFT_HORIZON_DAYS;
  const until = addDays(input.today, horizon);

  const known = input.existing
    .map((e) => `${e.at.slice(0, 10)} ${e.title}`)
    .slice(0, 60)
    .join("\n");

  return `오늘은 ${input.today}(KST)입니다. ${input.today}부터 ${until}까지의 주식시장 주요 일정을 정리해 주세요.

이미 캘린더에 들어 있는 일정 (다시 제안하지 마세요)
${known || "(없음)"}

무엇을 넣나
- 미국·한국의 거시 지표 발표 (CPI·고용·PCE·소매판매 등)
- 중앙은행 일정 (FOMC·한국은행 금통위·ECB·BOJ)
- 시장 전체가 보는 대형 실적 (반도체·빅테크·국내 대형주)
- 그 밖에 시장의 방향을 바꿀 수 있는 공표된 일정

무엇을 넣지 않나
- ⚠ 날짜가 확실하지 않은 것. 근거를 댈 수 없으면 **넣지 마세요.** 빠뜨리는 것이 틀리는 것보다 낫습니다.
- 시각(몇 시). 날짜까지만 씁니다.
- 전망·예상치·목표가. 이 캘린더는 "무엇을 볼 것인가"까지만 적습니다.
- 이미 들어 있는 일정과 같은 것

최대 ${DRAFT_MAX_ITEMS}건. 날짜 순으로.`;
}

/** 코드 펜스·앞뒤 군말을 걷어내고 JSON 본문만 남긴다. */
export function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * 모델 응답을 채택 후보로 바꾼다.
 *
 * ⚠ 하나가 이상해도 나머지는 살린다. 다만 버린 것은 **반드시 이유와 함께** 남긴다.
 */
export function parseDraft(
  raw: string,
  context: { today: string; existing: readonly CalendarEvent[]; horizonDays?: number },
): DraftParseResult {
  const horizon = context.horizonDays ?? DRAFT_HORIZON_DAYS;
  const until = addDays(context.today, horizon);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(raw));
  } catch {
    // ⚠ 빈 목록으로 넘기지 않는다. "못 알아들었다"와 "찾은 게 없다"는 다른 상태다.
    return { items: [], rejected: [{ raw: raw.slice(0, 200), reason: "JSON으로 읽을 수 없습니다" }] };
  }

  const list = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(list)) {
    return { items: [], rejected: [{ raw: raw.slice(0, 200), reason: "events 배열이 없습니다" }] };
  }

  const seenInDb = new Set(
    context.existing.map((e) => `${e.at.slice(0, 10)}|${normalizeTitle(e.title)}`),
  );
  const seenInDraft = new Set<string>();

  const items: DraftEvent[] = [];
  const rejected: RejectedDraft[] = [];

  for (const entry of list) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const day = asString(row.day);
    const title = asString(row.title);
    const label = `${day || "?"} ${title || "?"}`;

    const reject = (reason: string) => rejected.push({ raw: label, reason });

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      reject("날짜 형식이 아닙니다");
      continue;
    }
    if (day < context.today || day > until) {
      reject(`물어본 기간(${context.today}~${until}) 밖입니다`);
      continue;
    }
    if (title.length < 2) {
      reject("제목이 없습니다");
      continue;
    }

    const kind = asString(row.kind).toUpperCase();
    if (!isEventKind(kind)) {
      reject(`종류가 ${EVENT_KINDS.join("·")} 중에 없습니다`);
      continue;
    }

    const country = asString(row.country).toUpperCase();
    if (!isEventCountry(country)) {
      reject(`국가가 ${EVENT_COUNTRIES.join("·")} 중에 없습니다`);
      continue;
    }

    const importance = Number(row.importance);
    if (!isImportance(importance)) {
      reject("중요도가 1·2·3이 아닙니다");
      continue;
    }

    // ⚠ 근거 없는 날짜는 받지 않는다. 이 한 줄이 이 모듈의 존재 이유다.
    const basis = asString(row.basis);
    if (basis.length < 4) {
      reject("날짜의 근거가 없습니다");
      continue;
    }

    const key = `${day}|${normalizeTitle(title)}`;
    if (seenInDb.has(key)) {
      reject("이미 캘린더에 있습니다");
      continue;
    }
    if (seenInDraft.has(key)) {
      reject("초안 안에서 중복입니다");
      continue;
    }
    seenInDraft.add(key);

    items.push({
      day,
      title,
      kind,
      country,
      importance,
      note: asString(row.note),
      basis,
      externalId: draftExternalId(day, title),
    });

    if (items.length >= DRAFT_MAX_ITEMS) break;
  }

  items.sort((a, b) => a.day.localeCompare(b.day));
  return { items, rejected };
}

/**
 * 저장할 때 쓰는 `at`.
 * ⚠ 그 날 **정오(UTC)** 다. 자정으로 넣으면 KST 화면에서 하루가 밀린다.
 *   그리고 이 값은 화면에 시각으로 그려지지 않는다(`timeKnown: false`).
 */
export function draftAt(day: string): string {
  return `${day}T12:00:00.000Z`;
}
