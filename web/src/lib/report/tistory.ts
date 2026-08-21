/**
 * 종목 보고서 → **티스토리에 붙여 넣을 HTML** — 순수 함수.
 *
 * ## 왜 이게 1순위인가
 * 이 사이트의 1순위 목적은 **티스토리로 트래픽을 보내는 것**이다(운영지침 §5).
 * 보고서가 사이트에만 쌓이면 그 목적과 무관한 자산이 된다. 내보내는 길을 먼저 뚫어 둔다.
 *
 * ## ⚠ 티스토리는 우리 CSS를 안 받는다
 * `<style>` 블록·클래스·외부 스타일시트가 편집기에서 날아간다. 그래서 이 모듈은
 * **모든 스타일을 인라인으로 박은 조각(fragment)** 을 낸다(`references/report-format.md`의
 * "Tistory 블로그용" 변형). `<html>`·`<head>`를 만들지 않는 이유가 이것이다.
 * ⚠ 표는 **가로 스크롤 컨테이너로 감싼다.** 모바일에서 표가 화면을 밀어낸다.
 * ⚠ grid를 쓰지 않는다. 옛 편집기·메일 뷰어에서 무너진다 — flex-wrap만 쓴다.
 *
 * ## ⚠ 정직성 규율은 **내보낸 뒤에도 살아 있어야 한다**
 * 여기가 이 모듈에서 가장 중요한 대목이다. 티스토리는 사이트보다 **독자가 많은** 채널이다.
 * 사이트에서는 데이터 태그·미조회 고지·철회 조건·방법론 한계·투자자문업 미인가 고지를
 * 지키면서 내보낸 판에서 빠뜨리면, **더 많은 사람이 덜 정직한 판을 읽는다.**
 * 그래서 R2~R7이 내보낸 HTML에 남아 있는지를 테스트가 하나씩 확인한다.
 *
 * ## ⚠ 링크는 절대경로로 바꾼다
 * 본문의 `/macro` 같은 내부 링크를 그대로 내보내면 **티스토리 도메인에서 404**가 된다.
 * 티스토리에 올라간 글에서 사이트로 돌아오는 길이기도 하다.
 */
import { REPORT_SECTIONS } from "./catalog";
import { findDataTag, CANSLIM_ITEMS } from "../canslim/catalog";
import { holdingFunctionLabel, recessionCounts, type ReportContextSnapshot } from "./context";
import { findBubbleTrigger } from "../bubble/catalog";
import type { ReportBlock, ReportDraft, ReportSectionKey, ChecklistItem } from "./types";
import type { CanslimReading } from "../canslim/types";

/* ────────────────────────── 디자인 시스템 (references/report-format.md) ────────────────────────── */

const C = {
  bg: "#0b1220",
  panel: "#101a2e",
  panel2: "#0d1626",
  line: "#1e2c47",
  cyan: "#34d6ff",
  amber: "#ffb347",
  red: "#ff6b7a",
  green: "#4ade9c",
  txt: "#dbe6f5",
  sub: "#8fa3c0",
} as const;

/**
 * ⚠ 티스토리에는 우리 CSS 리셋이 없다. `box-sizing`을 안 박으면 **패딩이 너비에 더해져**
 *    모바일에서 글 상자가 화면을 밀어낸다(기본값이 `content-box`다).
 *    패딩이 있는 상자마다 붙인다 — 테스트가 대조한다.
 */
const BOX = "box-sizing:border-box";

const MONO = "'JetBrains Mono','Consolas','D2Coding',monospace";
const SANS =
  "'Pretendard Variable',Pretendard,-apple-system,'Malgun Gothic','맑은 고딕',sans-serif";

/** 데이터 태그 색 — `references/report-format.md`의 규칙 그대로. */
const TAG_COLOR: Record<string, string> = {
  confirmed: C.green,
  needsCheck: C.amber,
  na: C.sub,
};

/**
 * 본문(`bodyHtml`)에 인라인으로 박을 태그별 스타일.
 *
 * ⚠ 여기 없는 태그는 스타일 없이 그대로 나간다 — **지우지 않는다.**
 *    모르는 태그를 버리면 본문이 조용히 사라진다(정화는 저장할 때 이미 끝났다).
 */
