/**
 * 「오늘의 브리핑」 원고 → 공개용 기사 — 순수 함수 (2026-10-31).
 *
 * ## 무엇을 하나
 * 볼트에서 만든 아침 브리핑 원고(`briefing/YYYY-MM-DD.md`, 같은 이름의 `.html`)를 받아
 * **독자가 읽는 기사 틀**로 옮긴다. 운영자 요청(10/31):
 * - 「SNS 출처는 제거하고 공식적인 출처만」
 * - 「기자가 자연스럽게 작성한 글처럼」
 * - 「5. 채널 평가」·「역할 조정 제안」은 웹에서 뺀다(채널 운영자와의 마찰 · 내부 운영 기록)
 *
 * ## ⚠ 규칙이 먼저, AI는 그 다음
 * SNS 출처를 지우는 일은 **여기서 규칙으로** 한다. AI 재편집(`rewrite.ts`)은 이 결과만 받는다 —
 * 지워야 할 것을 AI가 지우게 두면 날마다 결과가 다르고 테스트로 지킬 수 없다.
 * 마지막 관문은 `snsResidue` — 하나라도 남으면 저장하지 않는다(조용히 새지 않게).
 *
 * ## 문장 단위로 거른다
 * 출처가 SNS **뿐인** 문장은 뺀다(사실이 SNS에서만 왔다). 공식 출처도 함께 붙은 문장은 SNS 꼬리표만 지운다.
 * 「지지 단서입니다.」처럼 뒤 문장을 다 잃은 머리말만 남으면 그 문단을 뺀다.
 *
 * ## 화면에 HTML을 꽂지 않는다
 * 결과는 **구조(JSON)** 다. 화면은 React로 그린다 — 원고에 섞인 HTML이 그대로 실릴 길이 없다.
 */

export type BriefingBlock =
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  /** 「확인할 것」 — 다음에 볼 것 한 줄 */
  | { t: "watch"; text: string }
  /** 그 절의 출처(공식만) */
  | { t: "src"; items: string[] };

export type BriefingSection = { title: string; blocks: BriefingBlock[] };

export type BriefingArticle = {
  /** YYYY-MM-DD */
  date: string;
  /** 제목 — 원고의 한 줄 요약 */
  headline: string;
  /** 리드 — 원고의 3줄 요약 */
  summary: string[];
  /** 값의 기준 시각 안내 */
  basis: string[];
  sections: BriefingSection[];
  /** 맺음 한 줄 */
  closing?: string;
  /** 공식 출처 묶음(발표·보도·시세) */
  sources: string[];
  /** AI 활용 고지 · 투자 유의사항 */
  notices: string[];
};

/**
 * ⚠ AI 활용 고지는 **지우지 않는다** — 문구만 공개용으로 바꾼다.
 * 고지가 없으면 사람이 직접 취재한 기사로 읽힌다(애드센스 기만 정책 · AI 생성물 표시).
 * 「텔레그램 채널과 X 게시물」 대신 「온라인 게시물」 — 출처 이름을 빼되 사실은 그대로 말한다.
 */
export const AI_NOTICE =
  "AI 활용 고지 — 이 글은 공개된 발표·보도·시세 자료와 온라인 게시물을 AI가 모아 요약하고 정리한 것입니다. 수치는 표시한 출처 기준입니다.";

const DEFAULT_RISK_NOTICE =
  "투자 유의사항 — 본 글은 시장 구조 분석을 위한 연구 노트이며 특정 자산의 매수·매도를 권유하지 않습니다. 투자 판단과 그 결과의 책임은 투자자 본인에게 있습니다.";

// ─── SNS 판별 ─────────────────────────────────────────────

/** SNS 흔적 — 텔레그램·X 주소, X 꼬리표, 채널 글 번호(`채널 #1234`). */
const SNS_PATTERNS = [
  /t\.me\//i,
  /(?:^|[^a-z])x\.com\//i,
  /twitter\.com\//i,
  /\[X:@/,
  /#\d{3,}/,
  /텔레그램/,
  /\bTG \d/,
];

/** 공식 출처 꼬리표 — 이것이 붙은 문장은 SNS 꼬리표만 지우고 남긴다. */
const OFFICIAL_TAG = /\[(?:발표|뉴스|시세|리서치):[^\]]+\]/;

