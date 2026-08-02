/**
 * 외부 채널 링크 — 한 곳에서만 관리한다.
 * 블로그 주소가 바뀌면 여기만 고치면 홈·푸터·RSS 안내가 함께 따라간다.
 */

/** 티스토리 블로그 대문 */
export const TISTORY_BLOG_URL = "https://suhdp.tistory.com";

/** 홈에 직접 노출하는 대표 글 */
export const TISTORY_FEATURED_URL = "https://suhdp.tistory.com/2";

/** RSS 가져오기 대상 */
export const TISTORY_RSS_URL = "https://suhdp.tistory.com/rss";

/** 화면에 그대로 보여줄 표시용 문자열 (프로토콜 제거) */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * 문의 메일. ⚠ 화면 어디에도 이 주소를 다시 적지 말고 이 상수를 쓴다.
 * 예전에 다섯 곳에 직접 적혀 있어서 주소를 바꿀 때 두 곳이 옛 주소로 남았다.
 * (`site-links.test.ts`가 하드코딩을 막는다.)
 */
export const CONTACT_EMAIL = "suhdp@naver.com";