const BODY_STYLE: Record<string, string> = {
  p: `margin:0 0 12px;line-height:1.75;color:${C.txt};font-size:15px`,
  h2: `margin:22px 0 10px;font-size:18px;font-weight:700;color:${C.cyan}`,
  h3: `margin:18px 0 8px;font-size:16px;font-weight:700;color:${C.txt}`,
  h4: `margin:16px 0 6px;font-size:15px;font-weight:700;color:${C.txt}`,
  h5: `margin:14px 0 6px;font-size:14px;font-weight:700;color:${C.sub}`,
  h6: `margin:14px 0 6px;font-size:13px;font-weight:700;color:${C.sub}`,
  ul: `margin:0 0 12px;padding-left:20px;color:${C.txt};line-height:1.75;font-size:15px`,
  ol: `margin:0 0 12px;padding-left:20px;color:${C.txt};line-height:1.75;font-size:15px`,
  li: "margin:0 0 4px",
  blockquote: `${BOX};margin:0 0 14px;padding:10px 14px;border-left:3px solid ${C.cyan};background:${C.panel2};color:${C.sub};font-size:14px;line-height:1.7`,
  code: `font-family:${MONO};font-size:13px;background:${C.panel2};color:${C.cyan};padding:1px 5px;border-radius:4px`,
  pre: `${BOX};margin:0 0 14px;padding:12px;background:${C.panel2};border:1px solid ${C.line};border-radius:10px;overflow-x:auto;font-family:${MONO};font-size:13px;color:${C.txt}`,
  strong: `color:#ffffff;font-weight:700`,
  em: `color:${C.sub}`,
  a: `color:${C.cyan};text-decoration:underline`,
  hr: `border:0;border-top:1px solid ${C.line};margin:18px 0`,
};

/* ────────────────────────── 순수 도우미 ────────────────────────── */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 끝의 `/`를 떼어 둔다 — `https://a.com/` + `/macro`가 `//macro`가 되지 않게. */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * 저장된 본문 HTML을 **티스토리에서 살아남는 모양**으로 바꾼다.
 *
 * ⚠ 입력은 이미 `lib/sanitize-html`을 거친 HTML이다(허용 목록·`style` 속성 제거).
 *    그래서 여는 태그에 `style`을 끼워 넣는 것으로 충분하다 — 지울 기존 style이 없다.
 * ⚠ 내부 링크(`/macro`)는 **절대경로로 바꾼다.** 안 바꾸면 티스토리에서 404다.
 */
export function inlineBodyHtml(html: string, siteUrl: string): string {
  if (!html) return "";
  const base = trimSlash(siteUrl);

  return html.replace(
    /<([a-z][a-z0-9]*)((?:\s[^>]*)?)(\/?)>/gi,
    (match, rawTag: string, attrs: string, selfClose: string) => {
      const tag = rawTag.toLowerCase();
      let nextAttrs = attrs;

      // 내부 링크를 절대경로로. ⚠ `//`로 시작하는 프로토콜 상대 주소는 건드리지 않는다.
      if (tag === "a") {
        nextAttrs = nextAttrs.replace(
          /href="(\/(?!\/)[^"]*)"/gi,
          (_m, path: string) => `href="${base}${path}"`,
        );
      }

      const style = BODY_STYLE[tag];
      if (!style) return `<${tag}${nextAttrs}${selfClose}>`;
      return `<${tag} style="${style}"${nextAttrs}${selfClose}>`;
    },
  );
}

/* ────────────────────────── 조각 만들기 ────────────────────────── */

function panel(inner: string, tone: "default" | "warn" = "default"): string {
  const border = tone === "warn" ? `${C.amber}66` : C.line;
  const bg = tone === "warn" ? "rgba(255,179,71,0.06)" : C.panel;
  return `<div style="${BOX};border:1px solid ${border};background:${bg};border-radius:14px;padding:16px 18px;margin:0 0 16px">${inner}</div>`;
}

function label(text: string): string {
  return `<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${C.sub};margin:0 0 6px">${escapeHtml(text)}</div>`;
}

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;border:1px solid ${color}66;background:${color}1a;color:${color};border-radius:8px;padding:3px 9px;font-size:12px;margin:0 6px 6px 0">${escapeHtml(text)}</span>`;
}