export function hasSns(text: string): boolean {
  return SNS_PATTERNS.some((p) => p.test(text));
}

/** SNS 꼬리표·괄호만 지운다(문장은 남긴다). */
function stripSnsBits(text: string): string {
  return text
    .replace(/\s*\[X:@[^\]]*\]/g, "")
    .replace(/\s*\[[^[\]]*#\d{3,}[^[\]]*\]/g, "")
    .replace(/\s*\([^()]*(?:#\d{3,}|t\.me\/|x\.com\/|twitter\.com\/)[^()]*\)/gi, "")
    .trim();
}

/** 문단 끝의 판정 꼬리표(`[사실]`, `[사실](2차)`, `[해석]`, `[미확인]`). */
const TRAILING_LABEL = /\s*\[(사실|해석|미확인)\](\(2차\))?\s*$/;
const LEAD_IN = /^(지지|반박) 단서입니다\.$/;

/**
 * 한 문단을 문장 단위로 거른다. 남는 것이 없으면 `null`.
 * ⚠ 판정 꼬리표는 문단 전체의 것이라 떼어 두었다가 다시 붙인다(기자 문체 변환은 `journalize`).
 */
export function filterParagraph(text: string): string | null {
  const label = TRAILING_LABEL.exec(text);
  const body = label ? text.slice(0, label.index) : text;

  const kept: string[] = [];
  for (const sentence of body.split(/(?<=[.!?])\s+/)) {
    const s = sentence.trim();
    if (!s) continue;
    if (hasSns(s)) {
      if (!OFFICIAL_TAG.test(s)) continue; // 출처가 SNS뿐이다
      const stripped = stripSnsBits(s);
      if (stripped && !hasSns(stripped)) kept.push(stripped);
      continue;
    }
    kept.push(s);
  }
  if (kept.length === 0 || kept.every((s) => LEAD_IN.test(s))) return null;
  return kept.join(" ") + (label ? ` ${label[0].trim()}` : "");
}

// ─── 기자 문체 ────────────────────────────────────────────

/**
 * 내부 표기를 기사 표기로. `[발표:댈러스 연은]` → `(댈러스 연은)`, `[사실]`·`[해석]`·`(2차)`는 지운다,
 * `[미확인]` → `(미확인)` — ⚠ 확인 안 된 것을 사실처럼 쓰지 않는다. 그 표시만은 남긴다.
 */
export function journalize(text: string): string {
  return text
    .replace(/\s*\[데스크:[^\]]+\](\([^)]*\))?/g, "")
    .replace(/\s*\[(?:발표|뉴스|시세|리서치):([^\]]+)\](?!\()/g, "($1)")
    .replace(/\s*\[(사실|해석)\](\(2차\))?/g, "")
    .replace(/\s*\[미확인\]/g, " (미확인)")
    .replace(/\s*\[계산\]/g, "")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 출처 줄 표기 — `[뉴스:NBC·IBD](인텔·SOX, 10/30)` → `NBC·IBD(인텔·SOX, 10/30)`. */
function sourceLine(text: string): string {
  return text
    .replace(/\[(?:발표|뉴스|시세|리서치):([^\]]+)\]/g, "$1")
    .replace(/\s*\[계산\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

// ─── 원고 읽기 ────────────────────────────────────────────

/** 버리는 절 — 채널 평가는 내부 운영 기록이다(운영자 10/31). */
const DROP_SECTION = /채널 평가/;
/** 버리는 소제목 — 내부 검증 칸이거나 SNS 비교다. */
const DROP_SUB = /^(타당성|데스크 대조|사실 충돌|역할 조정|H-후보)/;
/** 문단으로 녹이는 소제목 — 기사에서는 제목 없이 이어진다. */
const MERGE_SUB = /^(핵심|글의 방향|투자 방향)$/;
const WATCH_SUB = /^확인할 것$/;
/** 공개 출처 묶음에서 남기는 머리 — 발표·보도·시세만. */
const KEEP_SOURCE_HEAD = /^\*\*(발표|보도|시세·데이터)\*\*/;

function cleanTitle(title: string): string {
  return title
    .replace(/^\d+\.\s*/, "")
    .replace(/^\[([^\]]+)\]/, "$1")
    .trim();
}

function cleanSub(text: string): string {
  const h = /^H\d+\((.+)\)$/.exec(text.trim());
  return h ? h[1] : text.trim();
}

type Fence = { name: string; title: string; lines: string[] };

/**
 * 마크다운 원고 → 공개용 기사.
 * ⚠ 날짜는 원고에서 읽지 않고 받는다 — 파일 이름(관리자가 고른 날)이 정본이다.
 */
export function parseBriefingMarkdown(md: string, date: string): BriefingArticle {
  const lines = md.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n?/g, "\n").split("\n");

  const article: BriefingArticle = {
    date,
    headline: "",
    summary: [],
    basis: [],
    sections: [],
    sources: [],
    notices: [],
  };

  let section: BriefingSection | null = null;
  let dropSection = false;
  /** 지금 소제목 상태 — drop이면 다음 소제목까지 버린다 */
  let sub: "keep" | "drop" | "watch" = "keep";
  let fence: Fence | null = null;
  let para: string[] = [];
  let table: string[][] = [];
  let list: string[] = [];

  const push = (block: BriefingBlock) => {
    if (section && !dropSection && sub !== "drop") section.blocks.push(block);
  };
  const flushPara = () => {
    if (para.length === 0) return;
    const raw = para.join(" ");
    para = [];
    if (/^H\d+(·H\d+)*\s*—/.test(raw)) return; // 「H2·H3·H4 — 새 단서가 없습니다」 같은 내부 줄
    const kept = filterParagraph(raw);
    if (!kept) return;
    push(sub === "watch" ? { t: "watch", text: journalize(kept) } : { t: "p", text: journalize(kept) });
  };
  const flushList = () => {
    if (list.length === 0) return;
    const items = list.map(filterParagraph).filter((x): x is string => !!x).map(journalize);
    list = [];
    if (items.length) push({ t: "ul", items });
  };
  const flushTable = () => {
    if (table.length === 0) return;
    const rows = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
    table = [];
    if (rows.length < 2) return;
    const [head, ...body] = rows;
    const kept = body.filter((r) => !hasSns(r.join(" ")));
    if (kept.length) push({ t: "table", head, rows: kept });
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  const closeFence = (f: Fence) => {
    const text = f.lines.join("\n").trim();
    const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
    switch (f.name) {
      case "meta": {
        // 첫 문단은 「기준일 … · 기간 … · TG … · X … · 세부 …」 — 기준일·기간만 남긴다.
        const [first, ...rest] = paras;
        if (first) {
          const parts = first.split(" · ").filter((p) => /^(기준일|기간)/.test(p.trim()));
          if (parts.length) article.basis.push(parts.join(" · "));
        }
        // 「이 브리핑은 … 채널에 올라온 이야기에서 …」는 내부 설명이다 — 투자 유의사항이 대신한다.
        for (const p of rest) if (!/채널|브리핑은 매수/.test(p) && !hasSns(p)) article.basis.push(p);
        break;
      }
      case "oneline":
        article.headline = journalize(paras.join(" "));
        break;
      case "summary":
        article.summary = text
          .split("\n")
          .map((l) => l.replace(/^\d+\.\s*/, "").trim())
          .filter((l) => l && !hasSns(l))
          .map(journalize);
        break;
      case "closing":
        article.closing = journalize(paras.join(" "));
        break;
      case "source": {
        const items = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !hasSns(l))
          .map(sourceLine)
          .filter(Boolean);
        if (items.length) push({ t: "src", items });
        break;
      }
      case "small": {
        for (const p of paras) {
          if (/^\*\*AI 활용 고지\*\*/.test(p)) article.notices.push(AI_NOTICE);
          else if (/^\*\*투자 유의사항\*\*/.test(p)) article.notices.push(sourceLine(p));
          else if (KEEP_SOURCE_HEAD.test(p) && !hasSns(p)) article.sources.push(sourceLine(p));
        }
        break;
      }
      // legend(내부 표기 규칙) · cards(채널 제안) · sign — 기사에 싣지 않는다
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (fence) {
      if (line.trim() === ":::") {
        if (!dropSection && sub !== "drop") closeFence(fence);
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    const open = /^:::(\w+)\s*(.*)$/.exec(line.trim());
    if (open) {
      flushAll();
      fence = { name: open[1], title: open[2], lines: [] };
      continue;
    }

    if (/^## /.test(line)) {
      flushAll();
      const title = line.slice(3).trim();
      dropSection = DROP_SECTION.test(title);
      sub = "keep";
      section = /^출처$/.test(title) || dropSection ? null : { title: cleanTitle(title), blocks: [] };
      if (section) article.sections.push(section);
      continue;
    }
    if (/^# /.test(line) || /^WOODSMAN ·/.test(line)) continue;

    if (/^### /.test(line)) {
      flushAll();
      const text = line.slice(4).trim();
      if (DROP_SUB.test(text)) sub = "drop";
      else if (WATCH_SUB.test(text)) sub = "watch";
      else {
        sub = "keep";
        if (!MERGE_SUB.test(text)) push({ t: "h3", text: cleanSub(text) });
      }
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushAll();
      continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      flushPara();
      flushList();
      table.push(line.trim().slice(1, -1).split("|").map((c) => c.trim()));
      continue;
    }
    if (/^- /.test(line.trim())) {
      flushPara();
      flushTable();
      list.push(line.trim().slice(2));
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushList();
    flushTable();
    para.push(line.trim());
  }
  flushAll();

  // 빈 절 · 내용 없는 소제목은 걷어 내고, 출처는 절 끝에 한 묶음으로 모은다(기사 중간에 끼지 않게)
  article.sections = article.sections
    .map((s) => {
      const body = s.blocks
        .filter((b) => b.t !== "src")
        .filter((b, i, arr) => b.t !== "h3" || (arr[i + 1] && arr[i + 1].t !== "h3"));
      const srcItems = s.blocks.flatMap((b) => (b.t === "src" ? b.items : []));
      return { ...s, blocks: srcItems.length ? [...body, { t: "src" as const, items: srcItems }] : body };
    })
    .filter((s) => s.blocks.some((b) => b.t !== "h3" && b.t !== "src"));

  if (!article.notices.includes(AI_NOTICE)) article.notices.unshift(AI_NOTICE);
  if (!article.notices.some((n) => n.startsWith("투자 유의사항"))) article.notices.push(DEFAULT_RISK_NOTICE);
  return article;
}

// ─── HTML 원고 ────────────────────────────────────────────

/** 기사 칸 이름 — HTML에서는 소제목이 굵은 글씨 문단으로 온다. 이 이름이면 소제목으로 본다. */
const SUB_LABELS =
  /^(핵심|타당성 · .+|데스크 대조|글의 방향|투자 방향|확인할 것|사실 충돌|역할 조정 제안.*|H\d+\(.+\)|H-후보)$/;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

const textOf = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/**
 * HTML 원고(티스토리용 완성본) → 마크다운 원고 꼴. 그다음은 `parseBriefingMarkdown`이 같은 규칙으로 거른다.
 * ⚠ HTML은 마크다운보다 정보가 적다(울타리 블록이 없다) — 한 줄 요약·3줄 요약은 머리 글자로 알아본다.
 */
export function briefingHtmlToMarkdown(html: string): string {
  const body = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, " ");
  const out: string[] = [];
  let pending: "oneline" | "summary" | null = null;
  let summary: string[] = [];
  const closeSummary = () => {
    if (pending === "summary" && summary.length) out.push(":::summary", ...summary, ":::", "");
    summary = [];
  };

  const re = /<(h2|h3|p|li|tr|hr)\b[^>]*>([\s\S]*?)(?=<\/?(?:h2|h3|p|li|tr|hr|table|ul|ol|div)\b|$)/gi;
  for (const m of body.matchAll(re)) {
    const tag = m[1].toLowerCase();
    if (tag === "hr") {
      closeSummary();
      pending = null;
      out.push("---", "");
      continue;
    }
    if (tag === "tr") {
      const cells = [...m[2].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => textOf(c[1]));
      if (cells.length) out.push(`| ${cells.join(" | ")} |`);
      continue;
    }
    const text = textOf(m[2]);
    if (!text) continue;

    if (tag === "h2") {
      closeSummary();
      pending = null;
      out.push("", `## ${text}`, "");
      continue;
    }
    if (tag === "h3" || SUB_LABELS.test(text)) {
      closeSummary();
      pending = null;
      out.push(`### ${text}`);
      continue;
    }
    if (tag === "li") {
      out.push(`- ${text}`);
      continue;
    }
    if (text === "한 줄 요약") {
      pending = "oneline";
      continue;
    }
    if (text === "3줄 요약") {
      pending = "summary";
      continue;
    }
    if (pending === "oneline") {
      out.push(":::oneline", text, ":::", "");
      pending = null;
      continue;
    }
    if (pending === "summary" && /^\d+\.\s/.test(text)) {
      summary.push(text);
      continue;
    }
    closeSummary();
    pending = null;
    if (/^기준일 /.test(text)) {
      out.push(":::meta", text, ":::", "");
      continue;
    }
    // 출처 줄(괄호로 시작하거나 꼬리표로 시작) → 출처 울타리
    if (/^\(.+\)$/.test(text) || /^\[(?:발표|뉴스|시세|리서치):/.test(text)) {
      out.push(":::source", text, ":::", "");
      continue;
    }
    if (/^(AI 활용 고지|투자 유의사항|발표|보도|시세·데이터|텔레그램|X|데스크|수집 원본) — /.test(text)) {
      const [head, ...rest] = text.split(" — ");
      out.push(":::small", `**${head}** — ${rest.join(" — ")}`, ":::", "");
      continue;
    }
    out.push(text, "");
  }
  closeSummary();
  return out.join("\n");
}

// ─── 관문 ─────────────────────────────────────────────────

/** 공개본에 SNS 흔적이 남았는가 — 남은 조각을 돌려준다. ⚠ 하나라도 있으면 저장하지 않는다. */
export function snsResidue(article: BriefingArticle): string[] {
  const texts: string[] = [article.headline, ...article.summary, ...article.basis, ...article.sources];
  if (article.closing) texts.push(article.closing);
  for (const s of article.sections) {
    texts.push(s.title);
    for (const b of s.blocks) {
      if (b.t === "p" || b.t === "h3" || b.t === "watch") texts.push(b.text);
      else if (b.t === "ul" || b.t === "src") texts.push(...b.items);
      else texts.push(...b.head, ...b.rows.flat());
    }
  }
  return texts.filter(hasSns);
}

/** 기사 전체의 글자(숫자 대조·미리보기용). */
export function articleText(article: BriefingArticle): string {
  const parts: string[] = [article.headline, ...article.summary];
  for (const s of article.sections) {
    parts.push(s.title);
    for (const b of s.blocks) {
      if (b.t === "p" || b.t === "h3" || b.t === "watch") parts.push(b.text);
      else if (b.t === "ul" || b.t === "src") parts.push(...b.items);
      else parts.push(...b.head, ...b.rows.flat());
    }
  }
  if (article.closing) parts.push(article.closing);
  return parts.join("\n");
}

/** 기사 꼴이 맞는가 — 비어 있으면 저장하지 않는다. */
export function articleProblems(article: BriefingArticle): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date)) problems.push("날짜 형식이 아닙니다(YYYY-MM-DD).");
  if (!article.headline) problems.push("제목(한 줄 요약)을 찾지 못했습니다.");
  if (article.sections.length === 0) problems.push("본문 절을 하나도 찾지 못했습니다.");
  const residue = snsResidue(article);
  if (residue.length) problems.push(`SNS 흔적이 남았습니다: ${residue.slice(0, 3).join(" / ")}`);
  return problems;
}

/** 파일 이름에서 날짜 — `2026-10-31.md` → `2026-10-31`. */
export function dateFromFileName(name: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(name);
  return m ? m[1] : null;
}
