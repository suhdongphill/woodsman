import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { CheckIcon, LockIcon } from "@/components/icons";
import { RegisterForm } from "@/features/auth/ui/RegisterForm";
import { SocialButtons } from "@/features/auth/ui/SocialButtons";
import { safeNextPath } from "@/lib/access";
import { currentUser } from "@/lib/session";
import { getSitePolicy } from "@/lib/site-settings";
import { getSiteBasics } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "회원가입",
  description:
    "Woodsman은 현재 공개 회원가입을 받지 않습니다. 모든 콘텐츠는 가입 없이 읽을 수 있습니다.",
};

const BENEFITS = [
  "개인 포트폴리오를 비공개로 관리",
  "기존 브라우저(localStorage) 데이터 1회 가져오기",
  "인사이트·게시판 댓글 참여",
];

/**
 * 회원가입 화면.
 *
 * 지금은 **가입을 받지 않는다**. 아래 폼은 지우지 않고 정책 스위치
 * (`SiteConfig.signupEnabled`)로만 막아 둔다 — 커뮤니티를 열 때 그대로 쓰기 위해서다.
 * 스위치가 꺼져 있으면 폼 대신 "왜 아직 받지 않는지"를 설명한다.
 * 광고·검색 심사에서도 이 안내가 있어야 '동작하지 않는 가입 폼'으로 읽히지 않는다.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const [user, policy] = await Promise.all([currentUser(), getSitePolicy()]);

  if (user) redirect(next);

  if (!policy.signupEnabled) return <SignupClosed />;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="flex flex-col items-center mb-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-xl font-bold text-white">회원가입</h1>
        <p className="mt-1.5 text-[13px] text-muted">30초면 끝납니다.</p>
      </div>

      <ul className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-2.5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-center gap-2.5 text-[13px] text-gray-300">
            <CheckIcon size={15} className="text-emerald-400 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <div className="bg-card border border-border rounded-2xl p-6">
        <RegisterForm next={next} />
        <SocialButtons next={next} />
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-gold-400 hover:text-gold-500">
          로그인
        </Link>
      </p>
    </div>
  );
}

async function SignupClosed() {
  const { contactEmail } = await getSiteBasics();
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <LogoMark size={52} />
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-cardHover px-3 py-1 text-[11px] text-muted">
          <LockIcon size={12} />
          회원가입 준비 중
        </span>
        <h1 className="mt-4 text-xl font-bold text-white">
          아직 회원가입은 지원하지 않습니다
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Woodsman은 운영자 한 사람이 자신의 계좌와 판단을 기록하는 블로그입니다.
          <br className="hidden sm:block" />
          지금은 회원 기능 없이 <strong className="text-gray-300">모든 글을 그대로 열어 두는 것</strong>
          이 더 정직하다고 판단했습니다.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-left">
        <h2 className="text-sm font-semibold text-white">지금 하실 수 있는 것</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] text-gray-300">
          <li className="flex gap-2.5">
            <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>
              가입 없이 <Link href="/insights" className="text-gold-400 hover:text-gold-500">인사이트</Link>
              ·<Link href="/portfolio" className="text-gold-400 hover:text-gold-500">대표 포트폴리오</Link>
              ·<Link href="/journal" className="text-gold-400 hover:text-gold-500">투자일지</Link>를 전부 읽을 수 있습니다.
            </span>
          </li>
          <li className="flex gap-2.5">
            <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>계정을 만들지 않으므로 개인정보를 수집하지 않습니다.</span>
          </li>
          <li className="flex gap-2.5">
            <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>의견이나 질문은 이메일({contactEmail})로 받고 있습니다.</span>
          </li>
        </ul>

        <p className="mt-5 border-t border-border/70 pt-4 text-[12px] leading-relaxed text-gray-500">
          댓글·게시판을 포함한 커뮤니티 기능은 준비돼 있으며, 콘텐츠가 충분히 쌓이면 열 예정입니다.
          자세한 내용은{" "}
          <Link href="/privacy" className="text-gold-400 hover:text-gold-500">
            개인정보 처리방침
          </Link>
          에 적어 두었습니다.
        </p>
      </div>
    </div>
  );
}
