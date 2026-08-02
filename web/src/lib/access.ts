/**
 * 라우트 접근 정책 — 순수 함수.
 *
 * 미들웨어(Edge)와 서버 컴포넌트 양쪽에서 같은 규칙을 쓰기 위해
 * Prisma·Auth.js에 의존하지 않는 순수 로직으로 분리한다. 규칙이 바뀌면
 * `access.test.ts`가 먼저 깨지도록 하는 것이 목적이다.
 */

export type Role = "ADMIN" | "USER";

/** 관리자 전용 영역 */
export const ADMIN_PREFIX = "/admin";

/** 로그인만 하면 되는 영역 (개인 포트폴리오 — 화면은 Phase 8에서 추가) */
export const MEMBER_PREFIXES = ["/me"] as const;

/** 미들웨어 matcher와 반드시 같은 범위를 가리켜야 한다. */
export const PROTECTED_MATCHER = ["/admin/:path*", "/me/:path*"] as const;

export type AccessDecision =
  /** 통과 */
  | { kind: "allow" }
  /** 미인증 — 로그인 화면으로 보내고 끝나면 원래 위치로 되돌린다 */
  | { kind: "login"; to: string }
  /** 인증했지만 권한 부족 — 관리자 영역의 존재를 더 드러내지 않고 홈으로 보낸다 */
  | { kind: "forbidden"; to: string };

/** `/admin`, `/admin/posts`는 true. `/administrator`는 false. */
export function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** DB·토큰에서 온 값이 무엇이든 알려진 역할 두 개 중 하나로 좁힌다. */
export function normalizeRole(value: unknown): Role {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

/** 로그인 후 되돌아올 위치를 담은 로그인 경로 */
export function loginPath(target: string): string {
  return `/login?next=${encodeURIComponent(target)}`;
}

/**
 * 오픈 리다이렉트 방지: `next`는 같은 사이트의 절대경로만 허용한다.
 * `//evil.com`, `https://evil.com`, `/\evil.com` 은 전부 거부한다.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * @param pathname 요청 경로 (쿼리 제외)
 * @param role     세션의 역할. 비로그인은 null.
 * @param search   원래 쿼리스트링(`?a=1`). 로그인 후 복귀에 사용.
 */
export function decideAccess(
  pathname: string,
  role: Role | null,
  search = "",
): AccessDecision {
  const isAdminArea = isUnder(pathname, ADMIN_PREFIX);
  const isMemberArea = MEMBER_PREFIXES.some((p) => isUnder(pathname, p));

  if (!isAdminArea && !isMemberArea) return { kind: "allow" };

  if (role === null) return { kind: "login", to: loginPath(`${pathname}${search}`) };
  if (isAdminArea && role !== "ADMIN") return { kind: "forbidden", to: "/" };

  return { kind: "allow" };
}
