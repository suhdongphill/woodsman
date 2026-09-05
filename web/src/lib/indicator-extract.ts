/**
 * 지표값 추출 — AI가 **읽기만** 하게 만드는 자리.
 *
 * ## 무엇을 하는 기능인가
 * 아직 자동 수집 경로가 없는 지표(ISM·컨퍼런스보드 CCI·NAHB 등 유료 라이선스 계열)를
 * 사람이 손으로 옮겨 적고 있었고, **그래서 한 점도 안 들어왔다.** 이 모듈은 그 옮겨 적기를
 * AI에게 시킨다. 다만 조건이 있다.
 *
 * ## ⚠ AI가 「아는 숫자」를 쓰지 못하게 하는 세 겹
 * 1. **출처는 사람이 준다.** 모델이 URL을 고르지 않는다 — 지어낸 출처가 근거로 둔갑하는
 *    가장 흔한 경로를 아예 막는다.
 * 2. **본문은 서버가 받아 온다.** 모델에게는 그 텍스트만 준다. 모델의 기억이 아니라
 *    **화면에 실제로 있는 글자**에서만 값을 찾게 된다.
 * 3. ⚠ **인용문을 원문과 대조한다.** 모델이 낸 `quote`가 받아 온 텍스트에 글자 그대로
 *    없으면 **버린다**(`containsQuote`). 이 한 겹이 이 모듈의 핵심이고, 캘린더 초안의
 *    「근거를 대라」(`calendar-draft.ts`)보다 한 단계 강하다 — 거기서는 근거의 존재만 봤지만
 *    여기서는 **근거가 진짜인지**를 기계가 확인한다.
 *
 * ## 그래도 남는 것
 * ⚠ 이 검사는 **「본문에 있는 문장인가」까지**다. 그 문장이 우리가 찾던 지표를 가리키는지는
 *    사람이 본다. 그래서 결과는 **후보**로만 나가고, 저장은 관리자가 누른다.
 * ⚠ 저장될 때 출처는 `AI`로 남는다. 어떤 값이 사람 손을 거쳤고 어떤 값이 모델을 거쳤는지
 *    나중에 구분할 수 없으면, 이 기능은 결국 신뢰를 갉아먹는다.
 */
import { containsQuote } from "./html-text";

/** 뽑아 온 값 하나. */
export type ExtractedPoint = {
  /** 원값 그대로. 변환(YoY 등)은 읽을 때 한다 — 저장은 원값이다. */
  value: number;
  /** 관측 기준일(YYYY-MM-DD). ⚠ 발표일이 아니라 **자료의 시점**이다. */
  date: string;
  /** 원문에서 그대로 옮긴 문장 — 서버가 대조한다 */
  quote: string;
  /** 모델이 덧붙인 한 줄(선택) */
  note?: string;
};

export type ExtractResult =
  | { ok: true; point: ExtractedPoint }
  | { ok: false; reason: string; raw?: string };

/**
 * 모델에게 줄 지시문.
 *
 * ⚠ **본문 밖의 지식을 쓰지 말라**고 명시한다. 그리고 못 찾으면 못 찾았다고 하게 한다 —
 *   빈손으로 돌아오는 길을 열어 두지 않으면 모델은 반드시 무언가를 지어낸다.
 */
export function buildExtractPrompt(input: {
  indicatorName: string;
  unit: string;
  what: string;
  url: string;
  pageText: string;
  today: string;
}): string {
  return `아래는 ${input.url} 에서 방금 받아 온 본문입니다. 오늘은 ${input.today}입니다.

찾는 값: **${input.indicatorName}**${input.unit ? ` (단위: ${input.unit})` : ""}
이 지표가 무엇인가: ${input.what}

규칙
- ⚠ **본문에 적힌 것만** 씁니다. 당신이 알고 있는 값을 쓰지 마세요.
- ⚠ 본문에서 찾지 못했으면 \`"found": false\`로 답하세요. 그것이 정답인 경우가 많습니다.
- \`date\`는 **자료의 기준 시점**입니다(발표일이 아닙니다). 월 단위 지표면 그 달의 1일로 씁니다.
- \`quote\`는 그 값이 적힌 문장을 **본문에서 글자 그대로** 옮긴 것입니다. 요약하거나 다듬지 마세요.
  ⚠ 서버가 본문과 대조하므로, 한 글자라도 다르면 버려집니다.
- 값은 숫자만 씁니다(쉼표·단위·% 기호 없이).

--- 본문 시작 ---
${input.pageText}
--- 본문 끝 ---`;
}

function jsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/**
 * 모델 응답 → 후보.
 *
 * ⚠ 어느 단계에서 걸렀는지 **이유를 반드시 돌려준다.** "값이 없다"와 "인용이 가짜다"는
 *   완전히 다른 사실이고, 뒤엣것은 그 제공자를 다시 쓸지 판단하는 근거가 된다.
 */
export function parseExtract(
  raw: string,
  context: { pageText: string; today: string; maxAgeDays?: number },
): ExtractResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock(raw));
  } catch {
    return { ok: false, reason: "JSON으로 읽을 수 없습니다", raw: raw.slice(0, 200) };
  }

  const row = (parsed ?? {}) as Record<string, unknown>;
  if (row.found === false) {
    const why = typeof row.note === "string" && row.note.trim() ? ` — ${row.note.trim()}` : "";
    return { ok: false, reason: `본문에서 값을 찾지 못했습니다${why}` };
  }

  const value = Number(row.value);
  if (!Number.isFinite(value)) return { ok: false, reason: "값이 숫자가 아닙니다" };

  const date = typeof row.date === "string" ? row.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: "기준일이 날짜 형식이 아닙니다" };
  // ⚠ 미래 날짜는 받지 않는다. 관측은 과거에만 존재한다.
  if (date > context.today) return { ok: false, reason: `기준일이 미래입니다(${date})` };

  const maxAge = context.maxAgeDays ?? 400;
  const ageDays = Math.round(
    (Date.parse(`${context.today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
  );
  if (ageDays > maxAge) {
    return { ok: false, reason: `기준일이 ${ageDays}일 전입니다 — 이 페이지의 최신값이 맞는지 보세요` };
  }

  const quote = typeof row.quote === "string" ? row.quote.trim() : "";
  if (quote.length === 0) return { ok: false, reason: "인용문이 없습니다" };

  // ⚠ 이 줄이 이 모듈의 존재 이유다.
  if (!containsQuote(context.pageText, quote)) {
    return { ok: false, reason: "인용문이 원문에 없습니다 — 지어낸 값으로 보고 버립니다", raw: quote.slice(0, 120) };
  }

  // ⚠ 인용문 안에 그 숫자가 실제로 들어 있는지까지 본다.
  //    본문의 아무 문장이나 옮겨 놓고 값만 지어내는 경로를 막는다.
  const digits = String(value).replace(/^-/, "");
  const quoteDigits = quote.replace(/[,\s]/g, "");
  if (!quoteDigits.includes(digits)) {
    return { ok: false, reason: `인용문에 그 숫자(${value})가 없습니다`, raw: quote.slice(0, 120) };
  }

  return {
    ok: true,
    point: {
      value,
      date,
      quote,
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : undefined,
    },
  };
}
