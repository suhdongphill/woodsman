/**
 * 대표 포트폴리오(ModelHolding) · 리밸런싱 기록(Rebalance)의 DB 접근.
 *
 * ## 왜 이걸 만들었나
 * 투자일지와 **똑같은 문제**였다. 화면이 `src/lib/mock.ts`를 읽고 있어서
 * 관리자 화면에서 목표 비중을 고칠 방법이 아예 없었다. 시드는 D1에 같은 종목을
 * 넣어 두었는데 화면은 파일을 보고 있었다.
 *
 * 대표 포트폴리오는 이 사이트가 "무엇을 어떻게 굴리는지" 보여주는 뼈대다.
 * 목표 비중을 못 고치면 리밸런싱 기록도 거짓이 된다.
 *
 * ⚠ 날짜(리밸런싱 일자·시세 기준일)는 DATETIME으로 들어 있다. 화면은 `YYYY-MM-DD`만
 *    쓰므로 읽을 때 앞 10자를 자르고, 쓸 때는 **정오(UTC)**로 맞춘다
 *    (자정으로 넣으면 화면에서 하루가 밀린다 — features/journal/repository.ts와 같은 규칙).
 */
import { execute, queryAll, queryOne, toBool } from "@/lib/d1";
import type { FunctionType, ModelHolding, Rebalance } from "@/lib/types";

/** DATETIME → YYYY-MM-DD */
function dayOf(value: string): string {
  return String(value).slice(0, 10);
}

/** YYYY-MM-DD → 저장용 ISO. 시각은 정오로 둔다. */
function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

type HoldingRow = {
  id: string;
  name: string;
  ticker: string | null;
  market: string | null;
  functionType: string;
  targetWeight: number | null;
  avgCost: number | null;
  shares: number | null;
  currency: string | null;
  price: number | null;
  priceAsOf: string | null;
  thesis: string | null;
  canslim: number | null;
  blogUrl: string | null;
  order: number;
  published: number;
  updatedAt: string;
};

function toHolding(row: HoldingRow): ModelHolding {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker ?? undefined,
    market: row.market ?? undefined,
    functionType: row.functionType as FunctionType,
    targetWeight: row.targetWeight ?? undefined,
    avgCost: row.avgCost ?? undefined,
    shares: row.shares ?? undefined,
    currency: (row.currency as "KRW" | "USD" | null) ?? undefined,
    price: row.price ?? undefined,
    priceAsOf: row.priceAsOf ? dayOf(row.priceAsOf) : undefined,
    thesis: row.thesis ?? undefined,
    canslim: row.canslim ?? undefined,
    blogUrl: row.blogUrl ?? undefined,
    order: row.order,
    published: toBool(row.published),
    updatedAt: row.updatedAt,
  };
}

/** `order`는 SQLite 예약어라 반드시 따옴표로 감싼다. */
const HOLDING_COLUMNS = `id, name, ticker, market, functionType, targetWeight, avgCost, shares,
       currency, price, priceAsOf, thesis, canslim, blogUrl, "order", published, updatedAt`;

/** 공개 화면용 — 발행된 것만, 정렬 순서대로. */
export async function loadPublishedHoldings(limit = 100): Promise<ModelHolding[]> {
  const rows = await queryAll<HoldingRow>(
    `SELECT ${HOLDING_COLUMNS} FROM ModelHolding WHERE published = 1 ORDER BY "order" ASC LIMIT ?`,
    [limit],
  );
  return rows.map(toHolding);
}

/** 관리자용 — 미공개 포함. */
export async function loadAllHoldings(limit = 200): Promise<ModelHolding[]> {
  const rows = await queryAll<HoldingRow>(
    `SELECT ${HOLDING_COLUMNS} FROM ModelHolding ORDER BY "order" ASC LIMIT ?`,
    [limit],
  );
  return rows.map(toHolding);
}

export async function findHolding(id: string): Promise<ModelHolding | null> {
  const row = await queryOne<HoldingRow>(
    `SELECT ${HOLDING_COLUMNS} FROM ModelHolding WHERE id = ?`,
    [id],
  );
  return row ? toHolding(row) : null;
}

