/**
 * 종목분석 보고서의 DB 접근.
 *
 * ⚠ 섹션 구성·정직성 규율은 `lib/report/catalog.ts`가 원본이다(코드 = 구조, DB = 내용).
 *
 * ## ⚠ 무료 등급의 벽을 여기서 넘지 않는다
 * Cloudflare 무료 등급은 **Worker 호출 하나당 D1 쿼리 50개**다(유료는 1,000개).
 * 섹션 13개를 하나씩 왕복하면 저장 한 번에 13+ 쿼리가 나가고, 읽기까지 겹치면 금방 닿는다.
 * 그래서
 *   - 읽기는 **4번**(보고서·섹션·CANSLIM·체크리스트)으로 끝낸다.
 *   - 쓰기는 **여러 행을 한 INSERT에** 담아 `batch()` 한 번으로 보낸다.
 *
 * ⚠ 한 문장의 **바인딩 파라미터는 100개**가 한도다. 그래서 열 개수로 나눠 자른다.
 *   (거시 시계열에서 이미 데인 규칙이다 — `features/macro/repository.ts`)
 */
import { execute, getD1, queryAll, queryOne, type D1Statement } from "@/lib/d1";
import { markdownToHtml } from "@/lib/markdown";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { ALL_SECTION_KEYS } from "@/lib/report/rules";
import type {
  ChecklistItem,
  ReportBlock,
  ReportDraft,
  ReportSectionKey,
  ReportStatus,
  StockMarket,
} from "@/lib/report/types";
import type { CanslimReading, DataTagKey } from "@/lib/canslim/types";
import { isCanslimKey } from "@/lib/canslim/catalog";
import { scoreCanslim } from "@/lib/canslim/score";

/** ⚠ 날짜만 있는 값은 **정오(UTC)** 로 저장한다. 자정으로 넣으면 화면에서 하루가 밀린다. */
function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

function dayOf(v: string | null | undefined): string | undefined {
  return v ? String(v).slice(0, 10) : undefined;
}

/** ⚠ id를 결정적으로 만든다 — D1에는 cuid 기본값이 없고, 같은 행을 두 번 만들면 안 된다. */
function blockId(ticker: string, sectionKey: string): string {
  return `${ticker}__${sectionKey}`;
}

function itemId(ticker: string, itemKey: string): string {
  return `${ticker}__${itemKey}`;
}

type ReportRow = {
  ticker: string;
  name: string;
  market: string;
  industry: string | null;
  currency: string;
  status: string;
  version: number;
  headline: string;
  verdictStructural: string | null;
  verdictShort: string | null;
  revokeIf: string | null;
  valuationLimitation: string | null;
  nextCheckAt: string | null;
  consensusTarget: number | null;
  consensusCurrency: string | null;
  consensusSource: string | null;
  consensusAsOf: string | null;
  consensusUrl: string | null;
  tistoryUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type StoredReport = ReportDraft & {
  version: number;
  publishedAt?: string;
  updatedAt?: string;
  /** 화면이 읽는 정화된 HTML — 섹션 키 → HTML */
  html: Map<ReportSectionKey, string>;
  /** CANSLIM 채점 — `lib/canslim/score.scoreCanslim()`에 그대로 넘긴다 */
  readings: Map<string, CanslimReading>;
};

function normalizeTag(v: string | null): DataTagKey | undefined {
  return v === "confirmed" || v === "needsCheck" || v === "na" ? v : undefined;
}

/** 목록 화면용 요약. ⚠ 본문을 읽지 않는다 — 목록에서 13섹션을 전부 끌어오면 낭비다. */
export type ReportSummary = {
  ticker: string;
  name: string;
  market: StockMarket;
  status: ReportStatus;
  headline: string;
  version: number;
  nextCheckAt?: string;
  updatedAt?: string;
};

export async function loadReportSummaries(): Promise<ReportSummary[]> {
  const rows = await queryAll<{
    ticker: string;
    name: string;
    market: string;
    status: string;
    headline: string;
    version: number;
    nextCheckAt: string | null;
    updatedAt: string | null;
  }>(
    `SELECT ticker, name, market, status, headline, version, nextCheckAt, updatedAt
       FROM StockReport ORDER BY updatedAt DESC`,
  );

  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    market: r.market === "KR" ? "KR" : "US",
    status: r.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    headline: r.headline,
    version: r.version,
    nextCheckAt: dayOf(r.nextCheckAt),
    updatedAt: r.updatedAt ?? undefined,
  }));
}

