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
import { queryOne, toBool } from "./d1";
import { CLOSED_SITE_POLICY, resolveSitePolicy, type SitePolicy } from "./site-policy";
import {
  DEFAULT_SITE_BASICS,
  resolveSiteBasics,
  type SiteBasics,
  type SiteBasicsRow,
} from "./site-basics";

type SiteConfigRow = {
  signupEnabled: number;
  communityEnabled: number;
  commentsGloballyEnabled: number;
};

/** 한 요청 안에서는 한 번만 조회한다. */
export const getSitePolicy = cache(async (): Promise<SitePolicy> => {
  try {
    const row = await queryOne<SiteConfigRow>(
      `SELECT signupEnabled, communityEnabled, commentsGloballyEnabled
         FROM SiteConfig WHERE id = ?`,
      ["singleton"],
    );
    if (!row) return CLOSED_SITE_POLICY;

    return resolveSitePolicy({
      signupEnabled: toBool(row.signupEnabled),
      communityEnabled: toBool(row.communityEnabled),
      commentsGloballyEnabled: toBool(row.commentsGloballyEnabled),
    });
  } catch (error) {
    console.error("[site-settings] SiteConfig 조회 실패 — 닫힌 정책으로 동작합니다.", error);
    return CLOSED_SITE_POLICY;
  }
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
