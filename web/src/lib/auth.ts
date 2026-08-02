/**
 * Auth.js 완전판 (Node 런타임 전용).
 *
 * Credentials는 bcrypt 대조가 필요해 Edge에서 돌 수 없다. 미들웨어는 이 파일이 아니라
 * `auth.config.ts`를 쓴다(그쪽이 Edge 안전판).
 *
 * 세션 전략은 JWT다. Credentials 프로바이더는 DB 세션을 지원하지 않으며,
 * JWT여야 미들웨어가 DB 왕복 없이 role을 읽을 수 있다. Prisma 어댑터는
 * 소셜 로그인 계정 연결(Account/User 생성)을 위해 그대로 둔다.
 *
 * 설정을 **함수로** 넘기는 이유: Cloudflare D1 바인딩은 요청 컨텍스트에서만 보이므로
 * 모듈 최상단에서 DB 클라이언트를 만들 수 없다. Auth.js v5가 요청마다 이 함수를
 * 호출해 주므로 그 안에서 `getDb()`를 부른다.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { getDb } from "./db";
import { authConfig } from "./auth.config";
import { loginSchema } from "@/features/auth/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();

  return {
    ...authConfig,
    adapter: PrismaAdapter(db),
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
          const user = await db.user.findUnique({ where: { email } });
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
  };
});