/** ⚠ 표는 반드시 가로 스크롤 컨테이너로 감싼다 — 모바일에서 화면을 밀어낸다. */
function scrollTable(inner: string): string {
  return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 12px"><table style="width:100%;border-collapse:collapse;min-width:420px;font-size:13.5px">${inner}</table></div>`;
}

function th(text: string): string {
  return `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid ${C.line};color:${C.sub};font-weight:600;white-space:nowrap">${escapeHtml(text)}</th>`;
}

function td(html: string, opts: { mono?: boolean; color?: string } = {}): string {
  const font = opts.mono ? `font-family:${MONO};` : "";
  return `<td style="padding:8px 10px;border-bottom:1px solid ${C.line}22;color:${opts.color ?? C.txt};${font}vertical-align:top">${html}</td>`;
}

/** 데이터 태그 배지. ⚠ N/A는 회색이다 — 빨강으로 칠하면 "나쁜 값"으로 읽힌다. */
function tagBadge(tag: string | undefined): string {
  const def = tag ? findDataTag(tag) : undefined;
  if (!def) return "";
  return badge(def.label, TAG_COLOR[def.key] ?? C.sub);
}

/** 출처·기준일 한 줄. ⚠ 날짜 없는 숫자는 자동으로 갱신되는 값처럼 읽힌다. */
function sourceLine(block: ReportBlock, siteUrl: string): string {
  const bits: string[] = [];
  if (block.source) {
    bits.push(
      block.sourceUrl
        ? `<a href="${escapeHtml(absolutize(block.sourceUrl, siteUrl))}" style="color:${C.cyan};text-decoration:underline">${escapeHtml(block.source)}</a>`
        : escapeHtml(block.source),
    );
  }
  if (block.asOf) bits.push(`기준일 <span style="font-family:${MONO}">${escapeHtml(block.asOf)}</span>`);
  if (!bits.length) return "";
  return `<div style="margin:8px 0 0;font-size:12px;color:${C.sub}">출처 — ${bits.join(" · ")}</div>`;
}

function absolutize(url: string, siteUrl: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? `${trimSlash(siteUrl)}${url}` : url;
}

/** 사실상 빈 본문인가. `lib/report/rules.isBlankBody`와 같은 판정을 쓴다. */
function isBlank(html: string | undefined): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, "").replace(/[\s—–\-|:.]/g, "") === "";
}

/* ────────────────────────── 본체 ────────────────────────── */

export type TistoryExportInput = {
  report: ReportDraft & {
    version: number;
    publishedAt?: string;
    html: Map<ReportSectionKey, string>;
    readings: Map<string, CanslimReading>;
    checklist: ChecklistItem[];
  };
  /** 주입한 사이트 자료. 없으면 그 카드를 아예 만들지 않는다 */
  snapshot?: ReportContextSnapshot | null;
  /** 사이트 주소(절대경로 변환·원문 링크에 쓴다) */
  siteUrl: string;
  /** 내보낸 날짜(YYYY-MM-DD) */
  today: string;
};

/** ⚠ 투자자문업 미인가 고지 — `/disclaimer`와 같은 선이다. **빼지 않는다.** */
export const TISTORY_DISCLAIMER =
  "이 글은 개인의 기록이자 정보 제공 목적이며 투자 권유나 자문이 아닙니다. Woodsman은 투자자문업 등록 사업자가 아니며, 매수·매도를 권유하거나 목표주가를 제시하지 않습니다. 과거의 성과는 미래의 수익을 보장하지 않으며 투자 판단과 그 결과의 책임은 투자자 본인에게 있습니다.";

