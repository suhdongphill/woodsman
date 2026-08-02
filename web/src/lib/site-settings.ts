/**
 * 사이트 설정 조회 (서버 전용).
 *
 * DB에 SiteConfig가 아직 없거나 조회에 실패해도 **닫힌 정책**으로 떨어진다.
 * 설정을 못 읽었다는 이유로 커뮤니티가 열려버리는 일은 없어야 한다.
 */
import { cache } from "react";
import { db } from "./db";
import { CLOSED_SITE_POLICY, resolveSitePolicy, type SitePolicy } from "./site-policy";

/** 한 요청 안에서는 한 번만 조회한다. */
export const getSitePolicy = cache(async (): Promise<SitePolicy> => {
  try {
    const config = await db.siteConfig.findUnique({
      where: { id: "singleton" },
      select: {
        signupEnabled: true,
        communityEnabled: true,
        commentsGloballyEnabled: true,
      },
    });
    return resolveSitePolicy(config);
  } catch {
    return CLOSED_SITE_POLICY;
  }
});
