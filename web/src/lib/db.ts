/**
 * Prisma Client 싱글턴.
 * Next.js 개발 모드의 HMR에서 커넥션이 누적되지 않도록 globalThis에 캐시한다.
 * Phase 9(Cloudflare D1)에서는 여기서 driverAdapters(@prisma/adapter-d1)를 주입한다.
 */
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
