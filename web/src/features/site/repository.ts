/**
 * 사이트 기본값의 DB 접근.
 *
 * ⚠ 여기서 저장하는 값 중 티스토리 주소는 `/go/*` 리다이렉트의 목적지가 된다.
 * 반드시 `site-basics.ts`의 `sanitizeUrl`을 거친 값만 넘긴다 — 안 그러면 오픈 리다이렉트다.
 */
import { execute } from "@/lib/d1";
import type { SiteBasics } from "@/lib/site-basics";
import type { SiteFlags } from "@/lib/site-policy";

export type SiteBasicsPatch = Partial<
  Pick<
    SiteBasics,
    | "dataMode"
    | "usdKrwRate"
    | "contactEmail"
    | "tistoryBlogUrl"
    | "tistoryFeaturedUrl"
    | "tistoryRssUrl"
    | "featuredTitle"
    | "featuredExcerpt"
    | "heroTitle"
    | "heroSubtitle"
  >
>;

/**
 * SiteConfig는 singleton 한 행이다. 행이 없으면 만든다 —
 * 시드를 돌리지 않은 환경에서 저장이 조용히 아무 일도 안 하는 걸 막는다.
 *
 * ⚠ 컬럼명은 **호출부가 정한 키**로만 만들어진다. 사용자 입력을 키로 넘기지 않는다
 *   (값은 전부 `?` 바인딩이지만 컬럼명은 바인딩할 수 없다).
 */
async function patchSiteConfig(patch: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO SiteConfig (id, updatedAt) VALUES ('singleton', ?)
     ON CONFLICT(id) DO NOTHING`,
    [now],
  );

  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const setSql = entries.map(([k]) => `${k} = ?`).join(", ");
  await execute(
    `UPDATE SiteConfig SET ${setSql}, updatedAt = ? WHERE id = 'singleton'`,
    [...entries.map(([, v]) => v ?? null), now],
  );
}

export async function saveSiteBasics(patch: SiteBasicsPatch): Promise<void> {
  await patchSiteConfig(patch);
}

/**
 * 사이트 개방·댓글 정책 스위치.
 *
 * ⚠ boolean을 그대로 넘기지 않는다. SQLite에는 boolean이 없어 0/1로 저장해야 하고,
 *   `true`를 그냥 바인딩하면 드라이버에 따라 조용히 다른 값이 들어간다.
 */
export async function saveSiteFlags(patch: Partial<SiteFlags>): Promise<void> {
  const { bannedWords, ...booleans } = patch;

  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(booleans)) {
    if (value !== undefined) row[key] = value ? 1 : 0;
  }
  if (bannedWords !== undefined) row.bannedWords = bannedWords;

  await patchSiteConfig(row);
}
