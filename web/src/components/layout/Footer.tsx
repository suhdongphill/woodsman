import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ExternalIcon } from "@/components/icons";
import { CONTACT_EMAIL, TISTORY_FEATURED_URL, displayUrl } from "@/lib/site-links";

const CONTENT_LINKS = [
  { href: "/portfolio", label: "대표 포트폴리오" },
  { href: "/journal", label: "투자일지" },
  { href: "/insights", label: "인사이트" },
  { href: "/stocks", label: "종목분석" },
];

const POLICY_LINKS = [
  { href: "/about", label: "사이트 소개" },
  { href: "/disclaimer", label: "투자 판단 책임 고지" },
  { href: "/privacy", label: "개인정보 처리방침" },
];

export function Footer({ showCommunity = false }: { showCommunity?: boolean }) {
  const contentLinks = showCommunity
    ? [...CONTENT_LINKS, { href: "/board", label: "커뮤니티" }]
    : CONTENT_LINKS;

  return (
    <footer className="border-t border-border mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="text-sm font-bold text-white">Woodsman</span>
            </div>
            <p className="text-xs text-muted mt-3 leading-relaxed">
              성장·인컴·방어 세 기능으로 자산을 나누고, 매달의 납입과 판단을 기록으로 남기는
              개인 투자 블로그입니다. 운용 중인 계좌의 성과를 그대로 공개합니다.
            </p>
            <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
              본 사이트의 모든 콘텐츠는 <strong className="text-gray-500">정보 제공 목적</strong>
              이며 투자 권유나 자문이 아닙니다. 모든 투자 판단과 그 결과의 책임은 투자자 본인에게
              있습니다.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5">
            <p className="text-[11px] font-medium text-gray-500">콘텐츠</p>
            {contentLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-muted hover:text-gold-400 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={TISTORY_FEATURED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-gold-400"
            >
              티스토리 블로그
              <ExternalIcon size={11} />
            </a>
          </nav>

          <nav className="flex flex-col gap-2.5">
            <p className="text-[11px] font-medium text-gray-500">안내</p>
            {POLICY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-muted hover:text-gold-400 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border/70 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-[11px] text-gray-600">© 2026 Woodsman. All rights reserved.</p>
          <p className="text-[11px] text-gray-600">
            운영 · 서동필 · {CONTACT_EMAIL} ·{" "}
            <a
              href={TISTORY_FEATURED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold-400"
            >
              {displayUrl(TISTORY_FEATURED_URL)}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
