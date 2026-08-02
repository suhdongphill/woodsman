/**
 * Edge에서도 안전한 Auth.js 설정 조각.
 *
 * 미들웨어는 Edge 런타임에서 돌기 때문에 Prisma·bcrypt를 import 할 수 없다.
 * 그래서 설정을 둘로 나눈다:
 *   - 이 파일(auth.config.ts): 세션 콜백 + OAuth 프로바이더 → 미들웨어가 사용
 *   - auth.ts: 여기에 Prisma 어댑터와 Credentials(bcrypt 대조)를 더한 완전판
 * 세션은 JWT 전략이라 미들웨어가 DB 없이도 역할(role)을 읽을 수 있다.
 */
import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { isSocialProviderConfigured } from "./auth-providers";
import { normalizeRole } from "./access";

/** env에 ID/SECRET이 모두 있는 소셜만 등록한다(없는 버튼은 화면에도 안 나온다). */
function socialProviders(): Provider[] {
  const list: Provider[] = [];
  if (isSocialProviderConfigured("google")) list.push(Google);
  if (isSocialProviderConfigured("kakao")) list.push(Kakao);
  return list;
}

export const authConfig = {
  providers: socialProviders(),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  /**
   * 자체 호스팅(Vercel이 아님)에서는 이 값이 없으면 Auth.js가 모든 요청을
   * UntrustedHost로 막아 프로덕션 로그인이 통째로 실패한다. 개발 서버는
   * localhost를 자동 신뢰하므로 이 문제가 드러나지 않는다.
   *
   * Host 헤더를 신뢰한다는 뜻이므로, 운영에서는 `.env`의 AUTH_URL로
   * 정식 주소를 못 박아 콜백 URL이 헤더에 휘둘리지 않게 한다.
   */
  trustHost: true,
  callbacks: {
    /** 로그인 시점에만 user가 채워진다. 이후 요청은 토큰에 담긴 값을 재사용한다. */
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = normalizeRole((user as { role?: unknown }).role);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = normalizeRole(token.role);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
