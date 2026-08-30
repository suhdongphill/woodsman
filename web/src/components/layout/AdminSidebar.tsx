"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutIcon,
  BriefcaseIcon,
  FileTextIcon,
  MessageIcon,
  BotIcon,
  RssIcon,
  HomeIcon,
  UsersIcon,
  MenuIcon,
  CloseIcon,
  ExternalIcon,
  ClockIcon,
  GearIcon,
  BarChartIcon,
  LockIcon,
  TrendingUpIcon,
} from "@/components/icons";
import { cx } from "@/lib/format";

const MENU = [
  { href: "/admin", label: "대시보드", icon: LayoutIcon, exact: true },
  { href: "/admin/model-portfolio", label: "대표 포트폴리오", icon: BriefcaseIcon },
  { href: "/admin/journal", label: "투자일지 · 계좌", icon: ClockIcon },
  { href: "/admin/analytics", label: "화면 통계", icon: BarChartIcon },
  { href: "/admin/macro", label: "거시 지표", icon: BarChartIcon },
  { href: "/admin/bubble", label: "버블 모니터", icon: BotIcon },
  { href: "/admin/stocks", label: "종목 보고서", icon: TrendingUpIcon },
  { href: "/admin/posts", label: "콘텐츠", icon: FileTextIcon },
  { href: "/admin/comments", label: "댓글 · 정책", icon: MessageIcon },
  { href: "/admin/ai", label: "AI 제공자", icon: BotIcon },
  { href: "/admin/feeds", label: "RSS 피드", icon: RssIcon },
  { href: "/admin/home", label: "홈 편집", icon: HomeIcon },
  { href: "/admin/settings", label: "사이트 기본값", icon: GearIcon },
  { href: "/admin/users", label: "사용자", icon: UsersIcon },
  // ⚠ 무엇이 언제 바뀌었는지 되짚는 자리. 2026-08-30 「죽은 버튼」 사고의 산물이다.
  { href: "/admin/logs", label: "활동 로그", icon: ClockIcon },
  // ⚠ 방어 장치가 "붙어 있나"가 아니라 "실제로 막나"를 재는 화면. 2026-08-11 사고의 산물이다.
  { href: "/admin/diagnostics", label: "자가 진단", icon: LockIcon },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {MENU.map((m) => {
        const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
        const Icon = m.icon;
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onNavigate}
            className={cx(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-colors",
              active
                ? "bg-gold-500/12 text-gold-400 border border-gold-500/25"
                : "text-muted hover:text-white hover:bg-cardHover border border-transparent",
            )}
          >
            <Icon size={16} />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-bg/90 backdrop-blur">
        <Logo compact />
        <button
          type="button"
          aria-label="관리자 메뉴"
          onClick={() => setOpen((v) => !v)}
          className="p-2 -mr-2 text-muted hover:text-white"
        >
          {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-b border-border bg-card px-4 py-3">
          <Nav onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border min-h-screen px-4 py-5 sticky top-0 h-screen">
        <Logo compact />
        <div className="mt-6 mb-3 px-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gold-500/12 border border-gold-500/25 text-[10px] text-gold-400">
            ADMIN
          </span>
        </div>
        <Nav />
        <div className="mt-auto pt-5 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-muted hover:text-white hover:bg-cardHover transition-colors"
          >
            <ExternalIcon size={15} />
            사이트로 이동
          </Link>
        </div>
      </aside>
    </>
  );
}
