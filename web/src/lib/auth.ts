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
import {
  clearLoginAttempt,
  findLoginAttempt,
  findUserByEmail,
  saveLoginAttempt,
} from "@/features/auth/repository";
import { loginSchema } from "@/features/auth/schema";
import { checkAttempt, maskEmail, recordFailure } from "./login-throttle";

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
        const now = new Date();

        /**
         * ⚠ **비밀번호를 대조하기 전에** 잠금을 본다.
         * bcrypt 비교는 이 워커에서 가장 비싼 연산이다. 잠긴 계정에도 해시를 돌리면
         * 잠금이 방어가 아니라 공격자가 CPU를 태우는 도구가 된다.
         */
        const record = await findLoginAttempt(email);
        const verdict = checkAttempt(record, now);
        if (verdict.kind === "locked") {
          /**
           * ⚠ 화면에는 여전히 **사유를 구분해 알려주지 않는다**(CLAUDE.md §6).
           * "잠겼습니다"라고 말하면 그 자체가 "이 주소를 두드릴 값어치가 있다"는 신호다.
           * 대신 서버 로그에는 반드시 남긴다 — 안 남기면 공격이 있었는지조차 모른다(§3).
           */
          console.error("[auth] 로그인 시도 제한으로 거절했다", {
            email: maskEmail(email),
            failures: verdict.failures,
            retryAfterSeconds: verdict.retryAfterSeconds,
          });
          return null;
        }

        const user = await findUserByEmail(email);
        /**
         * ⚠ **응답 시간으로 계정 존재가 새는 것은 알고 둔다.**
         * 있는 계정은 bcrypt 비교를 돌아 느리고, 없는 계정은 바로 돌아온다.
         * 메우는 방법은 가짜 해시를 한 번 대조해 시간을 맞추는 것인데,
         * 그러면 **아무 이메일로나 두드리기만 해도 우리 Worker CPU가 타간다**
         * (무료 등급 10ms). 위의 시도 제한이 같은 주소를 시간당 5번으로 막아
         * 타이밍을 재려면 몇 번이나 측정해야 하므로, 지금은 **안 맞추는 쪽**을 골랐다.
         */
        const ok = user?.passwordHash ? await compare(password, user.passwordHash) : false;

        if (!ok || !user) {
          /**
           * 예전에는 여기가 그냥 `return null`이었다 — 실패가 **로그조차 남지 않았다.**
           * 무차별 대입이 하루 종일 들어와도 화면에서 알 방법이 없었다.
           */
          const next = recordFailure(record, now);
          await saveLoginAttempt(email, next);
          /** ⚠ 계정 없음과 비밀번호 틀림을 **로그에서도** 구분하지 않는다. */
          console.error("[auth] 로그인 실패", {
            email: maskEmail(email),
            failures: next.failures,
          });
          return null;
        }

        await clearLoginAttempt(email);

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
