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

/**
 * 허용된 아웃바운드 대상의 **기본값**(코드 상수).
 *
 * ⚠ 실제 목적지는 `/admin/settings`에서 바꾼다. 이 상수는 DB를 못 읽었을 때만 쓴다 —
 *   2026-08-07 점검 전까지는 저장한 주소가 무시되고 이 값으로만 나갔다.
 */
export const OUTBOUND_TARGETS = {
  /** 티스토리 대표 글 */
  tistory: TISTORY_FEATURED_URL,
  /** 티스토리 블로그 대문 */
  "tistory-home": TISTORY_BLOG_URL,
} as const;

export type OutboundDestinations = Record<keyof typeof OUTBOUND_TARGETS, string>;

/**
 * 설정값에서 목적지 표를 만든다.
 *
 * ⚠ 여기 들어오는 주소는 이미 `site-basics.sanitizeUrl`을 통과한 값이다.
 *   정화되지 않은 문자열을 넣으면 우리 도메인이 피싱 경유지가 된다 —
 *   목적지를 확장할 때 반드시 이 경로를 지킨다.
 */
export function outboundDestinations(basics: {
  tistoryFeaturedUrl: string;
  tistoryBlogUrl: string;
}): OutboundDestinations {
  return {
    tistory: basics.tistoryFeaturedUrl,
    "tistory-home": basics.tistoryBlogUrl,
  };
}

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
  /** 관리자가 저장한 목적지. 넘기지 않으면 코드 기본값을 쓴다. */
  destinations: OutboundDestinations = OUTBOUND_TARGETS,
  /**
   * 종목 보고서의 티스토리 원문. ⚠ 글(`post-`)과 **같은 규칙**이다 —
   * 목적지는 우리가 저장해 둔 값에서만 나오고, 요청이 준 URL을 따라가지 않는다.
   */
  findStockUrl?: (ticker: string) => string | null | undefined,
): string | null {
  if (isOutboundTarget(target)) return destinations[target];

  const postSlug = target.startsWith(POST_PREFIX) ? target.slice(POST_PREFIX.length) : null;
  if (postSlug && findTistoryUrl) return findTistoryUrl(postSlug) ?? null;

  const ticker = target.startsWith(STOCK_PREFIX) ? target.slice(STOCK_PREFIX.length) : null;
  if (ticker && findStockUrl) return findStockUrl(ticker) ?? null;

  return null;
}

const POST_PREFIX = "post-";

/** ⚠ 티커는 **문자열**이다. `005930`의 앞 0이 살아 있어야 한다. */
const STOCK_PREFIX = "stock-";

/** 화면에서 쓰는 경유 링크 */
export function outboundHref(target: OutboundTarget): string {
  return `/go/${target}`;
}

/** 티스토리 원문이 있는 글의 경유 링크 */
export function outboundPostHref(slug: string): string {
  return `/go/${POST_PREFIX}${slug}`;
}

/** 티스토리에 옮겨 실은 종목 보고서의 경유 링크 */
export function outboundStockHref(ticker: string): string {
  return `/go/${STOCK_PREFIX}${ticker}`;
}

/**
 * 글 하나를 다 읽은 자리에 **어떤 블로그 링크**를 붙일 것인가.
 *
 * ⚠ 2026-08-25 사고: 「직접 작성」으로 쓴 인사이트에 티스토리 원문 링크를 넣었는데,
 *   화면은 그 값을 **무시하고 대표 글(기본값)로 보냈다.** 관리자 화면은 링크를 받아 저장까지
 *   했는데 아무 데도 쓰이지 않았다 — 입력란이 하는 일이 없는 상태였다.
 *
 * 원인은 화면이 두 가지를 **한 조건으로 묶은 것**이다. 둘은 다른 질문이다.
 *
 * | 질문 | 답하는 값 | 쓰는 곳 |
 * |---|---|---|
 * | 이 글은 어디서 왔나 | `source` | 「티스토리」 뱃지, canonical(원문이 정본일 때) |
 * | 이 글에 이어지는 블로그 글이 있나 | `externalUrl` | **나가는 링크** |
 *
 * `source`가 `TISTORY`면 본문 위에 이미 원문 카드가 있으므로 아래에 또 붙이지 않는다.
 * 그 밖에는 **원문 링크가 있으면 그 글로**, 없으면 대표 글로 보낸다.
 *
 * ⚠ 목적지는 언제나 `/go/post-<slug>` 경유다. 주소를 직접 박으면 클릭이 안 세지고,
 *   1순위 목적(블로그 유입)의 성과 판단이 감(感)이 된다.
 */
export type PostBlogLink =
  /** 본문 위 원문 카드가 이미 링크를 줬다 — 중복해서 붙이지 않는다 */
  | { kind: "none" }
  /** 이 글에 딸린 블로그 원문으로 */
  | { kind: "post"; href: string }
  /** 딸린 글이 없다 — 블로그 대표 글로 */
  | { kind: "default"; href: string };

export function blogLinkForPost(post: {
  slug: string;
  source: string;
  externalUrl?: string | null;
}): PostBlogLink {
  if (post.source === "TISTORY" && post.externalUrl) return { kind: "none" };
  if (post.externalUrl) return { kind: "post", href: outboundPostHref(post.slug) };
  return { kind: "default", href: outboundHref("tistory") };
}

/** 집계 키 — 날짜(KST 기준 YYYY-MM-DD) */
export function clickDateKey(now: Date): string {
  // 한국 사용자 기준이라 KST로 하루를 자른다. UTC로 자르면 밤 9시 이후 클릭이 다음 날로 넘어간다.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
