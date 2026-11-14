/**
 * 인사이트 AI 초안 — 재료(파도 기사 · 최근 블로그 · 브리핑 · 조류 사실표) → 프롬프트 → **서버 대조** → 발행용 본문. 순수 함수.
 *
 * ## 왜 있나 (2026-11-14 · v3)
 * 운영자: 「파도 기사와 최근 블로그, 포털 데이터를 조합해 인사이트 후보를 만들어 올려 줘요 · 승인하면 송출」 ·
 * 「인사이트가 갱신되지 않아서 자동으로」 · 「브리핑도 일부 참조」.
 * 운영자 결정(같은 날): **공개는 주 2~3편**(초안은 매일 쌓아도 된다) · **운영자가 「Woodsman의 시각」 한 문단을 보태야 발행**.
 *
 * ## ⚠ 지키는 것
 * - 9/27 원칙(「인사이트는 골라 올린 글」)을 이렇게 다시 세웠다: AI가 초안을 쌓고, **운영자가 골라 한 문단을 보태 올린다**.
 * - 애드센스 「가치가 별로 없는 콘텐츠」 거절이 계기다 — 재료를 엮기만 한 글은 그 자체로 저품질이다. 그래서 운영자 문단이 발행 조건이다.
 * - **숫자·날짜는 재료에 있는 것만.** 링크는 재료로 받은 주소만(블로그는 `/go/blog-<번호>` 경유 — 1순위 지표).
 * - 티스토리 글은 **옮기지 않는다**(canonical) — 제목·한 줄 요약으로 부르고 링크한다.
 * - 매매 권유·방향 단정·내부 용어는 실패.
 */

export const INSIGHT_PROMPT_VERSION = "insight-draft-v1";

export type InsightNews = { id: string; source: string; title: string; url: string; publishedAt: string; summary?: string | null };
export type InsightBlog = { entryId: number; title: string; summary: string | null; publishedAt: string };
export type InsightBriefing = { date: string; headline: string; summary: string[] };
export type InsightFact = { id: string; label: string; text: string };

export type InsightInput = {
  /** 서울 날짜 YYYY-MM-DD */
  today: string;
  news: InsightNews[];
  blogs: InsightBlog[];
  briefing?: InsightBriefing;
  /** 조류 사실표(`lib/gcrm/commentary.buildFacts`) — 없으면 빈 배열 */
  facts: InsightFact[];
};

export type InsightDraftBody = {
  title: string;
  lede: string;
  sections: { heading: string; body: string }[];
  /** 본문이 부른 블로그 글 번호(0~2) */
  blogIds: number[];
  /** 본문이 부른 기사 id(1~4) */
  newsIds: string[];
};

export const blogHref = (entryId: number) => `/go/blog-${entryId}`;

/** 프롬프트에 들어가는 재료 전체 — 대조 기준이기도 하다. */
export function sourceText(input: InsightInput): string {
  const lines: string[] = [`오늘: ${input.today}`];
  for (const n of input.news)
    lines.push(`[기사 ${n.id}] ${n.publishedAt.slice(0, 10)} · ${n.source} · ${n.title}${n.summary ? ` — ${n.summary}` : ""}`);
  for (const b of input.blogs)
    lines.push(`[블로그 ${b.entryId}] ${b.publishedAt.slice(0, 10)} · ${b.title}${b.summary ? ` — ${b.summary}` : ""}`);
  if (input.briefing)
    lines.push(`[브리핑 ${input.briefing.date}] ${input.briefing.headline} — ${input.briefing.summary.join(" / ")}`);
  for (const f of input.facts) lines.push(`[조류 ${f.id}] ${f.label}: ${f.text}`);
  return lines.join("\n");
}

