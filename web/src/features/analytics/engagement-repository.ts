/**
 * 체류·읽힘 집계의 DB 접근.
 *
 * ⚠ `repository.ts`(조회수)와 **같은 개인정보 규칙**을 따른다 — (경로, 날짜, 집계)만.
 * ⚠ D1 한도를 의식하고 짰다(`docs/종목분석_보고서_설계서_v1.md` §7-2와 같은 근거):
 *    쿼리당 바인딩 100개 · Worker 호출당 쿼리 수 무료 50개. 그래서 기록은 **한 문장**이고,
 *    읽기는 표별로 하나씩 세 번만 돈다.
 */
import { getD1, queryAll } from "@/lib/d1";
import { viewDateKey } from "@/lib/analytics";
import {
  DWELL_BUCKETS_SEC,
  READ_MIN_SCROLL_PCT,
  READ_MIN_SEC,
  SCROLL_BUCKETS_PCT,
  dwellBucket,
  scrollBucket,
  type EngagementRow,
} from "@/lib/engagement";

const DWELL_COLUMNS = DWELL_BUCKETS_SEC.map((_, i) => `dwell${i}`);
const SCROLL_COLUMNS = SCROLL_BUCKETS_PCT.map((_, i) => `scroll${i}`);

/**
 * 체류 보고 1건을 기록한다.
 *
 * ⚠ **한 문장으로 끝낸다.** 버킷 열을 통째로 나열하는 대신 해당 칸만 +1 하고,
 *    UPSERT 충돌 시에도 같은 칸만 올린다. 열 이름은 코드가 만든 상수라 주입 위험이 없다
 *    (사용자 입력은 전부 `?` 바인딩으로 간다 — CLAUDE.md 4장).
 */
export async function recordEngagement(input: {
  path: string;
  date: string;
  dwellSec: number;
  scrollPct: number;
}): Promise<void> {
  const dwellCol = DWELL_COLUMNS[dwellBucket(input.dwellSec)];
  const scrollCol = SCROLL_COLUMNS[scrollBucket(input.scrollPct)];
  const isRead = input.dwellSec >= READ_MIN_SEC && input.scrollPct >= READ_MIN_SCROLL_PCT ? 1 : 0;

  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO PageEngagement (id, path, date, samples, ${dwellCol}, ${scrollCol}, reads, updatedAt)
         VALUES (?, ?, ?, 1, 1, 1, ?, ?)
       ON CONFLICT(path, date) DO UPDATE SET
         samples = samples + 1,
         ${dwellCol} = ${dwellCol} + 1,
         ${scrollCol} = ${scrollCol} + 1,
         reads = reads + ?,
         updatedAt = excluded.updatedAt`,
    )
    .bind(
      `${input.date}_${input.path}`,
      input.path,
      input.date,
      isRead,
      new Date().toISOString(),
      isRead,
    )
    .run();
}

/**
 * 아웃바운드 클릭의 **출처 화면**을 기록한다.
 * ⚠ 기존 `OutboundClick`(대상·날짜) 집계는 그대로 둔다 — 1순위 지표의 숫자가 바뀌면 안 된다.
 */
export async function recordOutboundSource(input: {
  path: string;
  target: string;
  date: string;
}): Promise<void> {
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO OutboundSource (id, path, target, date, count, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(path, target, date) DO UPDATE SET
         count = count + 1,
         updatedAt = excluded.updatedAt`,
    )
    .bind(
      `${input.date}_${input.target}_${input.path}`,
      input.path,
      input.target,
      input.date,
      new Date().toISOString(),
    )
    .run();
}

export type PathStatsRow = EngagementRow & { views: number; outboundClicks: number };

/**
 * 기간 내 경로별 집계를 한 벌로 읽는다.
 *
 * ⚠ 세 표를 **각각 집계한 뒤 코드에서 합친다.** JOIN으로 붙이면 한쪽에만 있는 경로가
 *    조용히 사라진다 — 조회는 있는데 체류 표본이 0인 화면이 정확히 우리가 찾는 화면이다.
 */
export async function loadPathStats(days = 30, now = new Date()): Promise<PathStatsRow[]> {
  const from = viewDateKey(new Date(now.getTime() - (days - 1) * 86_400_000));

  const dwellSum = DWELL_COLUMNS.map((c) => `SUM(${c}) AS ${c}`).join(", ");
  const scrollSum = SCROLL_COLUMNS.map((c) => `SUM(${c}) AS ${c}`).join(", ");

  const [views, engagement, outbound] = await Promise.all([
    queryAll<{ path: string; views: number }>(
      `SELECT path, SUM(count) AS views FROM PageView WHERE date >= ? GROUP BY path`,
      [from],
    ),
    queryAll<Record<string, number | string>>(
      `SELECT path, SUM(samples) AS samples, SUM(reads) AS reads, ${dwellSum}, ${scrollSum}
         FROM PageEngagement WHERE date >= ? GROUP BY path`,
      [from],
    ),
    queryAll<{ path: string; clicks: number }>(
      `SELECT path, SUM(count) AS clicks FROM OutboundSource WHERE date >= ? GROUP BY path`,
      [from],
    ),
  ]);

  const byPath = new Map<string, PathStatsRow>();
  const ensure = (path: string): PathStatsRow => {
    let found = byPath.get(path);
    if (!found) {
      found = {
        path,
        date: from,
        samples: 0,
        dwellBuckets: DWELL_COLUMNS.map(() => 0),
        scrollBuckets: SCROLL_COLUMNS.map(() => 0),
        reads: 0,
        views: 0,
        outboundClicks: 0,
      };
      byPath.set(path, found);
    }
    return found;
  };

  for (const v of views) ensure(v.path).views = Number(v.views) || 0;

  for (const e of engagement) {
    const target = ensure(String(e.path));
    target.samples = Number(e.samples) || 0;
    target.reads = Number(e.reads) || 0;
    target.dwellBuckets = DWELL_COLUMNS.map((c) => Number(e[c]) || 0);
    target.scrollBuckets = SCROLL_COLUMNS.map((c) => Number(e[c]) || 0);
  }

  for (const o of outbound) ensure(o.path).outboundClicks = Number(o.clicks) || 0;

  return [...byPath.values()];
}
