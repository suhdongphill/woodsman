"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/Button";
import { MenuIcon, CloseIcon, GearIcon } from "@/components/icons";
import { signOutAction } from "@/features/auth/actions";
import { cx } from "@/lib/format";
import type { Role } from "@/lib/access";

/**
 * 공개 내비게이션.
 *
 * 지금은 운영자 1인 블로그라 **로그인·회원가입 링크를 두지 않는다**
 * (관리자는 로고를 더블클릭해 들어온다 — `components/brand/Logo.tsx`).
 * 커뮤니티 메뉴와 인증 링크는 관리자가 설정을 켜면 되살아난다 —
 * 판단은 `src/lib/site-policy.ts`가 한다.
 */

/**
 * ⚠ 2026-08-30: **순서를 뒤집었다.** 경제 흐름(거시·인사이트)이 앞, 계좌·종목이 뒤다.
 *
 * 파도가 아니라 바람과 조류를 본다는 관점에서, 방문자가 먼저 만나야 하는 것은
 * "지금 어떤 바람이 부는가"이고 포트폴리오·종목분석은 **그에 대한 답**이다.
 * ⚠ 순서는 곧 우선순위다 — 여기서 앞에 둔 것이 사이트가 무엇을 하는 곳인지 말한다.
 */
const BASE_NAV = [
  { href: "/", label: "홈" },
  { href: "/macro", label: "거시 지표" },
  { href: "/insights", label: "인사이트" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/stocks", label: "종목분석" },
  /**
   * ⚠ 투자일지는 **맨 뒤**다(2026-08-30). 흐름(거시·인사이트) → 그에 대한 답
   * (포트폴리오·종목분석) → 그 판단의 기록(투자일지) 순서다.
   * 기록은 미끼가 아니라 **근거**라서, 앞의 것을 읽은 사람이 마지막에 확인하는 자리다.
   */
  { href: "/journal", label: "투자일지" },
];

/** 커뮤니티가 열렸을 때만 끼워 넣는다 */
const COMMUNITY_NAV = { href: "/board", label: "커뮤니티" };

export type NavUser = { name: string | null; email: string | null; role: Role };

function displayName(user: NavUser): string {
  return user.name?.trim() || user.email?.split("@")[0] || "회원";
}

function Avatar({ user }: { user: NavUser }) {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-500/15 text-[11px] font-semibold text-gold-400">
      {displayName(user).charAt(0).toUpperCase()}
    </span>
  );
}

export function TopNav({
  user,
  showCommunity = false,
  showAuth = false,
}: {
  user: NavUser | null;
  showCommunity?: boolean;
  showAuth?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = showCommunity
    ? [...BASE_NAV.slice(0, 3), COMMUNITY_NAV, ...BASE_NAV.slice(3)]
    : BASE_NAV;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden md:flex items-center gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx(
                    "px-3 py-2 text-sm rounded-lg transition-colors",
                    isActive(n.href)
                      ? "text-gold-400 bg-gold-500/10"
                      : "text-muted hover:text-ink hover:bg-cardHover",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {/* 테마 선택 — 로그인 여부와 무관하게 누구나 쓴다 */}
            <ThemeToggle className="mr-1" />
            {user ? (
              <>
                {user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
                  >
                    <GearIcon size={15} />
                    관리자
                  </Link>
                )}
                <span className="flex items-center gap-2 px-2 text-sm text-gray-300">
                  <Avatar user={user} />
                  {displayName(user)}
                </span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              showAuth && (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
                  >
                    로그인
                  </Link>
                  <LinkButton href="/register" variant="gold" size="sm">
                    회원가입
                  </LinkButton>
                </>
              )
            )}
          </div>

          <button
            type="button"
            aria-label="메뉴"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 -mr-2 text-muted hover:text-ink transition-colors"
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card">
          <nav className="px-4 py-3 flex flex-col">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "px-2 py-3 text-sm border-b border-border/60 last:border-0",
                  isActive(n.href) ? "text-gold-400" : "text-gray-300",
                )}
              >
                {n.label}
              </Link>
            ))}

            {user ? (
              <div className="pt-4 pb-2 space-y-3">
                <div className="flex items-center gap-2 px-2 text-sm text-gray-300">
                  <Avatar user={user} />
                  {displayName(user)}
                </div>
                <div className="flex gap-2">
                  {user.role === "ADMIN" && (
                    <LinkButton href="/admin" variant="outline" size="sm" full>
                      관리자
                    </LinkButton>
                  )}
                  <form action={signOutAction} className="flex-1">
                    <button
                      type="submit"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-border text-ink hover:bg-cardHover transition-colors"
                    >
                      로그아웃
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              showAuth && (
                <div className="flex gap-2 pt-4 pb-2">
                  <LinkButton href="/login" variant="outline" size="sm" full>
                    로그인
                  </LinkButton>
                  <LinkButton href="/register" variant="gold" size="sm" full>
                    회원가입
                  </LinkButton>
                </div>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
