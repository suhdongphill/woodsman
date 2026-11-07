/**
 * 종목별 보고서 **파일·블로그 연결** — 순수 함수 (2026-11-07, 운영자 「종목 공개화면에 보고서를 html이나 블로그를 연결」).
 *
 * 구조화 보고서(`StockReport`)는 칸을 채워야 발행된다. 이미 만들어 둔 CANSLIM HTML이나 티스토리 글을
 * 종목에 바로 잇는 길이 없어, 공개 종목 118개 중 보고서·블로그 링크가 있는 종목이 0개였다.
 *
 * ⚠ HTML은 저장할 때 허용 목록으로 정화한다(`sanitizeHtml`). 스크립트·이벤트·외부 자원은 나가지 않는다.
 * ⚠ 티스토리에 같은 글이 있으면 canonical은 **원문**이다(CLAUDE.md §5) — 화면이 `canonicalFor`로 정한다.
 */
import { sanitizeHtml } from "@/lib/sanitize-html";

export const REPORT_FILE_MAX_BYTES = 512 * 1024;

/** 티커 맞추기 — ⚠ 문자열 그대로. `005930`을 숫자로 만들지 않는다. */
export function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

const TICKER = /^(?:[0-9]{6}|[A-Z][A-Z0-9.-]{0,9})$/;

/** `2026-09-25_000660_SK하이닉스_CANSLIM.html` → 티커·종목명. 모르면 비운다(추측하지 않는다). */
export function parseReportFileName(fileName: string): { ticker?: string; name?: string } {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const tokens = stem.split("_");
  const at = tokens.findIndex((t) => TICKER.test(t));
  if (at < 0) return {};
  const name = tokens[at + 1];
  return { ticker: tokens[at], name: name && !TICKER.test(name) ? name : undefined };
}

/** 저장용 HTML. `<head>`는 내용까지 지운다 — `<title>` 글자가 본문에 새지 않게. */
export function sanitizeReportHtml(html: string): string {
  return sanitizeHtml(html.replace(/<head\b[\s\S]*?<\/head>/gi, ""), { inlineStyle: true }).trim();
}

function textBlocks(html: string): string[] {
  return html
    .replace(/<\/(p|div|h[1-6]|li|td|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 제목 추측 — 첫 글자 덩어리. 머리표(`CANSLIM · 기업분석 · KOSPI 000660`)면 다음 덩어리.
 * 관리자가 제목 칸에 적으면 그 값이 이긴다.
 */
export function guessHeadline(html: string): string {
  const blocks = textBlocks(html);
  const first = blocks[0] ?? "";
  const picked = /기업분석|CANSLIM\s*·/.test(first) && blocks[1] ? blocks[1] : first;
  return picked.slice(0, 200);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}

export type ReportFileInput = {
  ticker: string;
  name: string;
  headline: string;
  blogUrl?: string;
  /** 이번에 올린 HTML(정화 뒤) */
  html?: string;
  /** 이미 저장된 HTML이 있나 — 있으면 파일 없이 링크만 고칠 수 있다 */
  hasStoredHtml: boolean;
};

export function reportFileProblems(input: ReportFileInput): string[] {
  const problems: string[] = [];
  if (!TICKER.test(input.ticker)) problems.push("티커를 알 수 없습니다. 티커 칸을 채우거나 파일 이름을 2026-09-25_000660_종목명.html 꼴로 하세요.");
  if (!input.name.trim()) problems.push("종목명을 채우세요.");
  if (input.blogUrl && !isHttpUrl(input.blogUrl)) problems.push("블로그 링크는 http(s) 주소여야 합니다.");
  if (!input.blogUrl && !input.html && !input.hasStoredHtml) problems.push("HTML 파일이나 블로그 링크 중 하나는 있어야 합니다.");
  if (input.html !== undefined && textBlocks(input.html).join("").length < 50) problems.push("HTML에서 읽을 수 있는 본문을 찾지 못했습니다.");
  return problems;
}

/** 같은 글이 블로그에 있으면 원문이 canonical이다. */
export function canonicalFor(ticker: string, blogUrl?: string | null): string {
  return blogUrl && isHttpUrl(blogUrl) ? blogUrl : `/stocks/${encodeURIComponent(ticker)}`;
}

/** 블로그 경유 목적지 — 저장된 값 중 앞선 것. ⚠ 요청이 준 주소를 따라가지 않는다. */
export function pickStockBlogUrl(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((u): u is string => !!u && isHttpUrl(u)) ?? null;
}
