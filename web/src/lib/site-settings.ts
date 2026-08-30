/**
 * 사이트 설정 조회 (서버 전용).
 *
 * 조회에 실패해도 **닫힌 정책**으로 떨어진다 — 설정을 못 읽었다는 이유로
 * 커뮤니티가 열려버리는 일은 없어야 한다.
 *
 * ⚠ 다만 조용히 넘어가지 않는다. 2026-08-02에 D1 접근이 실패하는데 결과가
 *    "커뮤니티 닫힘"과 똑같아서 배포가 멀쩡해 보였다. 실패는 로그로 남아야 구분된다.
 */
import { cache } from "react";
import { execute, queryOne } from "./d1";
import { EMPTY_ADS_SETTINGS, type AdsSettings } from "./ads";
import {
  CLOSED_SITE_FLAGS,
  resolveSiteFlags,
  resolveSitePolicy,
  type SiteFlags,
  type SitePolicy,
} from "./site-policy";
import {
  DEFAULT_SITE_BASICS,
  resolveSiteBasics,
  type SiteBasics,
  type SiteBasicsRow,
} from "./site-basics";

/**
 * 스위치의 **원래 값**. 관리자 화면의 토글은 이걸 그려야 한다.
 * 한 요청 안에서는 한 번만 조회한다.
 */
export const getSiteFlags = cache(async (): Promise<SiteFlags> => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT signupEnabled, communityEnabled, commentsGloballyEnabled,
              requireLoginToComment, moderationOn, bannedWords
         FROM SiteConfig WHERE id = ?`,
      ["singleton"],
    );
    return resolveSiteFlags(row);
  } catch (error) {
    console.error("[site-settings] SiteConfig 조회 실패 — 닫힌 정책으로 동작합니다.", error);
    return CLOSED_SITE_FLAGS;
  }
});

/**
 * 스위치를 조합한 **결론**(무엇을 열어 줄지). 공개 화면은 이걸 본다.
 * 원래 값 조회를 재사용하므로 한 요청에서 SiteConfig를 두 번 읽지 않는다.
 */
export const getSitePolicy = cache(async (): Promise<SitePolicy> => {
  return resolveSitePolicy(await getSiteFlags());
});

/**
 * 사이트 기본값(문의 메일·티스토리·홈 문구·모의/실계좌).
 *
 * ⚠ 실패해도 **모의 투자(PAPER)** 기본값으로 떨어진다. 설정을 못 읽었다는 이유로
 * 화면이 실계좌처럼 보이면 안 된다.
 */
export const getSiteBasics = cache(async (): Promise<SiteBasics> => {
  try {
    const row = await queryOne<SiteBasicsRow>(
      `SELECT dataMode, usdKrwRate, contactEmail, tistoryBlogUrl, tistoryFeaturedUrl, tistoryRssUrl,
              featuredTitle, featuredExcerpt, heroTitle, heroSubtitle
         FROM SiteConfig WHERE id = ?`,
      ["singleton"],
    );
    return resolveSiteBasics(row);
  } catch (error) {
    console.error("[site-settings] 사이트 기본값 조회 실패 — 코드 기본값으로 동작합니다.", error);
    return DEFAULT_SITE_BASICS;
  }
});

/**
 * 광고(AdSense) 설정.
 *
 * ⚠ **읽지 못하면 광고를 끈다.** 설정을 못 읽었다는 이유로 광고가 나가면,
 *    내리고 싶을 때 못 내리는 상태가 된다 — 안전한 쪽은 "안 나가는 쪽"이다.
 * ⚠ 값은 공개값이라 DB에 둔다. AI 키와 혼동하지 말 것(그쪽은 절대 DB에 넣지 않는다).
 */
export const getAdsSettings = cache(async (): Promise<AdsSettings> => {
  try {
    const row = await queryOne<{
      adsEnabled: number | null;
      adsenseClientId: string | null;
      adsenseSlotArticleEnd: string | null;
      adsenseSlotFeedEnd: string | null;
      adsenseSlotContentBottom: string | null;
    }>(
      `SELECT adsEnabled, adsenseClientId, adsenseSlotArticleEnd, adsenseSlotFeedEnd,
              adsenseSlotContentBottom
         FROM SiteConfig WHERE id = ?`,
      ["singleton"],
    );
    if (!row) return EMPTY_ADS_SETTINGS;
    return {
      enabled: row.adsEnabled === 1,
      clientId: row.adsenseClientId,
      slots: {
        "article-end": row.adsenseSlotArticleEnd,
        "feed-end": row.adsenseSlotFeedEnd,
        "content-bottom": row.adsenseSlotContentBottom,
      },
    };
  } catch (error) {
    console.error("[site-settings] 광고 설정 조회 실패 — 광고를 끕니다.", error);
    return EMPTY_ADS_SETTINGS;
  }
});

/** 관리자 화면 저장용. ⚠ 형식 검증은 액션이 하고, 여기서는 쓰기만 한다. */
export async function saveAdsSettings(input: {
  enabled: boolean;
  clientId: string | null;
  articleEnd: string | null;
  feedEnd: string | null;
  contentBottom: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO SiteConfig (id, adsEnabled, adsenseClientId, adsenseSlotArticleEnd,
                             adsenseSlotFeedEnd, adsenseSlotContentBottom, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       adsEnabled = excluded.adsEnabled,
       adsenseClientId = excluded.adsenseClientId,
       adsenseSlotArticleEnd = excluded.adsenseSlotArticleEnd,
       adsenseSlotFeedEnd = excluded.adsenseSlotFeedEnd,
       adsenseSlotContentBottom = excluded.adsenseSlotContentBottom,
       updatedAt = excluded.updatedAt`,
    [
      "singleton",
      input.enabled ? 1 : 0,
      input.clientId,
      input.articleEnd,
      input.feedEnd,
      input.contentBottom,
      new Date().toISOString(),
    ],
  );
}