/** 종목 상세 화면이 "이 종목이 대표 포트폴리오에 있나"를 물을 때. 공개된 것만 본다. */
export async function findPublishedHoldingByTicker(ticker: string): Promise<ModelHolding | null> {
  const row = await queryOne<HoldingRow>(
    `SELECT ${HOLDING_COLUMNS} FROM ModelHolding WHERE published = 1 AND ticker = ? LIMIT 1`,
    [ticker],
  );
  return row ? toHolding(row) : null;
}

export type HoldingInput = {
  name: string;
  ticker?: string;
  market?: string;
  functionType: FunctionType;
  targetWeight?: number;
  avgCost?: number;
  shares?: number;
  currency: "KRW" | "USD";
  price?: number;
  priceAsOf?: string;
  thesis?: string;
  canslim?: number;
  blogUrl?: string;
  order: number;
  published: boolean;
};

/** id를 주면 수정, 없으면 새로 만든다. */
export async function saveHolding(input: HoldingInput, id?: string): Promise<void> {
  const now = new Date().toISOString();
  const values = [
    input.name,
    input.ticker ?? null,
    input.market ?? null,
    input.functionType,
    input.targetWeight ?? null,
    input.avgCost ?? null,
    input.shares ?? null,
    input.currency,
    input.price ?? null,
    input.priceAsOf ? toStoredDate(input.priceAsOf) : null,
    input.thesis ?? null,
    input.canslim ?? null,
    input.blogUrl ?? null,
    input.order,
    input.published ? 1 : 0,
    now,
  ];

  if (id) {
    await execute(
      `UPDATE ModelHolding SET name = ?, ticker = ?, market = ?, functionType = ?, targetWeight = ?,
              avgCost = ?, shares = ?, currency = ?, price = ?, priceAsOf = ?, thesis = ?,
              canslim = ?, blogUrl = ?, "order" = ?, published = ?, updatedAt = ?
         WHERE id = ?`,
      [...values, id],
    );
    return;
  }

  await execute(
    `INSERT INTO ModelHolding
       (id, name, ticker, market, functionType, targetWeight, avgCost, shares, currency,
        price, priceAsOf, thesis, canslim, blogUrl, "order", published, updatedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`mh_${now}_${Math.floor(performance.now())}`, ...values, now],
  );
}

export async function deleteHolding(id: string): Promise<void> {
  await execute(`DELETE FROM ModelHolding WHERE id = ?`, [id]);
}

/**
 * 다음 정렬 번호. 새 종목은 목록 끝에 붙는다.
 * (순서를 손으로 넣게 하면 매번 마지막 번호를 찾아봐야 해서 안 쓰게 된다.)
 */
export async function nextHoldingOrder(): Promise<number> {
  const row = await queryOne<{ max: number | null }>(
    `SELECT MAX("order") AS max FROM ModelHolding`,
  );
  return (row?.max ?? 0) + 1;
}

// ────────────── 리밸런싱 기록 ──────────────

type RebalanceRow = { id: string; date: string; memo: string };

export async function loadRebalances(limit = 50): Promise<Rebalance[]> {
  const rows = await queryAll<RebalanceRow>(
    `SELECT id, date, memo FROM Rebalance ORDER BY date DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({ id: r.id, date: dayOf(r.date), memo: r.memo }));
}

export type RebalanceInput = { date: string; memo: string };

export async function saveRebalance(input: RebalanceInput, id?: string): Promise<void> {
  const now = new Date().toISOString();

  if (id) {
    await execute(`UPDATE Rebalance SET date = ?, memo = ? WHERE id = ?`, [
      toStoredDate(input.date),
      input.memo,
      id,
    ]);
    return;
  }

  await execute(
    `INSERT INTO Rebalance (id, date, memo, createdAt) VALUES (?, ?, ?, ?)`,
    [`rb_${now}_${Math.floor(performance.now())}`, toStoredDate(input.date), input.memo, now],
  );
}

export async function deleteRebalance(id: string): Promise<void> {
  await execute(`DELETE FROM Rebalance WHERE id = ?`, [id]);
}
