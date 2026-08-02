/**
 * 사이트 운영 모드 정책 — 순수 함수.
 *
 * ## 지금의 Woodsman
 * 관리자(운영자) 1인이 콘텐츠를 쓰고, 방문자는 **읽기만** 하는 블로그입니다.
 * 공개 회원가입을 받지 않고, 댓글·게시판도 닫혀 있습니다.
 *
 * ## 커뮤니티 코드를 지운 게 아니라 잠가 둔 이유
 * 회원가입·게시판·댓글 기능은 **사이트가 활성화된 뒤에 열기 위한 준비물**로 그대로
 * 남겨 뒀습니다(`src/features/auth`, `src/features/comments`, `/board`).
 * 코드를 지웠다가 나중에 다시 만들면 그때의 스키마·정책과 어긋나기 때문에,
 * 동작만 이 파일의 스위치로 막습니다.
 *
 * 열 때는 `SiteConfig`의 `signupEnabled` / `communityEnabled`를 관리자 화면
 * (`/admin/comments`)에서 켜면 됩니다. 코드 수정은 필요 없습니다.
 */

/** 운영에 영향을 주는 사이트 설정 조각 (SiteConfig의 부분집합) */
export type SitePolicyInput = {
  /** 공개 회원가입 허용 여부 */
  signupEnabled?: boolean | null;
  /** 게시판·커뮤니티 노출 여부 */
  communityEnabled?: boolean | null;
  /** 댓글 전역 스위치 */
  commentsGloballyEnabled?: boolean | null;
};

/**
 * 아무 설정도 없을 때의 기본값 — **전부 닫힘**.
 * 설정 조회에 실패했을 때 커뮤니티가 열려버리는 일이 없도록 닫는 쪽으로 기울인다.
 */
export const CLOSED_SITE_POLICY: SitePolicy = {
  signupEnabled: false,
  communityEnabled: false,
  commentsEnabled: false,
};

export type SitePolicy = {
  signupEnabled: boolean;
  communityEnabled: boolean;
  commentsEnabled: boolean;
};

/**
 * 댓글은 커뮤니티가 열려 있을 때만 의미가 있다.
 * 커뮤니티가 닫혀 있는데 댓글만 켜지는 조합을 막아, 관리자가 스위치 하나를
 * 잊어서 글쓰기 창구가 열리는 사고를 예방한다.
 */
export function resolveSitePolicy(config: SitePolicyInput | null | undefined): SitePolicy {
  if (!config) return CLOSED_SITE_POLICY;

  const communityEnabled = config.communityEnabled === true;
  return {
    signupEnabled: config.signupEnabled === true,
    communityEnabled,
    commentsEnabled: communityEnabled && config.commentsGloballyEnabled === true,
  };
}

/** 상단·하단 내비게이션에 커뮤니티(게시판)를 넣을지 */
export function showCommunityNav(policy: SitePolicy): boolean {
  return policy.communityEnabled;
}

/** 방문자에게 로그인·회원가입 링크를 보여줄지 (가입을 받을 때만 노출) */
export function showAuthEntry(policy: SitePolicy): boolean {
  return policy.signupEnabled;
}
