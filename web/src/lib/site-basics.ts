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
  featuredTitle: "배당 캘린더로 현금흐름을 설계하기",
  featuredExcerpt:
    "월별 배당 입금일을 달력에 깔면 인컴 포트폴리오의 빈 달이 보입니다. 그 빈 달을 어떻게 메웠는지 원문에 적었습니다.",
  heroTitle: "원칙대로 심고, 기다리고, 불린다",
  heroSubtitle:
    "성장·인컴·방어로 나눈 계좌를 그대로 공개합니다. 매달 얼마를 넣었고 지금 얼마가 되었는지, 그 사이에 무엇을 사고팔았는지까지 기록으로 남깁니다.",
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
