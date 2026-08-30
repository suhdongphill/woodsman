/**
 * 조회 집계의 DB 접근.
 *
 * ⚠ (경로, 날짜, 합계)만 쌓는다. 개인을 구분하는 값은 어디에도 저장하지 않는다
 *    (`lib/outbound-repo.ts`와 같은 규칙).
 */
import { getD1, queryAll } from "@/lib/d1";
import { summarizeViews, viewDateKey, type DailyCount, type ViewSummary } from "@/lib/analytics";
import { incrementPostViewCount } from "@/features/posts/repository";

/**
 * 조회 1건을 기록한다. 글이면 `Post.viewCount`도 같이 올린다.
 *
 * ⚠ **"글 조회는 글 카운터도 올린다"는 규칙을 여기 한 곳에** 둔다. 호출부(비콘 라우트)가
 *    그 규칙을 알면, 나중에 다른 곳에서 조회를 기록할 때 한쪽만 빠진다.
 * ⚠ 두 write를 **한 batch**로 보낸다 — 가장 자주 불리는 경로라 왕복 두 번은 그대로 지연이 된다.
 */
export async function recordPageView(
  path: string,
  date: string,
  postSlug?: string | null,
): Promise<void> {
  const db = await getD1();
  const now = new Date().toISOString();

  const statements = [
    db
      .prepare(
        `INSERT INTO PageView (id, path, date, count, updatedAt)
           VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(path, date) DO UPDATE SET
           count = count + 1,
           updatedAt = excluded.updatedAt`,
      )
      .bind(`${date}_${path}`, path, date, now),
  ];

  if (postSlug) statements.push(incrementPostViewCount(db, postSlug));

  await db.batch(statements);
}

/** 많이 본 경로를 몇 개까지 보여줄지 — ⚠ 화면에서 다시 자르지 않는다(두 곳이 어긋난다). */
const TOP_LIMIT = 5;

export type ViewStats = ViewSummary & {
  /** 많이 본 경로 */
  top: { path: string; count: number }[];
};

export async function loadViewStats(now = new Date()): Promise<ViewStats> {
  const weekAgo = viewDateKey(new Date(now.getTime() - 6 * 86_400_000));
  const twoWeeksAgo = viewDateKey(new Date(now.getTime() - 13 * 86_400_000));

  // 날짜 문자열(YYYY-MM-DD)은 사전순 비교가 곧 시간순 비교다.
  // ⚠ 전체 기간 합계는 내지 않는다 — PageView는 계속 늘어나는 표라 매번 전 구간을 훑게 된다.
  const [daily, top] = await Promise.all([
    queryAll<DailyCount>(
      `SELECT date, SUM(count) AS count FROM PageView
        WHERE date >= ? GROUP BY date ORDER BY date ASC`,
      [twoWeeksAgo],
    ),
    queryAll<{ path: string; count: number }>(
      `SELECT path, SUM(count) AS count FROM PageView
        WHERE date >= ? GROUP BY path ORDER BY count DESC LIMIT ?`,
      [weekAgo, TOP_LIMIT],
    ),
  ]);

  return { ...summarizeViews(daily, now), top };
}

/**
 * 날짜별 조회수 — **릴리스 전후 비교용**(경로를 합친다).
 * ⚠ 판정은 하지 않는다. `lib/release-effect.ts`가 한다.
 */
export async function loadViewDaily(limit = 60): Promise<{ date: string; count: number }[]> {
  return queryAll<{ date: string; count: number }>(
    `SELECT date, SUM(count) AS count FROM PageView
      GROUP BY date ORDER BY date DESC LIMIT ?`,
    [limit],
  );
}
