import type { MetadataRoute } from "next";
import { absoluteUrl, hasCanonicalDomain } from "@/lib/site-url";
import { CRAWLER_DISALLOW, aiCrawlerRules } from "@/lib/ai-crawlers";

/**
 * robots.txt.
 *
 * 정식 도메인(SITE_URL)이 정해지기 전에는 **전체 차단**한다.
 * 미리보기 주소(*.workers.dev)가 색인되면 나중에 중복 콘텐츠로 정리하기 어렵다.
 * 광고 심사에서도 색인 상태가 깔끔한 편이 낫다.
 */
/**
 * SITE_URL은 Cloudflare 대시보드에 넣는 **런타임** 값이다.
 * 정적으로 구우면 빌드 시점의 "값 없음 → 전체 차단"이 그대로 박제된다.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!hasCanonicalDomain()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 운영 화면과 인증 엔드포인트는 색인 대상이 아니다.
        disallow: CRAWLER_DISALLOW,
      },
      /**
       * AI 크롤러를 **이름으로** 적어 둔다(`src/lib/ai-crawlers.ts`).
       * `*`로 이미 열려 있어 동작은 같지만, ⚠ 나중에 `*`를 조일 때 AI까지 함께 잠기는 것을
       * 막고, "왜 열었는지"를 기록으로 남긴다.
       */
      ...aiCrawlerRules(),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
