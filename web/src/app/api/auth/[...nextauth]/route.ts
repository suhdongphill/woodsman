/**
 * Auth.js 엔드포인트 (/api/auth/*).
 * bcrypt·Prisma를 쓰므로 Node 런타임에서 실행한다.
 */
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
