/**
 * 티스토리 블로그 글 목록 — 해석·정렬·분류 규칙. 순수 함수(DB·React·네트워크 없음, CLAUDE.md §1).
 *
 * ## 왜 있나
 * 1순위 목적은 티스토리로 트래픽을 보내는 것이다(CLAUDE.md §5). 그런데 사이트에 블로그 글을 소개하려면
 * 운영자가 **한 편씩 손으로 옮겨** 적어야 했다(2026-09-27 기준 `Post` 7편 중 6편이 그렇게 옮긴 글).
 * 운영자(2026-09-27): 「개별적으로 하니까 유인책이 없는 것 같아요.」 → 블로그 전체를 **자동으로** 목록화한다.
 *
 * ## 어디서 무엇을 읽나 (2026-09-27 실측 — `docs/설계_블로그_목록.md`)
 * - 글 목록: `/sitemap.xml` — 전체 글 주소. ⚠ PC(`/entry/`)와 모바일(`/m/entry/`)이 **둘 다** 있어 두 배로 보인다.
 *   RSS는 최근 10편만 준다(블로그 설정) — 「전체」를 보이려면 사이트맵이어야 한다.
 * - 글 하나: 글 페이지의 `<meta>` — `og:title` · `og:description`(티스토리가 본문 앞 약 400자를 자른 것) ·
 *   `article:published_time` · `og:image`, 그리고 `window.T.entryInfo`의 `entryId`·`categoryLabel`.
 * - 공감 수: `GET /reaction?entryId=N` → `data.reactionCounter.sum`.
 *   ⚠ **GET만 쓴다. `POST /reaction`은 조회가 아니라 공감 누르기다** — 2026-09-27 조사 중 실제로 한 번 눌렸다(entryId 2).
 *
 * ## ⚠ 요약은 지어내지 않는다
 * 자동 요약은 본문 앞을 자른 것이라 글 머리 장식 문구가 붙어 나온다(「2026.09.20 · CRYPTO MARKET크립토 …」).
 * 그렇다고 여기서 문장을 다듬어 「요약」을 만들지 않는다 — 운영자가 관리자 화면에서 쓴 요약(`summaryOverride`)이
 * 있으면 그것을, 없으면 티스토리 것을 **그대로** 쓴다. 규칙은 `displaySummary` 한 곳.
 */

export const UNCATEGORIZED = "미분류";

/** 해석한 글 하나. */
export type ParsedBlogEntry = {
  entryId: number;
  url: string;
  title: string;
  /** 티스토리 자동 요약(본문 앞 약 400자). 없으면 null */
  summary: string | null;
  /** 카테고리 전체 경로(「자산배분 전략/인컴(Income) 자산」). 분류 전이면 null */
  category: string | null;
  /** UTC ISO */
  publishedAt: string;
  thumbnailUrl: string | null;
};

/** 저장된 글 — 화면이 쓰는 모양. */
export type BlogEntry = ParsedBlogEntry & {
  /** 운영자가 쓴 요약. 있으면 자동 요약보다 먼저다 */
  summaryOverride: string | null;
  /** 티스토리 공감 수. ⚠ null은 「0」이 아니라 「못 읽었다」 */
  likes: number | null;
  hidden: boolean;
};

/** 본문에 실제로 나온 이름 붙은 엔티티(2026-09-27 24편 실측 — &rarr; &minus; &hellip; &times; …). `&amp;`는 여기 넣지 않는다(맨 끝에 푼다). */
const NAMED: Record<string, string> = {
  rarr: "→", larr: "←", uarr: "↑", darr: "↓", harr: "↔", minus: "−", hellip: "…", times: "×", divide: "÷",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", bull: "•", deg: "°", plusmn: "±",
  le: "≤", ge: "≥", ne: "≠", trade: "™", copy: "©", reg: "®", frac12: "½", frac14: "¼", frac34: "¾", yen: "¥", euro: "€", pound: "£",
};

/** HTML 엔티티를 푼다 — `<meta content>`에 흔히 나오는 것만. ⚠ `&amp;`는 **맨 마지막**에 푼다(이중 해석 방지). */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole)
    .replaceAll("&mdash;", "—")
    .replaceAll("&ndash;", "–")
    .replaceAll("&middot;", "·")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/**
 * 사이트맵에서 글 주소만 뽑는다.
 * ⚠ 모바일 주소(`/m/entry/`)는 PC 주소와 같은 글이다 — 빼지 않으면 목록이 두 배가 된다.
 * ⚠ 이 블로그(`origin`)의 주소만 받는다 — 목록에 남의 주소가 섞이면 우리가 그리로 보내게 된다.
 */
