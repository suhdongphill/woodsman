import type { NextConfig } from "next";

/**
 * Prisma 생성 클라이언트를 파일 트레이싱에서 제외한다.
 *
 * 배경: `src/generated/prisma/runtime/library.js`에는 dotenv가 번들돼 있고,
 * 그 안의 `path.join(os.homedir(), …)`를 Next의 트레이서(@vercel/nft)가 정적으로
 * 평가해 홈 디렉터리 전체를 glob 한다. Windows에서는 `C:\Users\<계정>\Application Data`
 * 정션이 접근 거부(EPERM)라 빌드가 통째로 실패한다.
 *
 * node_modules 안의 파일은 Next가 기본으로 트레이싱에서 빼기 때문에 이 문제가 없는데,
 * 우리는 클라이언트를 `src/` 아래에 생성하므로 그 규칙을 비껴간다. 같은 취급을
 * 직접 지정해 준다(웹팩이 어차피 번들하므로 트레이싱 대상일 필요가 없다).
 *
 * Next가 TraceEntryPointsPlugin을 `traceIgnores: []`로 하드코딩해 넘기고 설정 키를
 * 노출하지 않아, 플러그인 인스턴스를 찾아 패턴을 넣는다. Next 업그레이드로 이 훅이
 * 안 먹으면 빌드가 다시 EPERM으로 실패하므로 조용히 망가지지는 않는다.
 */
function isTracePlugin(p: unknown): p is { traceIgnores: string[] } {
  return (
    typeof p === "object" &&
    p !== null &&
    p.constructor?.name === "TraceEntryPointsPlugin" &&
    Array.isArray((p as { traceIgnores?: unknown }).traceIgnores)
  );
}

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) return config;

    const plugin = config.plugins?.find(isTracePlugin);
    plugin?.traceIgnores.push("**/src/generated/prisma/**");

    return config;
  },
};

export default nextConfig;
