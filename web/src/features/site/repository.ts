/**
 * 사이트 기본값의 DB 접근.
 *
 * ⚠ 여기서 저장하는 값 중 티스토리 주소는 `/go/*` 리다이렉트의 목적지가 된다.
 * 반드시 `site-basics.ts`의 `sanitizeUrl`을 거친 값만 넘긴다 — 안 그러면 오픈 리다이렉트다.
 */
import { execute } from "@/lib/d1";
import type { SiteBasics } from "@/lib/site-basics";

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
 */
export async function saveSiteBasics(patch: SiteBasicsPatch): Promise<void> {
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