export function parseSitemapEntries(xml: string, origin: string): string[] {
  const base = origin.replace(/\/+$/, "");
  const out = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = decodeEntities(m[1]);
    if (!url.startsWith(`${base}/entry/`)) continue;
    out.add(url);
  }
  return [...out];
}

function meta(html: string, key: string): string | null {
  // property="…" content="…" 와 name="…" content="…" 둘 다 받는다. 속성 순서가 바뀌어도 읽는다.
  const re = new RegExp(`<meta\\s[^>]*(?:property|name)="${key}"[^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content="([^"]*)"/i)?.[1];
  return content === undefined ? null : decodeEntities(content).trim();
}

export type ParseEntryResult = { ok: true; entry: ParsedBlogEntry } | { ok: false; reason: string };

/**
 * 글 페이지 하나를 해석한다.
 * ⚠ 제목·글 번호·발행일 중 하나라도 없으면 **실패**다 — 빈칸을 지어 채우지 않는다(형식이 바뀌었다는 신호).
 */
export function parseEntryPage(html: string, url: string): ParseEntryResult {
  const infoJson = html.match(/window\.T\.entryInfo\s*=\s*(\{[^;]*?\})\s*;/)?.[1];
  let entryId: number | null = null;
  let category: string | null = null;
  if (infoJson) {
    try {
      const info = JSON.parse(infoJson) as { entryId?: unknown; categoryLabel?: unknown };
      entryId = typeof info.entryId === "number" && Number.isInteger(info.entryId) ? info.entryId : null;
      category = typeof info.categoryLabel === "string" && info.categoryLabel.trim() ? info.categoryLabel.trim() : null;
    } catch {
      return { ok: false, reason: "entryInfo를 JSON으로 읽지 못했다" };
    }
  }
  if (entryId === null) return { ok: false, reason: "글 번호(entryInfo.entryId)가 없다" };

  const title = meta(html, "og:title") ?? meta(html, "title");
  if (!title) return { ok: false, reason: "제목(og:title)이 없다" };

  const published = meta(html, "article:published_time");
  const time = published ? Date.parse(published) : NaN;
  if (!Number.isFinite(time)) return { ok: false, reason: "발행일(article:published_time)이 없거나 읽을 수 없다" };

  // ⭐ 요약은 본문에서 고른다(작가 요약 → 첫 완결 문장). 못 고르면 티스토리 자동 요약을 정리해서(2026-09-27 (80)).
  const og = meta(html, "og:description");
  const summary = articleSummary(html, title) ?? (og ? cleanSummary(og) : null);
  const image = meta(html, "og:image");
  return {
    ok: true,
    entry: {
      entryId,
      url,
      title,
      summary: summary ? summary : null,
      category,
      publishedAt: new Date(time).toISOString(),
      thumbnailUrl: image && image.startsWith("https://") ? image : null,
    },
  };
}

/** 공감 API 응답에서 합계를 읽는다. ⚠ 못 읽으면 null — 0으로 만들지 않는다. */
export function parseReactionSum(json: unknown): number | null {
  const sum = (json as { data?: { reactionCounter?: { sum?: unknown } } })?.data?.reactionCounter?.sum;
  return typeof sum === "number" && Number.isInteger(sum) && sum >= 0 ? sum : null;
}

/**
 * 요약에서 **URL을 뺀다**(2026-09-27 운영자 요청) — 카드 전체가 이미 원문 링크라 요약 속 URL은 누를 수 없는 잡음이고,
 * 띄어쓰기 없는 긴 URL(실측 약 200자)은 모바일 가로 넘침의 원인이었다.
 *
 * ⚠ `https?://\S+`를 그대로 쓰지 않는다 — `https://suhdp.tistory.com/10)에서`처럼 **붙은 한글·닫는 괄호까지** 지운다.
 *   URL은 공백·괄호·따옴표·한글 앞에서 끝난다고 본다. 남은 빈 괄호 `()`와 겹친 공백을 정리한다.
 * ⚠ 저장된 원문(`summary`)은 건드리지 않는다 — 보일 때만 정리한다(원자료 보존).
 */
export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s()<>"'ㄱ-ㆎ가-힣]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ 	]{2,}/g, " ")
    .replace(/\s+([.,)])/g, "$1")
    .trim();
}

/**
 * 화면에 쓸 요약. 운영자 요약이 먼저, 없으면 수집한 요약을 **정리 → 약 140자 문장 단위로 자름**. 둘 다 없으면 null(지어내지 않는다).
 * ⚠ 정리는 화면에서도 한 번 더 한다 — 규칙이 바뀐 뒤 다시 읽기 전의 옛 요약도 같은 모양으로 보이게.
 */
