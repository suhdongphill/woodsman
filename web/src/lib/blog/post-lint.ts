/**
 * 티스토리 글 편집 품질 검사 — **읽기 전용**(2026-09-27 (82) 운영자 사양). 판단 규칙만 여기 있다(입출력은 `scripts/lint-tistory-post.ts`).
 *
 * 왜: 글이 발행된 뒤에야 사이트 카드·공유 미리보기·스크린리더에서 문제가 드러났다 —
 *   설명(description) 머리표(「WOODSMAN · …」 396자) · 71자 제목 · 원문 표가 통째로 들어간 링크 카드 · 크림 배경 위 옅은 파랑.
 *   발행 **전에** 같은 눈으로 한 번 훑는다.
 *
 * ⚠ cheerio를 쓴다 — 스크립트(`scripts/lint-tistory-post.ts`)와 **동기화 파이프라인**(`features/blog/sync.ts`)이 함께 쓴다.
 *   워커 번들 비용을 재고 넣었다: 이 모듈 묶음 약 380KB(압축 전, esbuild 2026-09-27) · 유료 워커 한도 10MB.
 * ⚠ 검사가 실패해도 동기화는 실패하지 않는다(부르는 쪽이 감싼다).
 * ⚠ 고치지 않는다. 무엇이 어디서 왜 걸렸는지만 낸다 — 고치는 것은 작가다.
 */
// ⚠ `cheerio/slim` — 기본 진입점(`cheerio`)은 fromURL 때문에 undici·node:stream을 불러와 워커 번들에서 깨질 수 있다(2026-09-27 확인).
//   slim은 htmlparser2 파서만 쓴다 — HTML을 읽는 데는 충분하다.
import * as cheerio from "cheerio/slim";
import type { AnyNode, Element } from "domhandler";
import { AA_LARGE, AA_NORMAL, contrastRatio, isLargeText, parseColor } from "../color-contrast";

export type LintLevel = "warn" | "info";
export type LintFinding = { rule: string; level: LintLevel; message: string; detail?: Record<string, unknown> };

export type LintOptions = {
  /** 사용자 정의 오탈자 목록 */
  typos?: string[];
  /** 인라인 배경이 없을 때의 배경 — WoodsMan 글 틀의 크림색 */
  defaultBackground?: string;
  /** 제목 권장 최대 글자 수 — 검색·공유 카드에서 잘리지 않는 길이 */
  titleMax?: number;
  /** 설명 권장 최대 글자 수 — 검색 결과 스니펫 길이 */
  descriptionMax?: number;
};

export const DEFAULT_TYPOS = ["암화화폐", "암호화쳬"];
export const DEFAULT_BACKGROUND = "#F4F1E8";

export type LintResult = {
  title: string | null;
  findings: LintFinding[];
  stats: { images: number; imagesWithoutAlt: number; imagesWithoutCaption: number; colorsChecked: number; ogCards: number };
};

/** 연속 공백(&nbsp; 포함) 3개 이상 — 원문 표가 공백으로 늘어선 흔적. */
const NBSP_RUN = /(?:&nbsp;| |&#160;){3,}/;
/** 숫자·퍼센트 토큰 — 표에서 긁힌 설명의 흔적. */
const NUMBER_TOKEN = /\d[\d.,]*%?/g;

function styleProp(style: string | undefined, prop: string): string | null {
  if (!style) return null;
  // `color:`가 `background-color:`에 걸리지 않게 앞을 막는다
  const m = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, "i").exec(style);
  return m ? m[1].trim() : null;
}

function backgroundOf(el: Element, $: cheerio.CheerioAPI, fallback: string): string {
  for (let cur: Element | null = el; cur; cur = cur.parent && cur.parent.type === "tag" ? (cur.parent as Element) : null) {
    const style = $(cur).attr("style");
    const bg = styleProp(style, "background-color") ?? (() => {
      const b = styleProp(style, "background");
      return b ? (b.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/i)?.[0] ?? null) : null;
    })();
    if (bg && parseColor(bg)) return bg;
  }
  return fallback;
}

