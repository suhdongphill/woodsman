/**
 * Auth.js 타입 확장 — 세션·토큰에 우리 도메인 값(id, role)을 얹는다.
 * 이 파일이 없으면 `session.user.role`이 타입 에러가 된다.
 */
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/access";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  /** Credentials authorize()와 Prisma 어댑터가 함께 돌려주는 사용자 */
  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