export function buildInsightPrompt(input: InsightInput): string {
  return `WoodsMan 포털의 「인사이트」 초안을 한 편 써 주세요. 운영자가 읽고 고친 뒤 자기 시각 한 문단을 보태 올립니다.
독자는 투자를 시작한 지 2년쯤 된 개인 투자자입니다. 「이번 주 무엇이 있었고, 그것이 내 자산의 흐름(조류·바람)에 무슨 뜻인가」를 알고 싶어 합니다.

== 무엇을 쓰나 ==
- 아래 재료에서 **하나의 주제**를 고릅니다. 기사 여러 개를 나열하지 말고, 한 질문으로 묶으십시오
  (예: "연준 인사들이 이번 주 말한 것과 조류 점수가 가리키는 것은 같은 방향인가").
- 재료의 사실을 먼저, 해석은 그다음, 확인할 조건은 마지막에.
- 블로그 글은 **옮기지 말고** 제목으로 부르고 blogIds에 번호를 넣습니다(본문 링크는 서버가 붙입니다). 관련 있을 때만, 최대 2편.
- 브리핑은 참고만 합니다. 브리핑 문장을 그대로 옮기지 마십시오.

== 규칙 ==
- 재료에 없는 숫자·날짜·사건·인과를 쓰지 않습니다. 서버가 모든 숫자와 날짜를 재료와 대조하고, 하나라도 없으면 초안을 버립니다.
- 원인을 재료가 말하지 않으면 "무엇 때문인지는 이 자료만으로 알 수 없습니다"라고 씁니다.
- 영어 기관 문서 제목은 뜻을 한국어로 풀고, 기관 이름은 그대로 둡니다.
- 매수·매도·비중 조절을 권하지 않습니다. 가격 방향을 단정하지 않습니다.
- 내부 용어(기둥 · 발행 · 커버리지)를 쓰지 않습니다. 조류는 첫 등장에 「조류(1~12개월 흐름)」.
- 「~입니다/~합니다」체. 과장 표현(급등 · 폭락 · 심각한)과 느낌표를 쓰지 않습니다.
- 분량: lede와 sections 합계 공백 포함 900~1,600자. sections는 2~3개, 각 소제목은 짧게.

== 출력 — JSON 하나 ==
{
  "title": "40자 안팎, 낚시성 금지",
  "lede": "2~3문장 — 이 글이 답하는 질문과 짧은 답",
  "sections": [{ "heading": "소제목", "body": "문단(마크다운 문단만, 표·링크·이미지 없음)" }],
  "blogIds": [블로그 번호],
  "newsIds": ["기사 id 1~4개"]
}

== 재료 ==
${sourceText(input)}`;
}

const FORBIDDEN = /(매수|매도|사세요|파세요|팔아야|사야|비중을 늘|비중을 줄|목표주가|목표가|지금이 기회|반드시 오른|반드시 내린)/;
const STYLE_BANNED = /(사료된다|제반 여건|급등|폭락|심각한|!)/;
const INTERNAL_TERMS = /(기둥|커버리지|INSUFFICIENT|pillar)/i;
const LINKY = /(https?:\/\/|\]\(|<a\s|!\[)/i;

export const INSIGHT_MIN = 700;
export const INSIGHT_MAX = 2000;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = trimmed.indexOf("{");
  const b = trimmed.lastIndexOf("}");
  if (a < 0 || b <= a) return undefined;
  try {
    return JSON.parse(trimmed.slice(a, b + 1));
  } catch {
    return undefined;
  }
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** 재료에 있는 숫자·날짜(대조 기준). 기간 표현(1~12개월 등)은 용어 설명용으로 허용. */
export function allowedInsightTokens(input: InsightInput) {
  const text = `${sourceText(input)}\n조류(1~12개월 흐름) 바람(1~13주) 파도(1~5일) 0~100`;
  const dates = new Set(text.match(/\d{4}-\d{2}-\d{2}/g) ?? []);
  const numbers = new Set<number>();
  for (const n of text.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:[.,]\d+)?/g) ?? [])
    numbers.add(Math.abs(Number(n.replace(",", ""))));
  // 날짜의 연·월·일 조각(「11월 13일」 「2026년」)도 허용한다 — 재료에 있는 날짜에서만
  for (const d of dates) for (const part of d.split("-")) numbers.add(Number(part));
  return { numbers, dates };
}

