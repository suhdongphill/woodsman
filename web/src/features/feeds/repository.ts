/**
 * RSS 피드의 DB 접근.
 *
 * ## 왜 지금 이것만 있나
 * 수집(가져오기)은 아직 없다(P5.5). 하지만 화면이 `lib/mock.ts`의 고정 배열을 읽는 동안
 * **등록된 피드가 2건 있는 것처럼 보였다** — 실제 D1에는 1건뿐이었다.
 * 목록만이라도 진짜를 보여주는 것이, 있지도 않은 것을 보여주는 것보다 낫다.
 *
 * ⚠ 수집을 붙일 때 `lastFetchedAt`을 반드시 갱신한다. 마지막 수집 시각이 없으면
 *   "한 번도 안 돌았다"와 "돌았는데 새 글이 없었다"를 구분할 수 없다.
 */
import { queryAll, toBool } from "@/lib/d1";

export type FeedRow = {
  id: string;
  name: string;
  url: string;
  active: boolean;
  lastFetchedAt?: string;
};

type Row = {
  id: string;
  name: string;
  url: string;
  active: number;
  lastFetchedAt: string | null;
};

export async function loadFeeds(): Promise<FeedRow[]> {
  const rows = await queryAll<Row>(
    `SELECT id, name, url, active, lastFetchedAt FROM Feed ORDER BY createdAt ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    active: toBool(r.active),
    lastFetchedAt: r.lastFetchedAt ?? undefined,
  }));
}
