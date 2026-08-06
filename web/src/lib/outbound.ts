/**
 * 아웃바운드 링크 — 나가는 클릭을 세기 위한 경유 경로.
 *
 * ## 왜 세는가
 * 이 사이트의 1순위 목적은 **티스토리 블로그로 트래픽을 보내는 것**이다.
 * 그러면 성과 지표는 페이지뷰나 체류시간이 아니라 **"몇 명이 넘어갔나"**여야 한다.
 * 그 숫자가 없으면 개선이 감(感)이 된다.
 *
 * ## 왜 직접 링크가 아니라 경유인가
 * 외부 사이트로 나가는 클릭은 우리 서버에 아무 흔적을 남기지 않는다.
 * `/go/tistory` 를 거치게 하면 302로 넘기면서 카운트만 남길 수 있다.
 *
 * ## 오픈 리다이렉트 방지
 * ⚠ 목적지를 쿼리스트링으로 받지 않는다. **여기 등록된 대상만** 허용한다.
 * `?to=` 방식이면 공격자가 우리 도메인을 피싱 사이트 경유지로 쓸 수 있다.
 *
 * ## 개인정보
 * 쿠키를 심지 않고, IP·UA를 저장하지 않는다. 날짜별 합계만 센다.
 * 개인정보 처리방침의 "회원정보를 수집하지 않는다"와 어긋나지 않게 유지한다.
 */
import { TISTORY_BLOG_URL, TISTORY_FEATURED_URL } from "./site-links";

/** 허용된 아웃바운드 대상 */
export const OUTBOUND_TARGETS = {
  /** 티스토리 대표 글 */
  tistory: TISTORY_FEATURED_URL,
  /** 티스토리 블로그 대문 */
  "tistory-home": TISTORY_BLOG_URL,
} as const;

export type OutboundTarget = keyof typeof OUTBOUND_TARGETS;

export function isOutboundTarget(value: string): value is OutboundTarget {
  return Object.prototype.hasOwnProperty.call(OUTBOUND_TARGETS, value);
}

/**
 * 등록되지 않은 대상이면 null — 호출부에서 404로 처리한다.
 *
 * `post-<slug>` 형태도 허용한다. 다만 목적지는 **우리가 저장해 둔 글의 원문 URL**에서만
 * 나온다. 요청이 준 URL을 그대로 따라가는 경로는 어디에도 없다.
 *
 * ⚠ 글은 DB에 있으므로 조회 함수를 **주입받는다.** 이 모듈이 DB를 알면 순수 함수가 아니게 되고
 *    테스트에서 리다이렉트 규칙을 검증할 수 없다(오픈 리다이렉트는 테스트로 지켜야 하는 규칙이다).
 */
export function resolveOutbound(
  target: string,
  findTistoryUrl?: (slug: string) => string | null | undefined,
): string | null {
  if (isOutboundTarget(target)) return OUTBOUND_TARGETS[target];

  const postSlug = target.startsWith(POST_PREFIX) ? target.slice(POST_PREFIX.length) : null;
  if (postSlug && findTistoryUrl) return findTistoryUrl(postSlug) ?? null;

  return null;
}

const POST_PREFIX = "post-";

/** 화면에서 쓰는 경유 링크 */
export function outboundHref(target: OutboundTarget): string {
  return `/go/${target}`;
}

/** 티스토리 원문이 있는 글의 경유 링크 */
export function outboundPostHref(slug: string): string {
  return `/go/${POST_PREFIX}${slug}`;
}

/** 집계 키 — 날짜(KST 기준 YYYY-MM-DD) */
export function clickDateKey(now: Date): string {
  // 한국 사용자 기준이라 KST로 하루를 자른다. UTC로 자르면 밤 9시 이후 클릭이 다음 날로 넘어간다.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
