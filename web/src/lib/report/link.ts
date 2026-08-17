/**
 * 대표 포트폴리오 ↔ 종목분석 보고서 **연결** — 순수 함수.
 *
 * ## 왜 생겼나 (2026-08-17)
 * `HoldingCard`가 티커만 있으면 무조건 `/stocks/<티커>`로 링크를 걸고 있었다.
 * 그런데 그 화면은 **발행된 보고서가 없으면 `notFound()`** 다.
 * 발행 보고서가 0건인 지금, **모든 종목 카드가 404로 가고 있었다.**
 * 두 화면이 서로를 모른 채 각자 돌아간 결과다.
 *
 * 그래서 "이 종목에 보고서가 있는가"를 **한 곳에서** 판단한다.
 *
 * ## ⚠ 티커 맞추기 규칙
 * - **대소문자를 무시하고 맞춘다.** 관리자가 `nvda`로 적고 보고서는 `NVDA`인 일이 생긴다.
 * - **앞뒤 공백을 버린다.** 붙여넣기로 들어온 공백 하나가 링크를 끊는다.
 * - ⚠ **숫자로 만들지 않는다.** `005930`을 숫자로 파싱하면 `5930`이 되어 종목이 바뀐다.
 * - **현금성 자리(CASH·BOND)는 잇지 않는다.** 보고서를 쓸 대상이 아니다.
 */
import type { ReportStatus } from "./types";

/** 보고서 한 건의 최소 정보 — 링크를 걸지 말지 정하는 데 필요한 것만. */
export type ReportLinkEntry = {
  /** 저장된 그대로의 티커. ⚠ URL에는 **이 값**을 쓴다(맞추기용 정규화 값이 아니라) */
  ticker: string;
  name: string;
  status: ReportStatus;
};

/** ⚠ 보고서를 쓰지 않는 자리. 대소문자를 무시하고 본다. */
const NON_STOCK_MARKETS = new Set(["CASH", "BOND"]);

/**
 * 맞추기용 키.
 *
 * ⚠ 문자열 그대로 다룬다. `Number()`를 태우면 `005930` → `5930`이 된다.
 */
export function tickerKey(ticker: string | undefined): string | undefined {
  const trimmed = ticker?.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase();
}

/** 보고서 목록 → 맞추기용 색인. 같은 키가 겹치면 **먼저 온 것**을 남긴다. */
export function buildReportIndex(entries: ReportLinkEntry[]): Map<string, ReportLinkEntry> {
  const index = new Map<string, ReportLinkEntry>();
  for (const entry of entries) {
    const key = tickerKey(entry.ticker);
    if (!key || index.has(key)) continue;
    index.set(key, entry);
  }
  return index;
}

export type HoldingLike = {
  ticker?: string;
  market?: string;
};

/**
 * 이 종목에 해당하는 보고서.
 *
 * ⚠ 티커가 없거나 현금성 자리면 **찾지 않는다.** 억지로 이으면 엉뚱한 종목의 보고서가 붙는다.
 */
export function findReportFor(
  holding: HoldingLike,
  index: Map<string, ReportLinkEntry>,
): ReportLinkEntry | undefined {
  if (isNonStock(holding)) return undefined;
  const key = tickerKey(holding.ticker);
  return key ? index.get(key) : undefined;
}

/** 현금·채권처럼 보고서를 쓰지 않는 자리인가. */
export function isNonStock(holding: HoldingLike): boolean {
  const market = holding.market?.trim().toUpperCase();
  return !!market && NON_STOCK_MARKETS.has(market);
}

/**
 * **공개 화면**에서 걸 링크.
 *
 * ⚠ `PUBLISHED`가 아니면 **링크를 걸지 않는다.** `/stocks/<티커>`는 발행본만 읽고
 *    나머지는 404다 — 초안에 링크를 걸면 방문자가 404를 만난다.
 */
export function publicReportHref(
  holding: HoldingLike,
  index: Map<string, ReportLinkEntry>,
): string | undefined {
  const report = findReportFor(holding, index);
  if (!report || report.status !== "PUBLISHED") return undefined;
  return `/stocks/${encodeURIComponent(report.ticker)}`;
}

export type AdminReportLink =
  /** 보고서가 있다 — 편집 화면으로 */
  | { kind: "edit"; href: string; status: ReportStatus; name: string }
  /** 보고서가 없다 — 만들러 가기 */
  | { kind: "create"; href: string }
  /** 보고서를 쓸 자리가 아니다(현금성) 또는 티커가 없다 */
  | { kind: "none"; reason: string };

/**
 * **관리자 화면**에서 걸 링크.
 *
 * ⚠ 공개 화면과 달리 **초안에도 링크를 건다.** 쓰다 만 보고서로 돌아가는 길이 필요하다.
 * ⚠ 없으면 "만들기"를 준다 — 두 화면이 서로를 모르면 관리자가 매번 목록을 뒤져야 한다.
 */
export function adminReportLink(
  holding: HoldingLike,
  index: Map<string, ReportLinkEntry>,
): AdminReportLink {
  if (isNonStock(holding)) return { kind: "none", reason: "현금성 자리라 보고서를 쓰지 않습니다" };

  const ticker = holding.ticker?.trim();
  if (!ticker) return { kind: "none", reason: "티커가 없어 보고서를 이을 수 없습니다" };

  const report = findReportFor(holding, index);
  if (report) {
    return {
      kind: "edit",
      href: `/admin/stocks/${encodeURIComponent(report.ticker)}`,
      status: report.status,
      name: report.name,
    };
  }
  return { kind: "create", href: "/admin/stocks" };
}
