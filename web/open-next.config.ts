import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare Workers 변환 설정.
 *
 * 지금은 기본값만 쓴다. ISR 캐시를 R2에 붙이는 건 콘텐츠가 늘고 나서 판단한다
 * (지금은 페이지 대부분이 동적이라 캐시 계층을 얹어도 얻는 게 적다).
 */
export default defineCloudflareConfig();
