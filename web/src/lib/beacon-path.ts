/**
 * 집계 비콘이 **인정하는 경로**인가 — 순수 함수.
 *
 * ## 왜 필요한가
 * `lib/analytics.normalizePath()`는 "우리 사이트 안의 경로처럼 생겼나"까지만 본다.
 * 그래서 `/__probe`, `/aaa1`, `/aaa2` … 처럼 **존재하지 않는 경로를 보내면 그대로 집계에 쌓인다.**
 * 한 줄짜리 스크립트로 통계표에 수천 줄의 가짜 화면을 만들 수 있다는 뜻이다.
 *
 * 2026-08-11 밤 실측에서 Cloudflare Rate Limiting 바인딩이 **447건을 한 건도 막지 못했다**
 * (`docs/계획_2026-08-12.md` A3). 속도 제한 한 겹에 기대던 설계가 무너졌으므로,
 * **우리가 테스트로 검증할 수 있는 방어선**을 앞에 세운다. 이것이 그 1층이다.
 *
 * ## 무엇을 막고 무엇을 못 막나 (정직하게)
 * - 막는다 — **없는 경로를 만들어 내는 것**. 통계표가 낙서가 되는 경로를 닫는다.
 * - 못 막는다 — **실재하는 경로의 숫자를 부풀리는 것**. 그건 볼륨 상한(속도 제한)의 몫이고
 *   아직 열려 있다. 여기서 다 막았다고 적지 않는다.
 *
 * ## ⚠ 조용한 실패를 만들지 않는 방법
 * 화면을 새로 만들고 이 목록에 넣는 것을 잊으면, 그 화면의 집계가 **아무 소리 없이 0**이 된다.
 * 그래서 요청마다 로그를 남기는 대신(공격자가 로그를 흘려 넘치게 할 수 있다)
 * `beacon-path.test.ts`가 **`src/app/(public)` 디렉터리를 직접 걸어서** 목록과 대조한다.
 * 라우트를 추가하고 이 파일을 안 고치면 `npm run check`가 깨진다.
 */
import { findMacroGroup } from "./macro/registry";

/**
 * 공개 화면의 **정적 경로** 전부.
 * ⚠ 라우트를 추가하면 여기도 추가한다. 잊으면 테스트가 깨진다(그러라고 있는 테스트다).
 * `/login`·`/register`는 `normalizePath`가 이미 집계에서 뺀다 — 여기 넣지 않는다.
 */
export const PUBLIC_STATIC_PATHS = [
  "/",
  "/about",
  "/board",
  "/disclaimer",
  "/insights",
  "/journal",
  "/macro",
  "/macro/bubble",
  "/macro/compare",
  "/portfolio",
  "/privacy",
  "/stocks",
] as const;

/**
 * 동적 경로 규칙.
 *
 * `template`은 **App Router 디렉터리 이름 그대로**다 — 테스트가 이 문자열로
 * 실제 라우트와 짝을 맞춘다. 문자열을 고치면 테스트가 짝을 못 찾고 깨진다.
 *
 * ⚠ 세그먼트 모양을 **좁게** 잡는다. `[^/]+`로 열어 두면 아무 문자열이나 통과해
 * 이 파일을 만든 이유가 사라진다.
 */
export const DYNAMIC_PATH_RULES: { template: string; matches: (segment: string) => boolean }[] = [
  {
    // 글 slug — 소문자·숫자·하이픈. ⚠ 실재하는 글인지는 여기서 모른다(§아래 주석).
    template: "/insights/[slug]",
    matches: (s) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s),
  },
  {
    // 게시글 id — 숫자만.
    template: "/board/[id]",
    matches: (s) => /^[0-9]{1,12}$/.test(s),
  },
  {
    // 티커. ⚠ **문자열로만** 다룬다(`005930` → `5930`이 되면 국장 종목이 사라진다).
    template: "/stocks/[ticker]",
    matches: (s) => /^[A-Za-z0-9][A-Za-z0-9.-]{0,11}$/.test(s),
  },
  {
    // 거시 그룹 — ⚠ 정규식이 아니라 **실제 섹터 목록**과 대조한다.
    // 섹터가 늘거나 줄면 여기도 자동으로 따라간다(하드코딩하지 않는다).
    template: "/macro/[group]",
    matches: (s) => findMacroGroup(s) !== undefined,
  },
];

/**
 * 이 경로를 집계에 넣어도 되는가.
 *
 * ⚠ 입력은 **이미 `normalizePath()`를 통과한 값**이어야 한다(쿼리 제거·외부 경로 차단·
 * 운영 경로 제외가 거기서 끝난다). 여기서 그 일을 다시 하지 않는다 — 두 곳에서 판단하면
 * 언젠가 두 판단이 갈린다.
 *
 * `/insights/<slug>`가 **실재하는 글인지**는 판정하지 않는다. 그건 DB를 봐야 알고,
 * 비콘마다 조회를 한 번 더 하는 값을 지금은 하지 않는다. 대신 모양을 좁혀 두었고,
 * 관리자 화면은 조회수 0이 아닌 줄만 의미 있게 읽으면 된다.
 */
export function isRecordablePath(path: string): boolean {
  if ((PUBLIC_STATIC_PATHS as readonly string[]).includes(path)) return true;

  const cut = path.lastIndexOf("/");
  if (cut <= 0) return false;

  const parent = path.slice(0, cut);
  const segment = path.slice(cut + 1);
  if (!segment) return false;

  return DYNAMIC_PATH_RULES.some(
    (rule) => rule.template.slice(0, rule.template.lastIndexOf("/")) === parent && rule.matches(segment),
  );
}