export function verifyInsightDraft(
  raw: string,
  input: InsightInput,
): { ok: true; body: InsightDraftBody } | { ok: false; problems: string[] } {
  const o = extractJson(raw) as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return { ok: false, problems: ["JSON으로 읽지 못했습니다."] };
  const problems: string[] = [];

  const title = isStr(o.title) ? o.title.trim() : "";
  if (!title) problems.push("제목이 비었습니다.");
  else if (title.length > 70) problems.push(`제목이 깁니다(${title.length}자).`);
  const lede = isStr(o.lede) ? o.lede.trim() : "";
  if (!lede) problems.push("리드(lede)가 비었습니다.");
  const sections = Array.isArray(o.sections)
    ? o.sections
        .map((s) => s as Record<string, unknown>)
        .filter((s) => isStr(s?.heading) && isStr(s?.body))
        .map((s) => ({ heading: (s.heading as string).trim(), body: (s.body as string).trim() }))
    : [];
  if (sections.length < 2 || sections.length > 3) problems.push(`소제목 문단은 2~3개여야 합니다(${sections.length}).`);

  const blogSet = new Set(input.blogs.map((b) => b.entryId));
  const blogIds = Array.isArray(o.blogIds) ? o.blogIds.filter((x): x is number => typeof x === "number") : [];
  if (blogIds.length > 2) problems.push("블로그는 최대 2편입니다.");
  const badBlog = blogIds.filter((id) => !blogSet.has(id));
  if (badBlog.length) problems.push(`재료에 없는 블로그 번호: ${badBlog.join(", ")}`);

  const newsSet = new Set(input.news.map((n) => n.id));
  const newsIds = Array.isArray(o.newsIds) ? o.newsIds.filter(isStr) : [];
  if (newsIds.length < 1 || newsIds.length > 4) problems.push("기사는 1~4개를 불러야 합니다.");
  const badNews = newsIds.filter((id) => !newsSet.has(id));
  if (badNews.length) problems.push(`재료에 없는 기사 id: ${badNews.join(", ")}`);

  const texts = [title, lede, ...sections.flatMap((s) => [s.heading, s.body])];
  const len = [lede, ...sections.map((s) => s.body)].join("").length;
  if (len < INSIGHT_MIN || len > INSIGHT_MAX) problems.push(`본문 길이 ${len}자 — ${INSIGHT_MIN}~${INSIGHT_MAX}자를 벗어났습니다(목표 900~1,600자).`);

  const { numbers, dates } = allowedInsightTokens(input);
  const strayN = new Set<string>();
  const strayD = new Set<string>();
  for (const t of texts) {
    for (const d of t.match(/\d{4}-\d{2}-\d{2}/g) ?? []) if (!dates.has(d)) strayD.add(d);
    for (const n of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:[.,]\d+)?/g) ?? [])
      if (!numbers.has(Math.abs(Number(n.replace(",", ""))))) strayN.add(n);
    const f = t.match(FORBIDDEN);
    if (f) problems.push(`권유·단정 표현: 「${f[0]}」`);
    const st = t.match(STYLE_BANNED);
    if (st) problems.push(`쓰지 않기로 한 표현: 「${st[0]}」`);
    const it = t.match(INTERNAL_TERMS);
    if (it) problems.push(`내부 용어: 「${it[0]}」`);
    if (LINKY.test(t)) problems.push("본문에 링크·이미지를 직접 넣지 않습니다(서버가 붙입니다).");
  }
  if (strayN.size) problems.push(`재료에 없는 숫자: ${[...strayN].join(", ")}`);
  if (strayD.size) problems.push(`재료에 없는 날짜: ${[...strayD].join(", ")}`);

  if (problems.length) return { ok: false, problems: [...new Set(problems)] };
  return { ok: true, body: { title, lede, sections, blogIds, newsIds } };
}

/** 운영자 문단 최소 길이 — 한 문단다운 길이(운영자 결정 「한 문단 보태기」). */
export const OPERATOR_NOTE_MIN = 80;

/**
 * 발행용 마크다운 — AI 본문 + 「Woodsman의 시각」(운영자) + 참고한 자료(기사 원문 · 블로그는 `/go` 경유) + 작성 고지.
 * ⚠ 운영자 문단이 없으면 만들지 않는다(null).
 */
/** AI 초안의 본문 부분(리드 + 소제목 문단) — 운영자가 고치는 칸의 처음 값 */
export function draftMainMarkdown(body: InsightDraftBody): string {
  return [body.lede, ...body.sections.map((s) => `## ${s.heading}\n\n${s.body}`)].join("\n\n");
}

/**
 * @param mainMarkdown 운영자가 고친 본문(없으면 AI 초안 그대로)
 */
export function composeInsightMarkdown(
  body: InsightDraftBody,
  input: InsightInput,
  operatorNote: string,
  mainMarkdown?: string,
): string | null {
  const note = operatorNote.trim();
  if (note.length < OPERATOR_NOTE_MIN) return null;
  const main = mainMarkdown?.trim() || draftMainMarkdown(body);
  const news = body.newsIds.map((id) => input.news.find((n) => n.id === id)).filter((n): n is InsightNews => !!n);
  const blogs = body.blogIds.map((id) => input.blogs.find((b) => b.entryId === id)).filter((b): b is InsightBlog => !!b);
  const esc = (s: string) => s.replace(/[[\]]/g, "");
  const parts = [
    main,
    `## Woodsman의 시각\n\n${note}`,
    [
      "## 참고한 자료",
      ...news.map((n) => `- [${esc(n.title)}](${n.url}) · ${n.source} · ${n.publishedAt.slice(0, 10)}`),
      ...blogs.map((b) => `- 블로그: [${esc(b.title)}](${blogHref(b.entryId)})`),
      ...(input.briefing ? [`- [오늘의 브리핑 ${input.briefing.date}](/briefing/${input.briefing.date})`] : []),
    ].join("\n"),
    "---\n\n*이 글은 포털의 기사·지표·블로그 자료로 AI가 쓴 초안을 운영자가 편집하고 시각을 보태 올렸습니다. 숫자는 위 자료에 있는 값만 썼습니다. 투자 권유가 아닙니다.*",
  ];
  return parts.join("\n\n");
}
