/**
 * 아웃바운드 클릭 집계의 DB 접근.
 *
 * 이 사이트의 1순위 성과 지표(티스토리로 넘어간 클릭)를 다룬다.
 * 개인 식별 정보는 저장하지 않고 (대상, 날짜, 합계)만 센다.
 */
import { execute, queryAll, queryOne } from "./d1";
import { clickDateKey } from "./outbound";

/**
 * 클릭 1건 기록. 같은 (대상, 날짜)면 카운트만 올린다.
 *
 * ⚠ `bot`이면 **`count`가 아니라 `botCount`**에 담는다. 버리지 않는 이유는
 *    우리가 무엇을 얼마나 걸렀는지 나중에 볼 수 있어야 하기 때문이다 —
 *    자[尺]를 고쳤으면 얼마나 고쳤는지도 기록에 남아야 한다.
 */
export async function recordClick(
  target: string,
  date: string,
  options: { bot?: boolean } = {},
): Promise<void> {
  const column = options.bot ? "botCount" : "count";
  // D1(SQLite)의 UPSERT. @@unique([target, date]) 인덱스가 충돌 판정을 해 준다.
  // ⚠ 컬럼 이름은 위에서 **우리가 고른 두 값 중 하나**다 — 바깥에서 들어온 문자열이 아니다.
  await execute(
    `INSERT INTO OutboundClick (id, target, date, count, botCount, updatedAt)
       VALUES (?, ?, ?, ${options.bot ? 0 : 1}, ${options.bot ? 1 : 0}, ?)
     ON CONFLICT(target, date) DO UPDATE SET
       ${column} = ${column} + 1,
       updatedAt = excluded.updatedAt`,
    [`${target}_${date}`, target, date, new Date().toISOString()],
  );
}

export type ClickStats = {
  today: number;
  week: number;
  total: number;
  recent: { date: string; count: number }[];
  /** ⚠ 봇·프리페치라서 세지 않은 수(최근 7일). 0이 아니면 화면이 그 사실을 밝힌다. */
  botWeek: number;
};

export async function loadClickStats(now = new Date()): Promise<ClickStats> {
  const today = clickDateKey(now);
  // 날짜 문자열(YYYY-MM-DD)은 사전순 비교가 곧 시간순 비교라 별도 파싱이 필요 없다.
  const weekAgo = clickDateKey(new Date(now.getTime() - 6 * 86_400_000));

  const daily = await queryAll<{ date: string; count: number; botCount: number }>(
    `SELECT date, SUM(count) AS count, SUM(botCount) AS botCount FROM OutboundClick
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
    botWeek: daily
      .filter((d) => d.date >= weekAgo)
      .reduce((sum, d) => sum + (d.botCount ?? 0), 0),
  };
}

/**
 * 날짜별 클릭 수 — **릴리스 전후 비교용**.
 *
 * ⚠ `loadClickStats`는 최근 7일만 돌려준다. 전후 14일씩을 보려면 더 긴 창이 필요해서
 *    따로 둔다. 판정은 `lib/release-effect.ts`가 하고 여기는 값만 준다.
 */
export async function loadClickDaily(limit = 60): Promise<{ date: string; count: number }[]> {
  return queryAll<{ date: string; count: number }>(
    `SELECT date, SUM(count) AS count FROM OutboundClick
      GROUP BY date ORDER BY date DESC LIMIT ?`,
    [limit],
  );
}
