/**
 * 응답 보안 헤더 — 순수 함수.
 *
 * ## 왜 지금
 * 2026-08-17 점검이 "응답 보안 헤더 전무"를 중간 심각도로 잡았다. 관리자가 쓴 글이
 * `dangerouslySetInnerHTML`로 렌더되는데(정화는 `sanitize-html.ts`가 한다) **2차 방어선이
 * 하나도 없었다.** 정화가 한 번 뚫리면 그대로 실행된다.
 *
 * ## ⚠ 왜 CSP를 한 벌로 못 쓰나 — 광고 때문이다
 * 공개 화면에는 AdSense(`pagead2.googlesyndication.com`)가 붙어 있고, 광고는 스크립트·
 * 프레임·이미지·XHR을 **미리 알 수 없는 수십 개 도메인**에서 끌어온다. 여기에
 * `default-src 'self'`를 씌우면 광고가 통째로 죽는다. 그래서 두 벌로 나눈다.
 *
 * | 범위 | 무엇을 거나 | 왜 |
 * |---|---|---|
 * | 전역 | **되돌림(fallback)이 없는 지시자만** | 지금 동작을 하나도 바꾸지 않으면서 실제로 막는다 |
 * | `/admin/*` | `default-src 'self'`까지 포함한 엄격판 | 관리자 화면에는 광고가 없다. 세션 값어치는 여기가 가장 크다 |
 *
 * ⚠ **전역 CSP에 `default-src`를 넣지 않는다.** `script-src`·`img-src`·`connect-src`가
 *    없으면 `default-src`로 되돌아가 광고 요청이 전부 막힌다. 아래 넷은 되돌림이 없어
 *    단독으로 걸어도 다른 요청에 영향이 없다.
 *
 * ## ⚠ 남은 구멍 — 인라인 스크립트는 아직 못 막는다
 * XSS의 실제 통로는 `<img onerror=...>` 같은 **인라인 핸들러**인데, 이걸 막으려면
 * `script-src`에 nonce가 필요하고, Next.js에서 nonce를 쓰면 **모든 페이지가 동적 렌더로
 * 바뀐다**(요청 헤더를 읽어야 하므로). 공개 화면 전체의 정적 최적화를 포기하는 값이라
 * 지금은 걸지 않았다. 그 대신 정화기 쪽을 조인다(`sanitize-html.ts`의 `looksDangerous` 호출).
 */

export type HeaderRule = {
  source: string;
  headers: { key: string; value: string }[];
};

/**
 * 되돌림이 없는 CSP 지시자만 모은 것. 어떤 화면에 걸어도 기존 요청을 막지 않는다.
 *
 * - `base-uri` — `<base href="//evil">` 주입으로 모든 상대 경로를 가로채는 수법을 막는다
 * - `object-src` — 플러그인 통로를 닫는다(쓰는 곳이 없다)
 * - `form-action` — 주입된 `<form>`이 값을 밖으로 실어 나르는 것을 막는다
 * - `frame-ancestors` — 클릭재킹. `X-Frame-Options`의 현대판이다
 */
const NO_FALLBACK_CSP = [
  "base-uri 'self'",
  "object-src 'none'",
  /**
   * ⚠ 소셜 로그인은 우리 쪽 `/api/auth/signin/*`으로 POST한 뒤 제공자로 **리다이렉트**된다.
   *    브라우저에 따라 `form-action`이 리다이렉트 목적지까지 본다. `'self'`만 두면
   *    구글·카카오 로그인이 조용히 죽는다(지금은 꺼져 있지만 켤 때 원인을 못 찾게 된다).
   */
  "form-action 'self' https://accounts.google.com https://kauth.kakao.com",
  "frame-ancestors 'none'",
].join("; ");

/**
 * 관리자 화면 전용 엄격판. 광고가 없으므로 `default-src`를 걸 수 있다.
 *
 * ⚠ `'unsafe-inline'`은 뺄 수 없다 — Next.js가 하이드레이션 데이터를 인라인 스크립트·
 *    스타일로 심는다. nonce 없이 이걸 빼면 관리자 화면이 통째로 죽는다.
 * ⚠ `img-src`에 `https:`를 허용한다 — 소셜 로그인 프로필 사진과 관리자가 붙여넣은
 *    외부 이미지가 여기로 들어온다. `data:`는 붙여넣기 스크린샷 때문이다.
 */
/**
 * ⚠ **개발 서버에서만** `unsafe-eval`을 연다.
 *
 * Next의 개발 모드 리프레시 런타임(`@next/react-refresh-utils`)이 eval을 쓴다. 막으면
 * `main-app.js` 초기화 도중 EvalError가 터지고 **관리자 화면의 클라이언트 JS가 통째로
 * 안 살아난다** — 화면은 그려지는데 입력·클릭이 아무것도 안 먹는다(2026-08-30에 반나절 헤맸다).
 * 공개 화면은 전역 CSP에 `script-src`가 없어 이 문제가 없었고, 그래서 더 늦게 찾았다.
 *
 * ⚠ 배포본에는 리프레시 런타임 자체가 없다. **운영 CSP는 그대로 조여 둔다.**
 */
function adminScriptSrc(isDev: boolean): string {
  return isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
}

const adminCsp = (isDev: boolean) => [
  "default-src 'self'",
  adminScriptSrc(isDev),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  NO_FALLBACK_CSP,
].join("; ");

/**
 * 전역 헤더.
 *
 * ⚠ HSTS는 **되돌리기가 가장 어려운 결정**이다. 브라우저가 max-age 동안 이 도메인을
 *    https로만 연결하도록 기억한다. 이미 Cloudflare 뒤에서 https 전용으로 도는 사이트라
 *    안전하지만, `preload`는 넣지 않았다 — 목록에서 빼는 데 몇 달이 걸린다.
 */
export function globalSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: NO_FALLBACK_CSP },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    /**
     * 외부로 나갈 때는 출처(origin)만 보낸다. 경로에 티커·글 주소가 들어가는데,
     * 그게 광고·외부 링크의 Referer로 새 나갈 이유가 없다.
     */
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    /** 쓰지 않는 장치 권한은 처음부터 닫는다. */
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  ];
}

/**
 * 관리자 화면에서 전역판의 CSP를 엄격판으로 덮는다.
 *
 * ⚠ `isDev`를 **인자로 받는다.** 안에서 `process.env`를 읽으면 테스트가 두 갈래를 못 본다.
 */
export function adminSecurityHeaders(
  isDev: boolean = process.env.NODE_ENV !== "production",
): { key: string; value: string }[] {
  const csp = adminCsp(isDev);
  return globalSecurityHeaders().map((h) =>
    h.key === "Content-Security-Policy" ? { key: h.key, value: csp } : h,
  );
}

/**
 * `next.config.ts`의 `headers()`가 그대로 돌려주는 모양.
 *
 * ⚠ **순서가 의미를 갖는다.** 뒤에 오는 규칙이 같은 이름의 헤더를 덮으므로
 *    `/admin/*`이 전역 뒤에 와야 엄격판이 이긴다.
 */
export function securityHeaderRules(): HeaderRule[] {
  return [
    { source: "/:path*", headers: globalSecurityHeaders() },
    { source: "/admin/:path*", headers: adminSecurityHeaders() },
  ];
}
