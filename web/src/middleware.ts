/**
 * 보호 라우트 미들웨어 (Edge).
 *
 * Prisma·bcrypt를 못 쓰므로 Edge 안전판 설정(auth.config.ts)만 불러 JWT를 해석한다.
 * 판정 규칙 자체는 `@/lib/access`의 순수 함수라 단위 테스트로 고정돼 있다.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { decideAccess, normalizeRole } from "@/lib/access";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const role = req.auth?.user ? normalizeRole(req.auth.user.role) : null;
  const { pathname, search } = req.nextUrl;

  const decision = decideAccess(pathname, role, search);
  if (decision.kind === "allow") return NextResponse.next();

  return NextResponse.redirect(new URL(decision.to, req.nextUrl.origin));
});

/**
 * Next.js는 이 값을 빌드 타임에 '문자열 리터럴'로 읽으므로 상수를 참조할 수 없다.
 * `@/lib/access`의 PROTECTED_MATCHER와 어긋나면 access.test.ts가 깨진다.
 */
export const config = { matcher: ["/admin/:path*", "/me/:path*"] };
