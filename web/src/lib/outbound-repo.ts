/**
 * 아웃바운드 클릭 집계의 DB 접근.
 *
 * 이 사이트의 1순위 성과 지표(티스토리로 넘어간 클릭)를 다룬다.
 * 개인 식별 정보는 저장하지 않고 (대상, 날짜, 합계)만 센다.
 */
import { execute, queryAll, queryOne } from "./d1";
import { clickDateKey } from "./outbound";

/** 클릭 1건 기록. 같은 (대상, 날짜)면 카운트만 올린다. */
export async function recordClick(target: string, date: string): Promise<void> {
  // D1(SQLite)의 UPSERT. @@unique([target, date]) 인덱스가 충돌 판정을 해 준다.
  await execute(
    `INSERT INTO OutboundClick (id, target, date, count, updatedAt)
       VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(target, date) DO UPDATE SET
       count = count + 1,
       updatedAt = excluded.updatedAt`,
    [`${target}_${date}`, target, date, new Date().toISOString()],
  );
}

export type ClickStats = {
  today: number;
  week: number;
  total: number;
  recent: { date: string; count: number }[];
};

export async function loadClickStats(now = new Date()): Promise<ClickStats> {
  const today = clickDateKey(now);
  // 날짜 문자열(YYYY-MM-DD)은 사전순 비교가 곧 시간순 비교라 별도 파싱이 필요 없다.
  const weekAgo = clickDateKey(new Date(now.getTime() - 6 * 86_400_000));

  const daily = await queryAll<{ date: string; count: number }>(
    `SELECT date, SUM(count) AS count FROM OutboundClick
      GROUP BY date ORDER BY date DESC LIMIT 30`,
  );
  const totalRow = await queryOne<{ total: number | null }>(
    `SELECT SUM(count) AS total FROM OutboundClick`,
  );

  return {
    today: daily.find((d) => d.date === today)?.count ?? 0,
    week: daily.filter((d) => d.date >= weekAgo).reduce((sum, d) => sum + d.count, 0),
    total: totalRow?.total ?? 0,
    recent: daily.slice(0, 7),
  };
}
