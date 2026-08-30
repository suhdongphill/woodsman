import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "@/features/auth/ui/LoginForm";
import { SocialButtons } from "@/features/auth/ui/SocialButtons";
import { safeNextPath } from "@/lib/access";
import { currentUser } from "@/lib/session";
import { getSitePolicy } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "로그인",
  // 공개 가입을 받지 않는 동안 이 화면은 운영자 전용이므로 검색에 노출하지 않는다.
  robots: { index: false, follow: false },
};

/**
 * 로그인 화면.
 *
 * 공개 가입을 받지 않는 동안 이 화면은 **운영자 전용 진입점**이다.
 * 상단 메뉴에 링크가 없고, 로고를 더블클릭해야 도달한다
 * (`components/brand/Logo.tsx`). 라우트를 숨기지는 않는다 —
 * 주소를 아는 사람이 들어와도 계정이 없으면 아무 일도 일어나지 않기 때문이다.
 *
 * 정책: 관리자 기본 비밀번호 힌트를 절대 표시하지 않는다.
 * 관리자 계정은 .env(ADMIN_EMAIL/ADMIN_PASSWORD) 시드 upsert로만 설정된다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const [user, policy] = await Promise.all([currentUser(), getSitePolicy()]);

  if (user) {
    // 이미 로그인한 관리자가 로고를 더블클릭하면 홈으로 되돌려 보내지 않는다.
    // 그러면 "아무 일도 일어나지 않았다"로 보여서 진입점이 고장 난 줄 알게 된다.
    // 갈 곳을 따로 지정하지 않았을 때만 관리자 화면으로 보낸다.
    redirect(next === "/" && user.role === "ADMIN" ? "/admin" : next);
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="flex flex-col items-center mb-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-xl font-bold text-ink">
          {policy.signupEnabled ? "로그인" : "운영자 로그인"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {policy.signupEnabled
            ? "개인 포트폴리오와 댓글 기능을 이용하세요."
            : "콘텐츠를 읽는 데는 로그인이 필요하지 않습니다."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <LoginForm next={next} />
        <SocialButtons next={next} />
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        {policy.signupEnabled ? (
          <>
            아직 계정이 없으신가요?{" "}
            <Link href="/register" className="text-gold-400 hover:text-gold-500">
              회원가입
            </Link>
          </>
        ) : (
          <Link href="/" className="text-gold-400 hover:text-gold-500">
            홈으로 돌아가기
          </Link>
        )}
      </p>
    </div>
  );
}
