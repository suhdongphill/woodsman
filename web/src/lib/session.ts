/**
 * 서버 컴포넌트·서버 액션에서 쓰는 세션 헬퍼.
 *
 * 미들웨어는 1차 방어선일 뿐이다(matcher를 고치는 순간 구멍이 난다).
 * 보호가 필요한 페이지·액션은 여기 헬퍼로 한 번 더 확인한다.
 */
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { loginPath, normalizeRole, type Role } from "./access";

export type SessionUser = {
  id: string;
  role: Role;
  name: string | null;
  email: string | null;
  image: string | null;
};

/** 로그인하지 않았으면 null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  return {
    id: user.id,
    role: normalizeRole(user.role),
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

/** 로그인 필수 영역. 미인증이면 로그인 화면으로 보낸다. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(loginPath(returnTo));
  return user;
}

/** 관리자 전용 영역. 권한이 없으면 홈으로 보낸다(미들웨어와 같은 규칙). */
export async function requireAdmin(returnTo = "/admin"): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