export function displaySummary(entry: Pick<BlogEntry, "summary" | "summaryOverride">): string | null {
  const own = entry.summaryOverride?.trim();
  if (own) return own;
  const auto = entry.summary ? clampSummary(cleanSummary(entry.summary)) : "";
  return auto ? auto : null;
}

/** 카테고리 경로 → [상위, 하위]. 분류 전이면 [「미분류」, null]. */
export function splitCategory(category: string | null): [string, string | null] {
  if (!category) return [UNCATEGORIZED, null];
  const [top, ...rest] = category.split("/").map((s) => s.trim());
  return [top || UNCATEGORIZED, rest.length ? rest.join("/") : null];
}

export type CategoryNode = { name: string; count: number; children: { name: string; count: number }[] };

/**
 * 카테고리 나무 — 상위별 글 수와 하위 목록.
 * ⚠ 정렬은 **글 수가 많은 순**(같으면 이름순)이다. 독자가 가장 많이 읽을 거리부터 보인다.
 * ⚠ 「미분류」는 글 수와 상관없이 **맨 뒤**다 — 분류가 아니라 분류가 없다는 뜻이다.
 */
export function categoryTree(entries: Pick<BlogEntry, "category">[]): CategoryNode[] {
  const map = new Map<string, { count: number; children: Map<string, number> }>();
  for (const e of entries) {
    const [top, sub] = splitCategory(e.category);
    const node = map.get(top) ?? { count: 0, children: new Map<string, number>() };
    node.count += 1;
    if (sub) node.children.set(sub, (node.children.get(sub) ?? 0) + 1);
    map.set(top, node);
  }
  const byCount = (a: { name: string; count: number }, b: { name: string; count: number }) =>
    b.count - a.count || a.name.localeCompare(b.name, "ko");
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      children: [...v.children.entries()].map(([n, c]) => ({ name: n, count: c })).sort(byCount),
    }))
    .sort((a, b) => (a.name === UNCATEGORIZED ? 1 : b.name === UNCATEGORIZED ? -1 : byCount(a, b)));
}

