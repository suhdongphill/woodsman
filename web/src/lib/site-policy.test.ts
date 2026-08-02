/**
 * 사이트 개방 정책 회귀 테스트.
 * 여기가 깨지면 "받지 않기로 한 가입 창구가 열렸다"는 뜻이다.
 */
import { describe, expect, it } from "vitest";
import { siteConfig } from "./mock";
import { seedSiteConfig } from "./seed-data";
import {
  CLOSED_SITE_POLICY,
  resolveSitePolicy,
  showAuthEntry,
  showCommunityNav,
} from "./site-policy";

describe("resolveSitePolicy", () => {
  it("설정이 없으면 전부 닫는다", () => {
    expect(resolveSitePolicy(null)).toEqual(CLOSED_SITE_POLICY);
    expect(resolveSitePolicy(undefined)).toEqual(CLOSED_SITE_POLICY);
    expect(resolveSitePolicy({})).toEqual(CLOSED_SITE_POLICY);
  });

  it("true가 아닌 값은 전부 닫힘으로 본다", () => {
    const p = resolveSitePolicy({
      signupEnabled: null,
      communityEnabled: null,
      commentsGloballyEnabled: null,
    });
    expect(p).toEqual(CLOSED_SITE_POLICY);
  });

  it("커뮤니티가 닫혀 있으면 댓글도 열리지 않는다", () => {
    const p = resolveSitePolicy({ communityEnabled: false, commentsGloballyEnabled: true });
    expect(p.commentsEnabled).toBe(false);
  });

  it("커뮤니티와 댓글이 모두 켜져야 댓글이 열린다", () => {
    expect(
      resolveSitePolicy({ communityEnabled: true, commentsGloballyEnabled: true }).commentsEnabled,
    ).toBe(true);
    expect(
      resolveSitePolicy({ communityEnabled: true, commentsGloballyEnabled: false }).commentsEnabled,
    ).toBe(false);
  });

  it("가입 스위치는 커뮤니티와 독립이다", () => {
    const p = resolveSitePolicy({ signupEnabled: true, communityEnabled: false });
    expect(p.signupEnabled).toBe(true);
    expect(p.communityEnabled).toBe(false);
  });
});

describe("내비게이션 노출", () => {
  it("닫힌 정책에서는 커뮤니티도 인증 링크도 보이지 않는다", () => {
    expect(showCommunityNav(CLOSED_SITE_POLICY)).toBe(false);
    expect(showAuthEntry(CLOSED_SITE_POLICY)).toBe(false);
  });

  it("각 스위치가 자기 메뉴만 켠다", () => {
    const community = resolveSitePolicy({ communityEnabled: true });
    expect(showCommunityNav(community)).toBe(true);
    expect(showAuthEntry(community)).toBe(false);

    const signup = resolveSitePolicy({ signupEnabled: true });
    expect(showAuthEntry(signup)).toBe(true);
    expect(showCommunityNav(signup)).toBe(false);
  });
});

describe("기본 배포 상태", () => {
  it("시드는 가입·커뮤니티를 닫은 채로 시작한다", () => {
    expect(seedSiteConfig.signupEnabled).toBe(false);
    expect(seedSiteConfig.communityEnabled).toBe(false);
  });

  it("목업 설정도 같은 상태를 반영한다", () => {
    expect(siteConfig.signupEnabled).toBe(false);
    expect(siteConfig.communityEnabled).toBe(false);
    expect(resolveSitePolicy(siteConfig)).toEqual(CLOSED_SITE_POLICY);
  });
});
