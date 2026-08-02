/**
 * Auth.js 완전판 (Node 런타임 전용).
 *
 * Credentials는 bcrypt 대조가 필요해 Edge에서 돌 수 없다. 미들웨어는 이 파일이 아니라
 * `auth.config.ts`를 쓴다(그쪽이 Edge 안전판).
 *
 * 세션 전략은 JWT다. Credentials 프로바이더는 DB 세션을 지원하지 않으며,
 * JWT여야 미들웨어가 DB 왕복 없이 role을 읽을 수 있다.
 *
 * ⚠ **어댑터를 붙이지 않는다.** 어댑터는 소셜 로그인 계정 연결(Account/User 생성)에만
 *    필요한데, 지금은 소셜을 켜 두지 않았다. Prisma 어댑터는 런타임 Prisma를 요구하고
 *    Prisma는 Workers에서 동작하지 않아 걷어냈다(src/lib/d1.ts 주석 참고).
 *    소셜을 열 때는 `@auth/d1-adapter`를 붙이면 된다 — 스키마는 이미 Account/Session을 갖고 있다.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "./auth.config";
import { findUserByEmail } from "@/features/auth/repository";
import { loginSchema } from "@/features/auth/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "이메일",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      /**
       * 실패 사유(없는 계정 / 틀린 비밀번호 / 소셜 전용 계정)를 구분해 알려주지 않는다.
       * 계정 존재 여부가 새어나가면 이메일 수집에 쓰인다.
       */
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await findUserByEmail(email);
        if (!user?.passwordHash) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});