function renderHeader(input: TistoryExportInput): string {
  const { report, siteUrl } = input;
  const meta = [
    report.market === "KR" ? "한국" : "미국",
    report.ticker,
    report.industry,
    report.publishedAt ? `${report.publishedAt.slice(0, 10)} 발행` : undefined,
    `v${report.version}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div style="${BOX};border:1px solid ${C.line};border-radius:14px;padding:20px 18px;margin:0 0 16px;background:linear-gradient(135deg,${C.panel} 0%,${C.bg} 60%)">
<div style="font-family:${MONO};font-size:12px;color:${C.cyan};margin:0 0 6px">${escapeHtml(meta)}</div>
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff">${escapeHtml(report.name)}</h2>
<p style="margin:0;font-size:15px;line-height:1.7;color:${C.txt}">${escapeHtml(report.headline)}</p>
<div style="margin:12px 0 0;font-size:12px;color:${C.sub}">원문 · 갱신본 — <a href="${escapeHtml(trimSlash(siteUrl))}/stocks/${encodeURIComponent(report.ticker)}" style="color:${C.cyan};text-decoration:underline">portfolio-solutions.net</a></div>
</div>`;
}

/** 판정 배지. ⚠ **철회 조건을 같은 상자에** 둔다 — 판정만 보이면 소감이 된다(R3). */
function renderVerdict(report: TistoryExportInput["report"]): string {
  if (!report.verdictStructural && !report.verdictShort) return "";

  const badges = [
    report.verdictStructural ? badge(`중장기 · ${report.verdictStructural}`, C.cyan) : "",
    report.verdictShort ? badge(`단기 · ${report.verdictShort}`, C.sub) : "",
  ].join("");

  const revoke = report.revokeIf
    ? `<div style="margin:8px 0 0;font-size:13.5px;line-height:1.7;color:${C.amber}"><span style="color:${C.sub}">철회 조건 — </span>${escapeHtml(report.revokeIf)}</div>`
    : "";

  const next = report.nextCheckAt
    ? `<div style="margin:6px 0 0;font-size:12px;color:${C.sub}">다음 판단 시점 <span style="font-family:${MONO}">${escapeHtml(report.nextCheckAt)}</span></div>`
    : "";

  return panel(`${badges}${revoke}${next}`);
}

/**
 * 섹션 하나.
 *
 * ⚠ **빈 칸은 비운 채로 두고 조회처를 적는다**(R2). 설계서가 "가장 중요한 장치"라고 적은 것이다.
 *    내보낼 때 빈 섹션을 슬쩍 지우면 그 장치가 통째로 사라진다.
 */
function renderSection(
  block: ReportBlock,
  html: string | undefined,
  input: TistoryExportInput,
): string {
  const def = REPORT_SECTIONS.find((s) => s.key === block.sectionKey);
  if (!def) return "";

  const blank = isBlank(html);
  if (blank && !block.lookupHint?.trim()) return "";

  const heading = `<h3 style="margin:0 0 10px;font-size:17px;font-weight:700;color:${C.cyan}">§${def.no} ${escapeHtml(def.name)} ${tagBadge(block.tag)}</h3>`;

  const body = blank
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.75;color:${C.sub}">아직 조회하지 못한 항목입니다. <strong style="color:${C.txt}">원칙에 따라 추정치를 기입하지 않습니다.</strong></p>
<div style="${BOX};border:1px dashed ${C.line};border-radius:10px;padding:10px 12px;font-size:13px;color:${C.sub}">조회처 — ${escapeHtml(block.lookupHint ?? "")}</div>`
    : inlineBodyHtml(html ?? "", input.siteUrl) +
      (block.lookupHint?.trim()
        ? `<div style="margin:8px 0 0;font-size:12px;color:${C.sub}">조회처 — ${escapeHtml(block.lookupHint)}</div>`
        : "");

  return panel(`${heading}${body}${sourceLine(block, input.siteUrl)}`);
}

/** CANSLIM 표. ⚠ 채점 안 된 축을 **0점으로 적지 않는다** — N/A로 남긴다(R1). */
function renderCanslim(report: TistoryExportInput["report"]): string {
  const rows = CANSLIM_ITEMS.map((item) => {
    const r = report.readings.get(item.key);
    const scored = r && r.tag !== "na" && typeof r.points === "number";
    const points = scored
      ? `<span style="color:${C.cyan};font-weight:700">${r!.points}</span> / 10`
      : `<span style="color:${C.sub}">N/A</span>`;

    return `<tr>${td(`<strong style="color:#ffffff">${item.key}</strong> <span style="color:${C.sub}">${escapeHtml(item.name)}</span>`)}${td(points, { mono: true })}${td(
      r?.evidence ? escapeHtml(r.evidence) : `<span style="color:${C.sub}">—</span>`,
    )}${td(tagBadge(r?.tag) || `<span style="color:${C.sub}">—</span>`)}</tr>`;
  }).join("");

  if (!report.readings.size) return "";

  return panel(
    `${label("CANSLIM 채점")}${scrollTable(
      `<thead><tr>${th("항목")}${th("점수")}${th("근거")}${th("태그")}</tr></thead><tbody>${rows}</tbody>`,
    )}<p style="margin:0;font-size:12px;color:${C.sub}">⚠ 채점하지 않은 축은 <strong style="color:${C.txt}">0점이 아니라 분모에서 뺐습니다.</strong> 0으로 적으면 '안 본 것'이 '나쁜 것'이 됩니다.</p>`,
  );
}

/**
 * 제3자 컨센서스 목표주가.
 * ⚠ **우리 판단과 같은 줄에 두지 않는다**(R4). 우리는 목표주가를 산출하지 않는다.
 */
function renderConsensus(report: TistoryExportInput["report"]): string {
  const t = report.consensusTarget;
  if (!t) return "";

  return panel(
    `${label("제3자 컨센서스 목표주가")}<div style="font-family:${MONO};font-size:18px;color:${C.txt};margin:0 0 6px">${escapeHtml(String(t.value))} ${escapeHtml(t.currency)}</div>
<div style="font-size:12px;color:${C.sub}">${escapeHtml(t.source)} · 기준일 ${escapeHtml(t.asOf)}</div>
<p style="margin:10px 0 0;font-size:12.5px;color:${C.amber}">⚠ 제3자(집계처)가 공표한 수치를 출처·기준일과 함께 옮긴 것입니다. <strong style="color:${C.txt}">Woodsman은 목표주가를 산출하지 않습니다.</strong></p>`,
    "warn",
  );
}

/** ⚠ 밸류에이션 방법론의 한계(R6). 신뢰는 결론이 아니라 한계 고백에서 나온다. */
function renderLimitation(report: TistoryExportInput["report"]): string {
  if (!report.valuationLimitation?.trim()) return "";
  return panel(
    `${label("이 방법론이 언제 틀리나")}<p style="margin:0;font-size:14px;line-height:1.75;color:${C.txt}">${escapeHtml(report.valuationLimitation)}</p>`,
    "warn",
  );
}

/** §11 미확정 체크리스트 — 그대로 다음 갱신의 작업 목록이 된다(R7). */
function renderChecklist(report: TistoryExportInput["report"]): string {
  if (!report.checklist.length) return "";

  const rows = report.checklist
    .map((c) => `<tr>${td(escapeHtml(c.item))}${td(escapeHtml(c.source))}${td(escapeHtml(c.impact))}</tr>`)
    .join("");

  return panel(
    `${label("아직 모르는 것")}${scrollTable(
      `<thead><tr>${th("항목")}${th("어디서 확인하나")}${th("확인되면 무엇이 바뀌나")}</tr></thead><tbody>${rows}</tbody>`,
    )}`,
  );
}

/** 작성 시점 사이트 자료. ⚠ **얼린 값**이고, 지금 값은 사이트에서 보라고 링크를 준다. */
function renderContext(snapshot: ReportContextSnapshot, siteUrl: string): string {
  const base = trimSlash(siteUrl);
  const { macro, bubble, holding } = snapshot;

  const items: string[] = [
    macro.level === "unknown"
      ? "<strong>침체 신호 종합</strong> — 아직 수집 전"
      : `<strong>침체 신호 종합</strong> — ${escapeHtml(macro.label)} · ${escapeHtml(recessionCounts(macro))} (${macro.total}개 지표)${macro.asOf ? ` · 기준일 ${escapeHtml(macro.asOf)}` : ""}`,
    macro.fed
      ? `<strong>연준 방향</strong> — ${escapeHtml(macro.fed.biasLabel)} · 인상 ${Math.round(macro.fed.hike * 100)}%${macro.fed.asOf ? ` · 기준일 ${escapeHtml(macro.fed.asOf)}` : ""}`
      : "<strong>연준 방향</strong> — 산출하지 않았습니다",
    bubble.score === undefined
      ? "<strong>AI·반도체 버블</strong> — 아직 채점 전"
      : `<strong>AI·반도체 버블</strong> — ${bubble.score}점 · ${escapeHtml(bubble.regime ?? "—")} (${bubble.total}개 중 ${bubble.scored}개 채점)`,
    holding.inPortfolio
      ? `<strong>대표 포트폴리오</strong> — 편입 · ${escapeHtml(holdingFunctionLabel(holding))} · 목표비중 ${holding.targetWeight != null ? `${holding.targetWeight}%` : "—"}`
      : "<strong>대표 포트폴리오</strong> — 미편입 (관찰 종목)",
  ];

  if (bubble.firedTriggerKeys.length) {
    items.push(
      `<strong style="color:${C.amber}">발화한 하드 트리거</strong> — ${bubble.firedTriggerKeys
        .map((k) => escapeHtml(findBubbleTrigger(k)?.text ?? k))
        .join(" / ")}`,
    );
  }

  return panel(
    `${label(`작성 시점 사이트 자료 · 기준 ${snapshot.capturedAt}`)}
<ul style="margin:0 0 10px;padding-left:20px;color:${C.txt};line-height:1.8;font-size:14px">${items.map((i) => `<li style="margin:0 0 4px">${i}</li>`).join("")}</ul>
<p style="margin:0;font-size:12px;color:${C.sub}">이 글을 쓸 때의 값입니다. 갱신하지 않고 그대로 둡니다 — 지금 값은 <a href="${base}/macro" style="color:${C.cyan};text-decoration:underline">거시 지표</a> · <a href="${base}/macro/bubble" style="color:${C.cyan};text-decoration:underline">버블 모니터</a>에서 봅니다.</p>`,
  );
}

/**
 * 티스토리 편집기의 **HTML 모드**에 그대로 붙여 넣을 조각.
 *
 * ⚠ 붙여 넣은 뒤 기본(위지윅) 모드로 전환하지 않는다 — 인라인 스타일이 정리당한다.
 */
export function renderTistoryHtml(input: TistoryExportInput): string {
  const { report, snapshot, siteUrl, today } = input;
  const base = trimSlash(siteUrl);

  const sections = REPORT_SECTIONS.map((def) => {
    const block = report.blocks.find((b) => b.sectionKey === def.key);
    if (!block) return "";
    // 헤더·푸터는 이 판에서 따로 그린다(위·아래 상자).
    if (def.key === "header") return "";
    return renderSection(block, report.html.get(def.key), input);
  }).join("");

  const footerBlock = report.blocks.find((b) => b.sectionKey === "footer");
  const footerBody =
    footerBlock && !isBlank(report.html.get("footer"))
      ? `<div style="margin:0 0 10px">${inlineBodyHtml(report.html.get("footer") ?? "", siteUrl)}</div>`
      : "";

  return `<div style="${BOX};background:${C.bg};color:${C.txt};font-family:${SANS};max-width:960px;margin:0 auto;padding:18px 14px;border-radius:16px">
${renderHeader(input)}
${renderVerdict(report)}
${sections}
${renderCanslim(report)}
${renderConsensus(report)}
${renderLimitation(report)}
${snapshot ? renderContext(snapshot, siteUrl) : ""}
${renderChecklist(report)}
<div style="border-top:1px solid ${C.line};margin:18px 0 0;padding:14px 2px 0">
${footerBody}
<p style="margin:0 0 8px;font-size:12px;line-height:1.8;color:${C.sub}">${escapeHtml(TISTORY_DISCLAIMER)}</p>
<p style="margin:0;font-size:12px;color:${C.sub}">Woodsman · 갱신본은 <a href="${base}/stocks/${encodeURIComponent(report.ticker)}" style="color:${C.cyan};text-decoration:underline">${base.replace(/^https?:\/\//, "")}/stocks/${escapeHtml(report.ticker)}</a> 에서 봅니다 · 내보낸 날짜 <span style="font-family:${MONO}">${escapeHtml(today)}</span></p>
</div>
</div>`;
}