/** 공개할 글만 — 숨김을 빼고 최신순. */
export function visibleEntries<T extends Pick<BlogEntry, "hidden" | "publishedAt">>(entries: T[]): T[] {
  return entries.filter((e) => !e.hidden).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** 카테고리로 거른다. `top`이 없으면 전부, `sub`가 있으면 그 하위만. */
export function filterByCategory<T extends Pick<BlogEntry, "category">>(entries: T[], top?: string | null, sub?: string | null): T[] {
  if (!top) return entries;
  return entries.filter((e) => {
    const [t, s] = splitCategory(e.category);
    return t === top && (!sub || s === sub);
  });
}

/** 인기 글 표시에 필요한 최소 공감 수. ⚠ 0인 글을 「인기」라고 부르지 않는다. */
export const POPULAR_MIN_LIKES = 1;

/**
 * 인기 글 — **티스토리 공감 수**가 많은 순, 같으면 최신순.
 *
 * ## 왜 공감 수인가 (2026-09-27 결정 기록)
 * - 조회수는 공개되지 않는다(티스토리 Open API 종료). 공감은 모든 독자가 남긴 **공개된** 신호다.
 * - 우리 사이트의 클릭(`/go/blog-*`)은 **우리 화면에 놓인 자리**가 만든다 — 홈에 올린 글이 더 눌리고,
 *   그걸로 다시 인기를 정하면 자리가 자리를 정하는 되먹임이 된다. 그래서 순위에 쓰지 않는다.
 * - ⚠ 한계: 2026-09-27 공감 수는 0~4로 작다. 순위가 한두 표에 흔들린다 — 화면에 **「공감 N」을 같이 적어** 근거를 숨기지 않는다.
 * - ⚠ 공감을 못 읽은 글(null)은 순위에서 뺀다 — 「못 읽음」을 0으로 치지 않는다.
 */
export function popularEntries<T extends Pick<BlogEntry, "likes" | "publishedAt" | "hidden">>(entries: T[], limit: number): T[] {
  return entries
    .filter((e) => !e.hidden && e.likes !== null && e.likes >= POPULAR_MIN_LIKES)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** 경유 링크의 대상 키. `/go/blog-<entryId>` — 목적지는 **우리가 저장한 주소**에서만 나온다(`lib/outbound.ts`). */
export const BLOG_TARGET_PREFIX = "blog-";

export function blogTargetKey(entryId: number): string {
  return `${BLOG_TARGET_PREFIX}${entryId}`;
}

/** 대상 키에서 글 번호를 읽는다. 형식이 아니면 null — ⚠ 숫자 말고는 받지 않는다(요청이 준 문자열로 DB를 뒤지지 않게). */
export function parseBlogTarget(target: string): number | null {
  if (!target.startsWith(BLOG_TARGET_PREFIX)) return null;
  const rest = target.slice(BLOG_TARGET_PREFIX.length);
  return /^\d{1,9}$/.test(rest) ? Number(rest) : null;
}

/* ══════════ 본문에서 요약 뽑기 (2026-09-27 (80)) ══════════
 *
 * ## 왜 `og:description`을 버렸나
 * 티스토리 자동 요약은 본문을 **블록 경계 없이** 이어 붙인다 — 「…다시 읽습니다기준일 2026년…」,
 * 「CRYPTO MARKET크립토 시장은…」. 한번 붙은 뒤에는 되살릴 수 없어서, 글 페이지의 **본문 HTML**에서 블록마다 뽑는다.
 *
 * ## 무엇을 먼저 쓰나 (24편 실측 — CHANGELOG (80))
 * 1. **작가가 쓴 요약** — 표지 블록(「한눈에 보기」「한 줄 요약」「3분 요약 …」「1. 한 줄 요약」「Investment Summary」) 다음 블록,
 *    또는 한 블록 안의 「한 줄 요약 — …」「메타 설명: …」. 작가가 독자에게 주려고 쓴 문장이라 가장 낫다.
 * 2. 없으면 **첫 완결 문장들** — 머리표(「2026.09.20 · CRYPTO MARKET」)·제목 반복·URL·도메인 줄·「<그림…>」·「업데이트:」·제목(h1~h6)·
 *    끝나지 않은 조각을 건너뛴다.
 * 3. 그래도 없으면 null — 부르는 쪽이 `og:description`(정리해서)으로 떨어진다.
 * ⚠ 지어내지 않는다 — 고르고 자를 뿐, 문장을 다시 쓰지 않는다.
 */

export type ArticleBlock = { tag: string; text: string };

const BLOCK_TAG = /<\/?(p|div|h[1-6]|li|ul|ol|blockquote|figure|figcaption|table|thead|tbody|tr|td|th|section|article|header|footer|hr)\b[^>]*>/gi;

/** 글 본문 컨테이너를 블록(태그 · 텍스트)으로. ⚠ 블록 경계마다 끊는다 — 붙음을 원천에서 없앤다. */
export function articleBlocks(html: string): ArticleBlock[] {
  const start = html.indexOf('<div class="tt_article_useless_p_margin');
  if (start < 0) return [];
  const endMark = html.indexOf("<!-- System - START -->", start + 10);
  const body = html.slice(start, endMark > 0 ? endMark : undefined).replace(/<br\s*\/?>/gi, " ");
  const out: ArticleBlock[] = [];
  let tag = "div";
  let last = 0;
  const flush = (chunk: string) => {
    // ⚠ 인라인 태그(<b>·<span>…)는 **빈 문자열**로 — 공백으로 바꾸면 「숲</b>입니다」가 「숲 입니다」가 된다(2026-09-27 실측).
    const text = decodeEntities(chunk.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (text) out.push({ tag, text });
  };
  for (const m of body.matchAll(BLOCK_TAG)) {
    flush(body.slice(last, m.index));
    if (!m[0].startsWith("</")) tag = m[1].toLowerCase();
    last = m.index! + m[0].length;
  }
  flush(body.slice(last));
  return out;
}

const LABEL = /^(?:\d+\.\s*)?(?:한눈에 보기|한 줄 요약|핵심 요약|요약|3분 요약.*|Investment Summary|TL;DR)$/i;
const INLINE = /^(?:한 줄 요약|핵심 요약|메타 설명)\s*[:：—–-]\s*(.{20,})$/;
const SENTENCE_END = /(?:[.!?…]|[다요죠까음함임])["'」』)]*$/;
const DATE = /\d{4}\.\d{1,2}\.\d{1,2}/;

/** 머리표 — 「2026.09.20 · CRYPTO MARKET」「CAPITAL FLOW · 2026.09.16 – 09.18」「WOODSMAN · CRYPTO 자본경로 · 2026.09.27」. */
export function isKicker(text: string): boolean {
  if (text.length > 60 || SENTENCE_END.test(text)) return false;
  return DATE.test(text) || /[A-Z]{2,}(?:\s+[A-Z&]{2,})+/.test(text) || /^[A-Z]{3,}\s*·/.test(text);
}

function isSkippable(b: ArticleBlock, title: string): boolean {
  const t = b.text;
  if (/^h[1-6]$/.test(b.tag)) return true;
  if (isKicker(t)) return true;
  if (/^https?:\/\//.test(t) || /^(?:www\.)?[\w-]+(?:\.[\w-]+)+\/?$/.test(t)) return true;
  if (t.startsWith("<")) return true; // 「<그림 1> …」「< Gemini에게 …>」
  if (/^(?:업데이트|수정|기준일|출처|목차)\s*[:：]?/.test(t) && t.length < 80) return true;
  const norm = (s: string) => s.replace(/\s+/g, "");
  if (t.length >= 8 && (norm(title).includes(norm(t)) || norm(t) === norm(title))) return true;
  return false;
}

function isProse(text: string): boolean {
  return text.length >= 25 && SENTENCE_END.test(text) && /[가-힣]/.test(text);
}

/** 앞머리에 남은 머리표를 한 번 더 걷는다(안전망 — `og:description` 폴백에도 쓴다). */
export function stripKicker(text: string): string {
  let s = text.trim();
  for (let i = 0; i < 3; i += 1) {
    const next = s
      .replace(/^[A-Z][A-Z &]+(?:\s*·\s*[^·]{1,24}?)?\s*·\s*\d{4}\.\d{1,2}\.\d{1,2}(?:\s*[–-]\s*\d{1,2}\.\d{1,2})?\s*/, "")
      .replace(/^\d{4}\.\d{1,2}\.\d{1,2}\s*·\s*[A-Z][A-Z &]+(?=[가-힣\s])\s*/, "")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 요약 문장 정리 — URL 제거 · 머리표 제거 · 공백. */
export function cleanSummary(text: string): string {
  let s = stripKicker(stripUrls(decodeEntities(text)))
    .replace(/^[-–·•]\s*/, "")
    .replace(/\s+([.,!?)」』])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  // 끝에 끝나지 않은 조각이 붙어 있으면(「…달라집니다 레버」) 마지막 문장 끝에서 자른다 — 앞 절반 이상이 남을 때만.
  if (!SENTENCE_END.test(s)) {
    const ends = [...s.matchAll(/(?:[.!?…]|[다요죠](?=\s))/g)].map((m) => m.index! + m[0].length);
    const last = ends.at(-1);
    if (last && last >= s.length * 0.5) s = s.slice(0, last).trim();
  }
  return s;
}

/** 본문에서 요약을 고른다(위 규칙). 못 고르면 null. */
export function articleSummary(html: string, title: string): string | null {
  const blocks = articleBlocks(html);
  const head = blocks.slice(0, 30);

  for (let i = 0; i < head.length; i += 1) {
    const t = head[i].text;
    const inline = INLINE.exec(t);
    if (inline) return cleanSummary(inline[1]);
    if (LABEL.test(t)) {
      const picked: string[] = [];
      for (const b of head.slice(i + 1)) {
        if (/^h[1-6]$/.test(b.tag) || LABEL.test(b.text)) break;
        picked.push(b.text);
        if (picked.join(" ").length >= 80 || picked.length >= 3) break;
      }
      const s = cleanSummary(picked.join(" "));
      if (s.length >= 20) return s;
    }
  }

  const picked: string[] = [];
  for (const b of blocks.slice(0, 40)) {
    if (isSkippable(b, title)) {
      if (picked.length) break;
      continue;
    }
    if (!isProse(b.text)) {
      if (picked.join(" ").length >= 40) break;
      continue;
    }
    picked.push(b.text);
    if (picked.join(" ").length >= 120) break;
  }
  const s = cleanSummary(picked.join(" "));
  return s.length >= 20 ? s : null;
}

/** 요약 길이 — 약 140자에서 **문장 단위로** 자르고 「…」. ⚠ CSS line-clamp는 눈에만 자르고 스크린리더는 400자를 다 읽는다. */
export const SUMMARY_MAX = 140;

export function clampSummary(text: string, max = SUMMARY_MAX): string {
  if (text.length <= max + 10) return text;
  const window = text.slice(0, max + 10);
  let cut = -1;
  for (const m of window.matchAll(/(?:[.!?…]|[다요죠]\.)(?=\s|$)/g)) {
    const end = m.index! + m[0].length;
    if (end >= 60) cut = end;
  }
  if (cut > 0) return `${text.slice(0, cut).trim()} …`;
  const space = text.lastIndexOf(" ", max);
  return `${text.slice(0, space > 60 ? space : max).trim()}…`;
}
