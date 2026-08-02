/**
 * Prisma Client 공급자.
 *
 * 같은 코드가 두 환경에서 돌아야 한다.
 *   - 로컬 개발·시드 : 파일 SQLite(`prisma/dev.db`). HMR에서 커넥션이 쌓이지 않게 globalThis에 캐시.
 *   - Cloudflare 운영 : D1 바인딩(`env.DB`)을 Prisma 드라이버 어댑터로 감싼다.
 *
 * Workers에는 파일 시스템이 없어 파일 SQLite가 아예 열리지 않으므로, 분기를 두지 않으면
 * 로컬은 되는데 배포만 죽는다. 판단 기준은 "D1 바인딩이 실제로 붙어 있는가" 하나다 —
 * 환경변수(NODE_ENV 등)로 추측하지 않는다.
 *
 * Workers는 요청마다 격리 실행되므로 D1 클라이언트는 요청 단위로 만든다(캐시하지 않는다).
 */
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** 로컬 파일 SQLite — 한 프로세스에서 하나만 만든다. */
function localClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    else return client;
  }
  return globalForPrisma.prisma;
}

/** Cloudflare 런타임이 아니거나 D1 바인딩이 없으면 null. */
async function d1Client(): Promise<PrismaClient | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as Record<string, unknown>).DB;
    if (!binding) return null;

    const { PrismaD1 } = await import("@prisma/adapter-d1");
    type D1Binding = ConstructorParameters<typeof PrismaD1>[0];
    return new PrismaClient({ adapter: new PrismaD1(binding as D1Binding) });
  } catch {
    // Cloudflare 컨텍스트 밖(로컬 dev·테스트·시드)에서는 조용히 로컬로 떨어진다.
    return null;
  }
}

/**
 * 요청 처리 중에 이걸로 DB를 얻는다.
 * 모듈 최상단에서 미리 만들어 두지 않는다 — D1 바인딩은 요청 컨텍스트에서만 보인다.
 */
export async function getDb(): Promise<PrismaClient> {
  return (await d1Client()) ?? localClient();
}
