/**
 * 사이트 정식 주소(canonical origin).
 *
 * sitemap·robots·OG 태그가 절대 URL을 필요로 하는데, 요청 Host를 그대로 쓰면
 * `*.workers.dev`와 실제 도메인이 섞여 검색엔진에 중복 URL이 잡힌다.
 * 그래서 운영에서는 환경변수로 못 박는다.
 *
 * 우선순위: SITE_URL → AUTH_URL(Auth.js와 같은 값을 재사용) → 로컬 기본값
 */
import type { EnvSource } from "./env";

const LOCAL_FALLBACK = "http://localhost:3000";

/** 끝의 슬래시를 떼고 origin만 남긴다. */
function normalize(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function siteUrl(source: EnvSource = process.env): string {
  return normalize(source.SITE_URL ?? "") ?? normalize(source.AUTH_URL ?? "") ?? LOCAL_FALLBACK;
}

/** 절대 URL로 만든다. sitemap·OG에 쓴다. */
export function absoluteUrl(path: string, source: EnvSource = process.env): string {
  return `${siteUrl(source)}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * 운영 도메인이 지정됐는지 — 지정되기 전에는 검색엔진 색인을 허용하지 않는다.
 * 개발용 미리보기 주소가 색인되면 나중에 정리하기 어렵다.
 */
export function hasCanonicalDomain(source: EnvSource = process.env): boolean {
  return Boolean(normalize(source.SITE_URL ?? "") ?? normalize(source.AUTH_URL ?? ""));
}
