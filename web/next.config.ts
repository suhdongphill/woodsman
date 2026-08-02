import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * 예전에 있던 두 가지 우회(웹팩 WASM 실험 플래그 + Prisma 생성물 파일트레이싱 제외)는
 * 런타임에서 Prisma를 걷어내면서 **전부 불필요해져 지웠다**.
 * 문제를 우회하는 설정이 계속 쌓이면 나중에 왜 있는지 아무도 모르게 된다.
 * (경위는 web/CHANGELOG.md와 src/lib/d1.ts 주석에 남겨 두었다.)
 */
/**
 * 정본 주소는 `portfolio-solutions.net` 하나다.
 *
 * `www.`도 같은 사이트를 그대로 띄우면 검색엔진에 **같은 글이 두 주소로 잡힌다**
 * (색인이 2026-08-02에 열렸으므로 지금부터는 실제 문제다).
 * 그래서 www로 들어온 요청은 경로를 유지한 채 정본으로 영구 이동시킨다.
 *
 * ⚠ 호스트를 여기 직접 적는다. 빌드 시점에 SITE_URL이 없을 수 있어(CI) 환경변수로 못 만든다.
 *    도메인을 바꾸면 이 값과 `wrangler.jsonc`의 routes를 같이 고친다.
 */
const CANONICAL_HOST = "portfolio-solutions.net";

const nextConfig: NextConfig = {
  async redirects() {
    const fromWww = [{ type: "host" as const, value: `www.${CANONICAL_HOST}` }];
    return [
      // ⚠ 루트와 하위 경로를 나눠 적는다. `/:path*` 하나로 묶으면 루트 요청에서
      //    치환이 일어나지 않아 `/:path*` 문자열이 그대로 Location에 나간다(실제로 겪음).
      { source: "/", has: fromWww, destination: `https://${CANONICAL_HOST}/`, permanent: true },
      {
        source: "/:path+",
        has: fromWww,
        destination: `https://${CANONICAL_HOST}/:path+`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

/**
 * `next dev`에도 Cloudflare 바인딩(로컬 D1)을 붙인다.
 *
 * 이게 없으면 로컬은 DB 없이 돌고 배포만 D1을 쓰게 되는데, 그 경로 차이가
 * "로컬은 되는데 배포만 죽는" 사고를 만든다(2026-08-02 실제 사고).
 * 로컬과 운영이 같은 방식으로 DB에 붙게 맞춘다.
 */
void initOpenNextCloudflareForDev();
