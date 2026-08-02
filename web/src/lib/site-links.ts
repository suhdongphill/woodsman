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

export const CONTACT_EMAIL = "suhdp71@gmail.com";