/** 공개 목록용 — 발행본 요약 + CANSLIM 종합. */
export type PublishedSummary = ReportSummary & {
  industry?: string;
  /** 0~10. ⚠ 채점된 축이 없으면 undefined다. 0으로 내지 않는다. */
  composite10?: number;
  publishedAt?: string;
};

/**
 * 발행본 목록.
 *
 * ⚠ 종목마다 채점을 따로 읽지 않는다 — 종목 수만큼 왕복하면 무료 등급의
 *    "호출당 50쿼리"를 목록 화면 하나가 먹는다. **쿼리 2번**으로 끝낸다.
 */
export async function loadPublishedSummaries(limit = 50): Promise<PublishedSummary[]> {
  const rows = await queryAll<{
    ticker: string;
    name: string;
    market: string;
    industry: string | null;
    headline: string;
    version: number;
    nextCheckAt: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
  }>(
    `SELECT ticker, name, market, industry, headline, version, nextCheckAt, publishedAt, updatedAt
       FROM StockReport WHERE status = 'PUBLISHED'
      ORDER BY publishedAt DESC LIMIT ?`,
    [limit],
  );
  if (rows.length === 0) return [];

  const itemRows = await queryAll<{ ticker: string; itemKey: string; points: number | null; tag: string }>(
    `SELECT ticker, itemKey, points, tag FROM StockReportItem
      WHERE ticker IN (${rows.map(() => "?").join(", ")})`,
    rows.map((r) => r.ticker),
  );

  const byTicker = new Map<string, Map<string, CanslimReading>>();
  for (const i of itemRows) {
    if (!isCanslimKey(i.itemKey)) continue;
    const bucket = byTicker.get(i.ticker) ?? new Map<string, CanslimReading>();
    bucket.set(i.itemKey, {
      key: i.itemKey as CanslimReading["key"],
      points: i.points ?? undefined,
      tag: normalizeTag(i.tag) ?? "na",
    });
    byTicker.set(i.ticker, bucket);
  }

  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    market: r.market === "KR" ? "KR" : "US",
    status: "PUBLISHED" as const,
    headline: r.headline,
    version: r.version,
    industry: r.industry ?? undefined,
    nextCheckAt: dayOf(r.nextCheckAt),
    publishedAt: r.publishedAt ?? undefined,
    updatedAt: r.updatedAt ?? undefined,
    composite10: scoreCanslim(byTicker.get(r.ticker) ?? new Map()).composite10,
  }));
}

/** 글에서 종목을 가리킬 때 쓰는 최소 조회 — 발행본이 없으면 null(링크를 걸지 않는다). */
export async function findPublishedName(ticker: string): Promise<string | null> {
  const row = await queryOne<{ name: string }>(
    `SELECT name FROM StockReport WHERE ticker = ? AND status = 'PUBLISHED'`,
    [ticker],
  );
  return row?.name ?? null;
}

/**
 * 보고서 한 건을 통째로 읽는다. 없으면 null.
 * ⚠ 쿼리 **4번**으로 끝낸다(무료 등급 50개 한도).
 */