function fontSizeOf(el: Element, $: cheerio.CheerioAPI): number | null {
  for (let cur: Element | null = el; cur; cur = cur.parent && cur.parent.type === "tag" ? (cur.parent as Element) : null) {
    const fs = styleProp($(cur).attr("style"), "font-size");
    const px = fs ? /^([\d.]+)px$/i.exec(fs) : null;
    if (px) return Number(px[1]);
  }
  return null;
}

function isBold(el: Element, $: cheerio.CheerioAPI): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parent && cur.parent.type === "tag" ? (cur.parent as Element) : null) {
    if (["b", "strong", "h1", "h2", "h3", "h4", "h5", "h6"].includes(cur.tagName)) return true;
    const fw = styleProp($(cur).attr("style"), "font-weight");
    if (fw && (fw === "bold" || Number(fw) >= 700)) return true;
  }
  return false;
}

/** 요소 자신의 글자(자식 요소 글자는 빼고). */
function ownText(el: Element): string {
  return (el.children as AnyNode[])
    .filter((c) => c.type === "text")
    .map((c) => (c as unknown as { data: string }).data)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function lintTistoryPost(html: string, opts: LintOptions = {}): LintResult {
  const $ = cheerio.load(html);
  const findings: LintFinding[] = [];
  const typos = opts.typos ?? DEFAULT_TYPOS;
  const background = opts.defaultBackground ?? DEFAULT_BACKGROUND;
  const titleMax = opts.titleMax ?? 40;
  const descMax = opts.descriptionMax ?? 160;

  // 1. 링크 카드(opengraph 미리보기)에 원문 표가 새어 들어왔나
  const cards = $('figure[data-ke-type="opengraph"]');
  cards.each((_, fig) => {
    const $f = $(fig);
    const descEl = $f.find(".og-desc").first();
    const rawDesc = descEl.length ? (descEl.html() ?? "") : ($f.attr("data-og-description") ?? "");
    const text = descEl.length ? descEl.text() : cheerio.load(rawDesc).text();
    const numbers = (text.match(NUMBER_TOKEN) ?? []).length;
    const nbspRun = NBSP_RUN.test(rawDesc) || / {3,}/.test(text);
    if (nbspRun || numbers >= 20) {
      findings.push({
        rule: "og-card-table",
        level: "warn",
        message: "링크 카드에 원문 표 노출 — 카드 설명에 표 칸이 공백·숫자로 늘어서 있다. 카드 설명을 한 문장으로 고치거나 일반 링크로.",
        detail: {
          card: ($f.find(".og-title").first().text() || $f.attr("data-og-title") || "").trim().slice(0, 80),
          nbspRun,
          numberTokens: numbers,
        },
      });
    }
  });

  // 2. 설명(description)
  const description = $('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content") ?? null;
  if (description !== null) {
    const d = description.trim();
    if (/^[A-Z ]+·/.test(d)) {
      findings.push({
        rule: "description-kicker",
        level: "warn",
        message: "설명이 머리표(대문자 · …)로 시작한다 — 검색 결과·공유 카드 첫머리가 머리표가 된다. 글 첫 문단을 요약 문장으로.",
        detail: { length: d.length, head: d.slice(0, 50) },
      });
    }
    if (d.length > descMax) {
      /*
        ⚠ 정보(info)다, 경고가 아니다 — 2026-09-27 25편 전부에서 걸렸다. 티스토리가 본문 앞으로 설명을 **자동으로** 만들어 작가가 길이를
           직접 정하기 어렵다. 늘 켜지는 경보는 무시하게 되고, 그러면 진짜 경고가 묻힌다. 작가가 고칠 수 있는 「머리표로 시작」만 경고로 둔다.
      */
      findings.push({ rule: "description-length", level: "info", message: `설명이 ${d.length}자다(권장 ${descMax}자 이하) — 검색 결과에서 잘린다. 티스토리가 본문 앞으로 만드는 값이라 첫 문단을 짧은 요약 문장으로 두면 줄어든다.`, detail: { length: d.length } });
    }
  }

  // 3. 제목
  const title = $("title").first().text().trim() || null;
  if (title && title.length > titleMax) {
    findings.push({ rule: "title-length", level: "warn", message: `제목이 ${title.length}자다(권장 ${titleMax}자 이하) — 공유 카드·검색 결과에서 잘린다. 「 — 」 뒤를 부제로 돌릴 수 있다.`, detail: { length: title.length, title } });
  }

  // 본문 범위 — 티스토리 글 컨테이너, 없으면 body
  const article = $(".tt_article_useless_p_margin").first().length ? $(".tt_article_useless_p_margin").first() : $("body");

  // 4. 인라인 글자색 대비
  const seen = new Map<string, { fg: string; bg: string; ratio: number; large: boolean; count: number; samples: string[] }>();
  let colorsChecked = 0;
  article.find("[style]").each((_, node) => {
    const el = node as Element;
    const fg = styleProp($(el).attr("style"), "color");
    if (!fg) return;
    const text = ownText(el) || $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const fgRgb = parseColor(fg);
    const bg = backgroundOf(el, $, background);
    const bgRgb = parseColor(bg);
    if (!fgRgb || !bgRgb) return;
    colorsChecked += 1;
    const ratio = contrastRatio(fgRgb, bgRgb);
    if (ratio >= AA_NORMAL) return;
    const large = isLargeText(fontSizeOf(el, $), isBold(el, $));
    const key = `${fg.toLowerCase()}|${bg.toLowerCase()}|${large}`;
    const cur = seen.get(key) ?? { fg, bg, ratio, large, count: 0, samples: [] };
    cur.count += 1;
    if (cur.samples.length < 3) cur.samples.push(text.slice(0, 40));
    seen.set(key, cur);
  });
  for (const c of seen.values()) {
    const passesLarge = c.large && c.ratio >= AA_LARGE;
    findings.push({
      rule: "contrast",
      level: passesLarge ? "info" : "warn",
      message: passesLarge
        ? `글자색 ${c.fg} / 배경 ${c.bg} 대비 ${c.ratio.toFixed(2)} — 큰 글자라 AA(3:1)는 통과, 본문 크기면 미달`
        : `글자색 ${c.fg} / 배경 ${c.bg} 대비 ${c.ratio.toFixed(2)} — WCAG AA ${c.large ? AA_LARGE : AA_NORMAL}:1 미달`,
      detail: { fg: c.fg, bg: c.bg, ratio: Number(c.ratio.toFixed(2)), largeText: c.large, count: c.count, samples: c.samples },
    });
  }

  // 5. 오탈자
  const bodyText = article.text();
  for (const t of typos) {
    const n = bodyText.split(t).length - 1;
    if (n > 0) findings.push({ rule: "typo", level: "warn", message: `오탈자 「${t}」 ${n}곳`, detail: { typo: t, count: n } });
  }

  // 6. 이미지 — 대체 글(alt) · 캡션
  const imgs = article.find("img");
  let noAlt = 0;
  let noCaption = 0;
  imgs.each((_, node) => {
    const $i = $(node);
    if (!($i.attr("alt") ?? "").trim()) noAlt += 1;
    const fig = $i.closest("figure");
    if (!fig.length || !fig.find("figcaption").text().trim()) noCaption += 1;
  });
  if (noAlt) findings.push({ rule: "img-alt", level: "warn", message: `대체 글(alt)이 빈 이미지 ${noAlt}개 — 스크린리더가 그림을 건너뛴다.`, detail: { count: noAlt } });
  if (noCaption) findings.push({ rule: "img-caption", level: "info", message: `캡션(figcaption) 없는 이미지 ${noCaption}개`, detail: { count: noCaption } });

  return {
    title,
    findings,
    stats: { images: imgs.length, imagesWithoutAlt: noAlt, imagesWithoutCaption: noCaption, colorsChecked, ogCards: cards.length },
  };
}

/** 저장용 요약 — 관리자 목록에 한 줄로 보이는 것만. */
export type LintSummary = { warn: number; info: number; rules: string[]; at: string };

export function summarizeLint(r: LintResult, at: string): LintSummary {
  return {
    warn: r.findings.filter((f) => f.level === "warn").length,
    info: r.findings.filter((f) => f.level === "info").length,
    rules: [...new Set(r.findings.filter((f) => f.level === "warn").map((f) => f.rule))],
    at,
  };
}
