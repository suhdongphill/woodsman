/**
 * 포트폴리오 버킷 저장소 — D1 질의만 한다.
 *
 * ⚠ 판단(합계 100 이하 · 삭제 가능 여부 · 배정/미배정)은 여기서 하지 않는다.
 *    `lib/bucket-target.ts`가 순수 함수로 한다. 같은 판단이 두 곳에 생기면 화면마다
 *    다른 숫자가 나온다.
 */
import { execute, getD1, queryAll, queryOne, toBool, type D1Statement } from "@/lib/d1";
import { sortBuckets, type PortfolioBucket } from "@/lib/bucket-target";

type BucketRow = {
  key: string;
  name: string;
  description: string | null;
  targetPct: number;
  color: string;
  sortOrder: number;
  builtIn: number;
};

const COLUMNS = `key, name, description, targetPct, color, sortOrder, builtIn`;

function toBucket(row: BucketRow): PortfolioBucket {
  return {
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    targetPct: row.targetPct ?? 0,
    color: row.color,
    sortOrder: row.sortOrder ?? 0,
    // ⚠ SQLite에 boolean이 없다. 문자열 "0"은 true라서 반드시 toBool을 거친다.
    builtIn: toBool(row.builtIn),
  };
}

/**
 * 버킷 전체 — 표시 순서대로.
 *
 * ⚠ 빈 배열이 돌아오면 **버킷이 없는 것**이지 "읽지 못한 것"이 아니다.
 *    읽지 못하면 `queryAll`이 던진다(`lib/d1.ts`가 로그를 남기고 다시 던진다).
 */
export async function loadBuckets(): Promise<PortfolioBucket[]> {
  const rows = await queryAll<BucketRow>(
    `SELECT ${COLUMNS} FROM PortfolioBucket ORDER BY sortOrder ASC, key ASC`,
  );
  return sortBuckets(rows.map(toBucket));
}

export async function findBucket(key: string): Promise<PortfolioBucket | null> {
  const row = await queryOne<BucketRow>(
    `SELECT ${COLUMNS} FROM PortfolioBucket WHERE key = ?`,
    [key],
  );
  return row ? toBucket(row) : null;
}

/** 그 버킷을 쓰는 보유 종목 수 — 삭제 전에 확인한다(갈 곳 없는 분류를 만들지 않는다). */
export async function countHoldingsInBucket(key: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ModelHolding WHERE functionType = ?`,
    [key],
  );
  return row?.n ?? 0;
}

/** 버킷 하나를 만든다. ⚠ 키 충돌 검사는 부르는 쪽이 `validateNewBucket`으로 한다. */
export async function createBucket(input: {
  key: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
}): Promise<void> {
  await execute(
    `INSERT INTO PortfolioBucket (key, name, description, targetPct, color, sortOrder, builtIn, updatedAt)
     VALUES (?, ?, ?, 0, ?, ?, 0, ?)`,
    [
      input.key,
      input.name,
      input.description ?? null,
      input.color,
      input.sortOrder,
      new Date().toISOString(),
    ],
  );
}

/**
 * 이름·설명·색·순서를 고친다.
 *
 * ⚠ **`key`와 `builtIn`은 건드리지 않는다.** 키는 보유 종목이 참조하고,
 *    builtIn은 삭제 가능 여부를 정하는 값이라 화면에서 바뀌면 안 된다.
 */
export async function updateBucketMeta(
  key: string,
  input: { name: string; description?: string; color: string; sortOrder: number },
): Promise<void> {
  await execute(
    `UPDATE PortfolioBucket SET name = ?, description = ?, color = ?, sortOrder = ?, updatedAt = ?
       WHERE key = ?`,
    [
      input.name,
      input.description ?? null,
      input.color,
      input.sortOrder,
      new Date().toISOString(),
      key,
    ],
  );
}

/**
 * 목표 구성비를 한꺼번에 갈아 끼운다.
 *
 * ⚠ **한 번에 쓴다.** 버킷마다 따로 저장하면 중간에 실패했을 때 합계가 100을 넘는
 *    상태로 남는다 — 검증을 통과한 조합이 저장 뒤에 깨지는 셈이다.
 * ⚠ 무료 등급은 Worker 호출당 D1 쿼리 50개다. 버킷 수만큼 문장이 나가지만
 *    한 batch로 묶어 왕복은 1번이다.
 */
export async function saveTargets(targets: { key: string; targetPct: number }[]): Promise<void> {
  if (targets.length === 0) return;

  const db = await getD1();
  const now = new Date().toISOString();

  const statements: D1Statement[] = targets.map((t) =>
    db
      .prepare(`UPDATE PortfolioBucket SET targetPct = ?, updatedAt = ? WHERE key = ?`)
      .bind(t.targetPct, now, t.key),
  );

  await db.batch(statements);
}

/** 버킷을 지운다. ⚠ 지워도 되는지는 부르는 쪽이 `canDeleteBucket`으로 판단한다. */
export async function deleteBucket(key: string): Promise<void> {
  await execute(`DELETE FROM PortfolioBucket WHERE key = ?`, [key]);
}

/** 새 버킷의 기본 순서 — 맨 뒤에 붙인다. */
export async function nextSortOrder(): Promise<number> {
  const row = await queryOne<{ maxOrder: number | null }>(
    `SELECT MAX(sortOrder) AS maxOrder FROM PortfolioBucket`,
  );
  return (row?.maxOrder ?? -1) + 1;
}
