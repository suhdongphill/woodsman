/**
 * 시드(예시) 데이터가 운영에 남아 있는지 — DB를 읽어 순수 모듈에 넘긴다.
 *
 * ⚠ 판정은 `lib/seed-residue.ts`가 한다. 여기서는 읽기만 한다.
 * ⚠ 쿼리는 **5번**이고, 필요한 열만 읽는다. 진단 화면이 무료 등급의
 *    "호출당 50쿼리"를 먼저 잡아먹으면 안 된다.
 * ⚠ 실패해도 화면을 죽이지 않는다. 다만 **조용히 넘기지 않는다** —
 *    "남은 게 없다"와 "확인하지 못했다"가 같은 화면이 되면 안 된다(운영지침 §3).
 */
import { queryAll } from "@/lib/d1";
import {
  findSeedResidue,
  holdingsMissingNotice,
  type SeedResidue,
} from "@/lib/seed-residue";

export type SeedCheck = {
  items: SeedResidue[];
  /** 종목 0건인데 계좌 곡선만 공개 중일 때의 한 문장 */
  contradiction: string;
  /** ⚠ 조회 자체가 실패했으면 true — "깨끗하다"로 읽히면 안 된다 */
  failed: boolean;
};

export async function checkSeedResidue(): Promise<SeedCheck> {
  try {
    const [snapshots, journal, holdings, posts, comments] = await Promise.all([
      queryAll<{ date: string; principal: number; value: number; income: number }>(
        `SELECT substr(date, 1, 10) AS date, principal, value, income FROM AccountSnapshot`,
      ),
      queryAll<{ date: string; title: string }>(
        `SELECT substr(date, 1, 10) AS date, title FROM JournalEntry`,
      ),
      queryAll<{ name: string; ticker: string | null; targetWeight: number | null; published: number }>(
        `SELECT name, ticker, targetWeight, published FROM ModelHolding`,
      ),
      queryAll<{ slug: string; title: string }>(`SELECT slug, title FROM Post`),
      queryAll<{ authorName: string | null; body: string }>(
        `SELECT authorName, body FROM Comment`,
      ),
    ]);

    return {
      items: findSeedResidue({
        snapshots,
        journal,
        holdings: holdings.map((h) => ({
          name: h.name,
          ticker: h.ticker ?? undefined,
          targetWeight: h.targetWeight ?? undefined,
        })),
        posts,
        comments: comments.map((c) => ({ authorName: c.authorName ?? undefined, body: c.body })),
      }),
      contradiction: holdingsMissingNotice({
        publishedHoldings: holdings.filter((h) => h.published === 1).length,
        snapshots: snapshots.length,
      }),
      failed: false,
    };
  } catch (error) {
    console.error("[diagnostics] 시드 잔여 점검 실패", error);
    return { items: [], contradiction: "", failed: true };
  }
}