export async function loadReport(ticker: string): Promise<StoredReport | null> {
  const row = await queryOne<ReportRow>(
    `SELECT ticker, name, market, industry, currency, status, version, headline,
            verdictStructural, verdictShort, revokeIf, valuationLimitation, nextCheckAt,
            consensusTarget, consensusCurrency, consensusSource, consensusAsOf, consensusUrl,
            tistoryUrl, publishedAt, updatedAt
       FROM StockReport WHERE ticker = ?`,
    [ticker],
  );
  if (!row) return null;

  const blockRows = await queryAll<{
    sectionKey: string;
    body: string;
    bodyHtml: string;
    tag: string | null;
    source: string | null;
    sourceUrl: string | null;
    asOf: string | null;
    lookupHint: string | null;
  }>(
    `SELECT sectionKey, body, bodyHtml, tag, source, sourceUrl, asOf, lookupHint
       FROM StockReportBlock WHERE ticker = ?`,
    [ticker],
  );

  const itemRows = await queryAll<{
    itemKey: string;
    points: number | null;
    tag: string;
    evidence: string | null;
    source: string | null;
    sourceUrl: string | null;
    asOf: string | null;
  }>(
    `SELECT itemKey, points, tag, evidence, source, sourceUrl, asOf
       FROM StockReportItem WHERE ticker = ?`,
    [ticker],
  );

  const checkRows = await queryAll<{ item: string; source: string; impact: string }>(
    `SELECT item, source, impact FROM StockChecklistItem WHERE ticker = ? ORDER BY "order"`,
    [ticker],
  );

  const known = new Set<string>(ALL_SECTION_KEYS);
  // ⚠ 모르는 섹션 키는 버린다. 카탈로그에서 섹션을 지운 뒤 남은 행이 화면을 깨지 않게.
  const blocks: ReportBlock[] = blockRows
    .filter((b) => known.has(b.sectionKey))
    .map((b) => ({
      sectionKey: b.sectionKey as ReportSectionKey,
      body: b.body,
      tag: normalizeTag(b.tag),
      source: b.source ?? undefined,
      sourceUrl: b.sourceUrl ?? undefined,
      asOf: dayOf(b.asOf),
      lookupHint: b.lookupHint ?? undefined,
    }));

  const html = new Map<ReportSectionKey, string>(
    blockRows
      .filter((b) => known.has(b.sectionKey))
      .map((b) => [b.sectionKey as ReportSectionKey, b.bodyHtml]),
  );

  const readings = new Map<string, CanslimReading>(
    itemRows
      .filter((i) => isCanslimKey(i.itemKey))
      .map((i) => [
        i.itemKey,
        {
          key: i.itemKey as CanslimReading["key"],
          // ⚠ null이면 N/A다. 0으로 바꾸지 않는다(R1).
          points: i.points ?? undefined,
          tag: normalizeTag(i.tag) ?? "na",
          evidence: i.evidence ?? undefined,
          source: i.source ?? undefined,
          sourceUrl: i.sourceUrl ?? undefined,
          asOf: dayOf(i.asOf),
        },
      ]),
  );

  return {
    ticker: row.ticker,
    name: row.name,
    market: row.market === "KR" ? "KR" : "US",
    industry: row.industry ?? undefined,
    status: row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    version: row.version,
    headline: row.headline,
    verdictStructural: row.verdictStructural ?? undefined,
    verdictShort: row.verdictShort ?? undefined,
    revokeIf: row.revokeIf ?? undefined,
    valuationLimitation: row.valuationLimitation ?? undefined,
    nextCheckAt: dayOf(row.nextCheckAt),
    consensusTarget:
      row.consensusTarget != null
        ? {
            value: row.consensusTarget,
            currency: row.consensusCurrency ?? row.currency,
            source: row.consensusSource ?? "",
            asOf: dayOf(row.consensusAsOf) ?? "",
            sourceUrl: row.consensusUrl ?? undefined,
          }
        : undefined,
    tistoryUrl: row.tistoryUrl ?? undefined,
    blocks,
    checklist: checkRows.map((c) => ({ item: c.item, source: c.source, impact: c.impact })),
    html,
    readings,
    publishedAt: row.publishedAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

/** 공개 화면용 — ⚠ **PUBLISHED만** 읽는다. */
export async function loadPublishedReport(ticker: string): Promise<StoredReport | null> {
  const report = await loadReport(ticker);
  return report?.status === "PUBLISHED" ? report : null;
}

/**
 * 보고서를 저장한다(생성 겸 갱신).
 *
 * ⚠ 본문 저장 경로는 **하나뿐이다**: 원본 → `lib/markdown` → `lib/sanitize-html` → `bodyHtml`.
 *    글(Post)과 같은 규칙이다. 화면이 `bodyHtml`만 읽으므로 여기를 우회하면 정화가 빠진다.
 */
export async function saveReport(draft: ReportDraft): Promise<void> {
  const db = await getD1();
  const now = new Date().toISOString();
  const statements: D1Statement[] = [];

  statements.push(
    db
      .prepare(
        `INSERT INTO StockReport
           (ticker, name, market, industry, currency, status, headline,
            verdictStructural, verdictShort, revokeIf, valuationLimitation, nextCheckAt,
            consensusTarget, consensusCurrency, consensusSource, consensusAsOf, consensusUrl,
            tistoryUrl, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(ticker) DO UPDATE SET
           name = excluded.name, market = excluded.market, industry = excluded.industry,
           currency = excluded.currency, status = excluded.status, headline = excluded.headline,
           verdictStructural = excluded.verdictStructural, verdictShort = excluded.verdictShort,
           revokeIf = excluded.revokeIf, valuationLimitation = excluded.valuationLimitation,
           nextCheckAt = excluded.nextCheckAt, consensusTarget = excluded.consensusTarget,
           consensusCurrency = excluded.consensusCurrency, consensusSource = excluded.consensusSource,
           consensusAsOf = excluded.consensusAsOf, consensusUrl = excluded.consensusUrl,
           tistoryUrl = excluded.tistoryUrl, updatedAt = excluded.updatedAt`,
      )
      .bind(
        draft.ticker,
        draft.name,
        draft.market,
        draft.industry ?? null,
        draft.consensusTarget?.currency ?? (draft.market === "KR" ? "KRW" : "USD"),
        draft.status,
        draft.headline,
        draft.verdictStructural ?? null,
        draft.verdictShort ?? null,
        draft.revokeIf ?? null,
        draft.valuationLimitation ?? null,
        draft.nextCheckAt ? toStoredDate(draft.nextCheckAt) : null,
        draft.consensusTarget?.value ?? null,
        draft.consensusTarget?.currency ?? null,
        draft.consensusTarget?.source ?? null,
        draft.consensusTarget?.asOf ? toStoredDate(draft.consensusTarget.asOf) : null,
        draft.consensusTarget?.sourceUrl ?? null,
        draft.tistoryUrl ?? null,
        now,
      ),
  );

  // 지워진 섹션은 DB에서도 지운다. ⚠ 남겨 두면 발행 화면과 저장 내용이 어긋난다.
  const keptKeys = draft.blocks.map((b) => b.sectionKey);
  statements.push(
    keptKeys.length > 0
      ? db
          .prepare(
            `DELETE FROM StockReportBlock WHERE ticker = ? AND sectionKey NOT IN (${keptKeys
              .map(() => "?")
              .join(", ")})`,
          )
          .bind(draft.ticker, ...keptKeys)
      : db.prepare(`DELETE FROM StockReportBlock WHERE ticker = ?`).bind(draft.ticker),
  );

  // ⚠ 열이 11개라 한 문장에 9행까지(=99 바인딩). 100개 한도를 넘기지 않는다.
  const BLOCK_COLS = 11;
  const blocksPerStatement = Math.floor(100 / BLOCK_COLS);
  for (let i = 0; i < draft.blocks.length; i += blocksPerStatement) {
    const chunk = draft.blocks.slice(i, i + blocksPerStatement);
    const params: unknown[] = [];
    for (const b of chunk) {
      params.push(
        blockId(draft.ticker, b.sectionKey),
        draft.ticker,
        b.sectionKey,
        b.body,
        sanitizeHtml(markdownToHtml(b.body)),
        b.tag ?? null,
        b.source ?? null,
        b.sourceUrl ?? null,
        b.asOf ? toStoredDate(b.asOf) : null,
        b.lookupHint ?? null,
        now,
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO StockReportBlock
             (id, ticker, sectionKey, body, bodyHtml, tag, source, sourceUrl, asOf, lookupHint, updatedAt)
           VALUES ${chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ")}
           ON CONFLICT(ticker, sectionKey) DO UPDATE SET
             body = excluded.body, bodyHtml = excluded.bodyHtml, tag = excluded.tag,
             source = excluded.source, sourceUrl = excluded.sourceUrl, asOf = excluded.asOf,
             lookupHint = excluded.lookupHint, updatedAt = excluded.updatedAt`,
        )
        .bind(...params),
    );
  }

  // 체크리스트는 통째로 갈아 끼운다 — 순서가 의미를 갖고 줄 수가 자주 바뀐다.
  statements.push(db.prepare(`DELETE FROM StockChecklistItem WHERE ticker = ?`).bind(draft.ticker));
  if (draft.checklist.length > 0) {
    const params: unknown[] = [];
    draft.checklist.forEach((c, i) => {
      params.push(`${draft.ticker}__c${i}`, draft.ticker, c.item, c.source, c.impact, i);
    });
    statements.push(
      db
        .prepare(
          `INSERT INTO StockChecklistItem (id, ticker, item, source, impact, "order")
           VALUES ${draft.checklist.map(() => `(?, ?, ?, ?, ?, ?)`).join(", ")}`,
        )
        .bind(...params),
    );
  }

  await db.batch(statements);
}

/** CANSLIM 한 축을 저장한다. ⚠ `points`가 undefined면 **N/A**로 저장된다(0이 아니다). */
export async function saveReading(ticker: string, reading: CanslimReading): Promise<void> {
  await execute(
    `INSERT INTO StockReportItem
       (id, ticker, itemKey, points, tag, evidence, source, sourceUrl, asOf, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker, itemKey) DO UPDATE SET
       points = excluded.points, tag = excluded.tag, evidence = excluded.evidence,
       source = excluded.source, sourceUrl = excluded.sourceUrl, asOf = excluded.asOf,
       updatedAt = excluded.updatedAt`,
    [
      itemId(ticker, reading.key),
      ticker,
      reading.key,
      reading.tag === "na" ? null : (reading.points ?? null),
      reading.tag,
      reading.evidence ?? null,
      reading.source ?? null,
      reading.sourceUrl ?? null,
      reading.asOf ? toStoredDate(reading.asOf) : null,
      new Date().toISOString(),
    ],
  );
}

/**
 * 발행 상태를 바꾼다.
 * ⚠ **규율 검증은 호출부(서버 액션)가 먼저 한다.** repository는 질의만 한다 —
 *    판단을 여기 넣으면 화면과 저장이 각자 판정하게 된다.
 */
export async function setReportStatus(ticker: string, status: ReportStatus): Promise<void> {
  const now = new Date().toISOString();
  if (status === "PUBLISHED") {
    await execute(
      `UPDATE StockReport
          SET status = 'PUBLISHED', publishedAt = ?, version = version + 1, updatedAt = ?
        WHERE ticker = ?`,
      [now, now, ticker],
    );
    return;
  }
  await execute(`UPDATE StockReport SET status = 'DRAFT', updatedAt = ? WHERE ticker = ?`, [
    now,
    ticker,
  ]);
}

export async function deleteReport(ticker: string): Promise<void> {
  // 자식 행은 ON DELETE CASCADE로 함께 지워진다.
  await execute(`DELETE FROM StockReport WHERE ticker = ?`, [ticker]);
}

/** 체크리스트만 따로 갈아 끼운다(편집 화면에서 자주 쓰인다). */
export async function replaceChecklist(ticker: string, rows: ChecklistItem[]): Promise<void> {
  const db = await getD1();
  const statements: D1Statement[] = [
    db.prepare(`DELETE FROM StockChecklistItem WHERE ticker = ?`).bind(ticker),
  ];

  if (rows.length > 0) {
    const params: unknown[] = [];
    rows.forEach((c, i) => params.push(`${ticker}__c${i}`, ticker, c.item, c.source, c.impact, i));
    statements.push(
      db
        .prepare(
          `INSERT INTO StockChecklistItem (id, ticker, item, source, impact, "order")
           VALUES ${rows.map(() => `(?, ?, ?, ?, ?, ?)`).join(", ")}`,
        )
        .bind(...params),
    );
  }
  await db.batch(statements);
}

/**
 * 티스토리에 옮겨 실은 원문 주소. `/go/stock-<ticker>` 경유가 쓴다.
 *
 * ⚠ **발행본만** 본다. 초안의 주소로 나가면 아직 공개하지 않은 글이 새어 나간다.
 * ⚠ 저장된 값만 돌려준다 — 요청이 준 URL을 따라가는 경로는 어디에도 없다(오픈 리다이렉트).
 */
export async function findPublishedTistoryUrl(ticker: string): Promise<string | null> {
  const row = await queryOne<{ tistoryUrl: string | null }>(
    `SELECT tistoryUrl FROM StockReport WHERE ticker = ? AND status = 'PUBLISHED'`,
    [ticker],
  );
  return row?.tistoryUrl ?? null;
}
