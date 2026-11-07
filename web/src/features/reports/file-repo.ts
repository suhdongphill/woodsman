/**
 * 종목별 보고서 파일·블로그 연결(`StockReportFile`) DB 접근. 규칙은 `lib/report/file.ts`.
 *
 * ⚠ 포트폴리오·목록은 보조 정보로 읽으므로 실패해도 화면을 죽이지 않되 **반드시 console.error**(CLAUDE.md §3).
 *    관리자 화면과 상세는 삼키지 않는다.
 */
import { execute, queryAll, queryOne } from "@/lib/d1";
import { pickStockBlogUrl } from "@/lib/report/file";

export type ReportFileStatus = "DRAFT" | "PUBLISHED";

export type ReportFileRow = {
  ticker: string;
  name: string;
  headline: string;
  blogUrl: string | null;
  sourceName: string | null;
  status: ReportFileStatus;
  publishedAt: string | null;
  updatedAt: string;
  hasHtml: boolean;
};

type Row = Omit<ReportFileRow, "status" | "hasHtml"> & { status: string; hasHtml: number };

const COLUMNS = `ticker, name, headline, blogUrl, sourceName, status, publishedAt, updatedAt, html IS NOT NULL AS hasHtml`;

function toRow(r: Row): ReportFileRow {
  return { ...r, status: r.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT", hasHtml: !!r.hasHtml };
}

export async function loadAllReportFiles(): Promise<ReportFileRow[]> {
  const rows = await queryAll<Row>(`SELECT ${COLUMNS} FROM StockReportFile ORDER BY updatedAt DESC LIMIT 500`);
  return rows.map(toRow);
}

/** 공개된 연결 전부. 실패하면 빈 목록 + 로그 — 보조 정보라 화면을 죽이지 않는다. */
export async function loadPublishedReportFiles(): Promise<ReportFileRow[]> {
  try {
    const rows = await queryAll<Row>(
      `SELECT ${COLUMNS} FROM StockReportFile WHERE status = 'PUBLISHED' ORDER BY publishedAt DESC LIMIT 500`,
    );
    return rows.map(toRow);
  } catch (error) {
    console.error("[report-file] 공개 목록을 읽지 못했다", error);
    return [];
  }
}

export type ReportFileDetail = ReportFileRow & { html: string | null };

export async function findReportFile(ticker: string): Promise<ReportFileDetail | null> {
  const row = await queryOne<Row & { html: string | null }>(
    `SELECT ${COLUMNS}, html FROM StockReportFile WHERE ticker = ?`,
    [ticker],
  );
  return row ? { ...toRow(row), html: row.html } : null;
}

export async function findPublishedReportFile(ticker: string): Promise<ReportFileDetail | null> {
  const file = await findReportFile(ticker.trim().toUpperCase());
  return file?.status === "PUBLISHED" ? file : null;
}

/** 파일 없이 저장하면 있던 HTML을 그대로 둔다. ⚠ 공개 상태도 건드리지 않는다 — 공개는 따로 누른다. */
export async function saveReportFile(input: {
  ticker: string;
  name: string;
  headline: string;
  blogUrl: string | null;
  html?: string;
  sourceName?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO StockReportFile (ticker, name, headline, html, blogUrl, sourceName, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET name = excluded.name, headline = excluded.headline,
       html = COALESCE(excluded.html, html), blogUrl = excluded.blogUrl,
       sourceName = COALESCE(excluded.sourceName, sourceName), updatedAt = excluded.updatedAt`,
    [input.ticker, input.name, input.headline, input.html ?? null, input.blogUrl, input.sourceName ?? null, now, now],
  );
}

export async function setReportFileStatus(ticker: string, status: ReportFileStatus): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE StockReportFile SET status = ?, publishedAt = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(publishedAt, ?) ELSE publishedAt END, updatedAt = ? WHERE ticker = ?`,
    [status, status, now, now, ticker],
  );
}

export async function deleteReportFile(ticker: string): Promise<void> {
  await execute("DELETE FROM StockReportFile WHERE ticker = ?", [ticker]);
}

/**
 * `/go/stock-<티커>`의 목적지 — 저장해 둔 값에서만 나온다.
 * 순서: 구조화 보고서의 원문 → 공개된 연결 → 공개 종목의 관련 글 링크.
 */
export async function findStockBlogUrl(ticker: string): Promise<string | null> {
  const row = await queryOne<{ report: string | null; file: string | null; holding: string | null }>(
    `SELECT
       (SELECT tistoryUrl FROM StockReport WHERE UPPER(TRIM(ticker)) = UPPER(TRIM(?1)) AND status = 'PUBLISHED' LIMIT 1) AS report,
       (SELECT blogUrl FROM StockReportFile WHERE ticker = UPPER(TRIM(?1)) AND status = 'PUBLISHED') AS file,
       (SELECT blogUrl FROM ModelHolding WHERE UPPER(TRIM(ticker)) = UPPER(TRIM(?1)) AND published = 1 LIMIT 1) AS holding`,
    [ticker],
  );
  return row ? pickStockBlogUrl(row.report, row.file, row.holding) : null;
}
