/**
 * 사이트 기본값 — "처음 개발할 때 코드에 박아 둔 값"을 화면에서 고칠 수 있게 한다.
 *
 * ## 왜
 * 문의 메일·티스토리 주소·홈 문구가 코드에 흩어져 있으면, 바꿀 때마다 개발자가 필요하고
 * 한두 군데는 옛 값으로 남는다(실제로 메일 주소가 다섯 곳에 박혀 있었다).
 *
 * ## 규칙
 * - 코드의 상수(`site-links.ts`)는 **기본값**이다. DB에 값이 있으면 그게 이긴다.
 * - 빈 문자열은 "지정 안 함"으로 보고 기본값으로 되돌린다 — 실수로 비우면 링크가 죽는다.
 * - ⚠ 티스토리 주소는 `/go/*` 리다이렉트의 목적지가 된다. 형식을 검증하지 않으면
 *   오픈 리다이렉트가 된다. `sanitizeUrl`을 반드시 거친다.
 */
import { CONTACT_EMAIL, TISTORY_BLOG_URL, TISTORY_FEATURED_URL, TISTORY_RSS_URL } from "./site-links";
import { normalizeDataMode, type DataMode } from "./data-mode";

export type SiteBasics = {
  dataMode: DataMode;
  /**
   * USD→KRW 기준 환율.
   * ⚠ 원화·달러 종목을 한 축에서 비교하려면 반드시 필요하다. 없으면 달러 종목이
   *    원화 종목에 파묻혀 비중이 통째로 틀린다(2026-08-02에 성장 버킷이 0.1%로 나왔다).
   *    실시간 시세가 아니라 운영자가 지정하는 기준값이고, 화면에 그렇게 밝힌다.
   */
  usdKrwRate: number;
  contactEmail: string;
  tistoryBlogUrl: string;
  tistoryFeaturedUrl: string;
  tistoryRssUrl: string;
  /** 대표 글을 콘텐츠로 보여주기 위한 제목·요약 */
  featuredTitle: string;
  featuredExcerpt: string;
  heroTitle: string;
  heroSubtitle: string;
};

export const DEFAULT_SITE_BASICS: SiteBasics = {
  dataMode: "PAPER",
  usdKrwRate: 1350,
  contactEmail: CONTACT_EMAIL,
  tistoryBlogUrl: TISTORY_BLOG_URL,
  tistoryFeaturedUrl: TISTORY_FEATURED_URL,
  tistoryRssUrl: TISTORY_RSS_URL,
  /**
   * ⚠ 2026-11-14: 처음 넣은 예시 문구(「배당 캘린더로 현금흐름을 설계하기」)가 운영에 남아, 링크(/2 「WoodsMan의 투자원칙」)와
   *    다른 글을 소개하고 있었다 — 애드센스 「콘텐츠를 잘못 표시」 위험. 블로그 소개로 바꾸고 연결도 블로그 첫 화면으로(운영자 승인).
   */
  featuredTitle: "거시경제와 기업분석 전문 블로그",
  featuredExcerpt:
    "금리·물가·유동성의 흐름과 기업분석을 주간 브리핑과 보고서로 깊게 씁니다. 포털의 숫자 뒤에 있는 해석은 블로그에서 이어집니다.",
  /**
   * ⚠ 2026-08-30: 계좌 이야기에서 **흐름 이야기로** 바꿨다.
   *
   * 파도(하루의 등락)가 아니라 **바람과 조류**(금리·물가·유동성의 구조 변화)를 본다는 것이
   * 이 사이트의 관점이고, 홈의 구조도 그렇게 바뀌었다(계좌는 입구가 아니라 증거다).
   * "누가 방향을 알려주기 전에 직접 읽는다"는 대목은 **가이던스에 기대면 시장이 스스로
   * 충격을 흡수하지 못한다**는 관점에서 왔다 — ⚠ 특정 인물의 발언을 인용하지는 않는다.
   * 검증되지 않은 인용은 그 자체가 신뢰 문제가 된다.
   */
  /**
   * ⚠ 영어를 괄호로 병기한다(2026-08-30). **조류**는 한국어에서 「새」로도 읽혀서,
   *    병기하지 않으면 은유가 엉뚱하게 걸린다. 파도·바람도 같이 맞춰 대칭을 준다.
   */
  /** ⚠ 2026-11-14 운영자: 세 줄 → 한 문장(옛 값 「파도(wave)가 아니라 바람(wind)과 조류(tide)를 봅니다」) */
  heroTitle: "투자자에게 파도(wave)가 아니라 바람(wind)과 조류(tide)를 설명하는 길잡이(Navigator)가 되겠습니다",
  /** ⚠ 2026-11-14 운영자: 부제 없음 — 빈 문자열이면 히어로가 그리지 않는다. 관리자가 설정에 넣으면 보인다 */
  heroSubtitle: "",
};

/**
 * ⚠ http(s)만 허용한다. `javascript:` 같은 스킴이 들어오면 클릭 한 번에 스크립트가 돈다.
 * 형식이 아니면 null을 돌려 기본값으로 되돌린다.
 */
export function sanitizeUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function sanitizeEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** ⚠ 0이나 음수 환율은 나눗셈·곱셈을 통째로 망친다. 말이 되는 범위만 받는다. */
export function sanitizeRate(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) && value > 0 && value < 100_000 ? value : null;
}

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export type SiteBasicsRow = {
  dataMode?: string | null;
  usdKrwRate?: number | null;
  contactEmail?: string | null;
  tistoryBlogUrl?: string | null;
  tistoryFeaturedUrl?: string | null;
  tistoryRssUrl?: string | null;
  featuredTitle?: string | null;
  featuredExcerpt?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
};

/** DB 행 + 코드 기본값 → 화면이 쓸 값. 행이 없으면 전부 기본값. */
export function resolveSiteBasics(row: SiteBasicsRow | null | undefined): SiteBasics {
  const d = DEFAULT_SITE_BASICS;
  if (!row) return d;

  return {
    dataMode: normalizeDataMode(row.dataMode),
    usdKrwRate: sanitizeRate(row.usdKrwRate) ?? d.usdKrwRate,
    contactEmail: sanitizeEmail(row.contactEmail) ?? d.contactEmail,
    tistoryBlogUrl: sanitizeUrl(row.tistoryBlogUrl) ?? d.tistoryBlogUrl,
    tistoryFeaturedUrl: sanitizeUrl(row.tistoryFeaturedUrl) ?? d.tistoryFeaturedUrl,
    tistoryRssUrl: sanitizeUrl(row.tistoryRssUrl) ?? d.tistoryRssUrl,
    featuredTitle: text(row.featuredTitle) ?? d.featuredTitle,
    featuredExcerpt: text(row.featuredExcerpt) ?? d.featuredExcerpt,
    heroTitle: text(row.heroTitle) ?? d.heroTitle,
    heroSubtitle: text(row.heroSubtitle) ?? d.heroSubtitle,
  };
}
