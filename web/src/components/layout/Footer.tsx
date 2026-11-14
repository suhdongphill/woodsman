import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ExternalIcon } from "@/components/icons";
import { outboundHref } from "@/lib/outbound";
import { getSiteBasics } from "@/lib/site-settings";

/** ⚠ 상단 메뉴와 **같은 순서**를 쓴다(2026-08-30). 두 곳이 다르면 우선순위가 흔들린다. */
const CONTENT_LINKS = [
  { href: "/macro", label: "거시 지표" },
  { href: "/insights", label: "인사이트" },
  { href: "/blog", label: "블로그" },
  { href: "/briefing", label: "오늘의 브리핑" },
  { href: "/leaders", label: "주도주" },
  { href: "/portfolio", label: "대표 포트폴리오" },
  { href: "/stocks", label: "종목분석" },
  { href: "/journal", label: "투자일지" },
];

const POLICY_LINKS = [
  { href: "/about", label: "사이트 소개" },
  { href: "/disclaimer", label: "투자 판단 책임 고지" },
  { href: "/privacy", label: "개인정보 처리방침" },
  { href: "/data-terms", label: "데이터 이용 조건" },
];

export async function Footer({ showCommunity = false }: { showCommunity?: boolean }) {
  // 문의 메일은 /admin/settings에서 바꾼다. 코드 상수는 DB를 못 읽었을 때의 기본값일 뿐이다.
  const { contactEmail } = await getSiteBasics();
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
              <span className="text-sm font-bold text-ink">Woodsman</span>
            </div>
            {/*
              ⚠ 2026-11-14 맞바꿈(운영자): 이 자리에 있던 「성장·인컴·방어 세 기능으로 …」는 홈 히어로 부제(운영 설정)로 올라갔다.
              같은 문장이 홈에서 두 번 보이지 않게, 히어로에 있던 문장을 여기로 내렸다.
            */}
            <p className="text-xs text-muted mt-3 leading-relaxed">
              금리·물가·유동성이 어느 쪽으로 부는지 먼저 읽고, 그 흐름에 포트폴리오를 어떻게 맞췄는지
              그대로 남깁니다. 일기예보를 보고 우산을 챙기듯, 누가 방향을 알려주기 전에 지표를 직접 읽는
              자리입니다.
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
            {/* 경유 링크 — 블로그로 넘어간 클릭을 센다(src/lib/outbound.ts) */}
            <a
              href={outboundHref("tistory")}
              target="_blank"
              rel="noopener"
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
            운영 · Woodsman · {contactEmail} ·{" "}
            <a
              href={outboundHref("tistory")}
              target="_blank"
              rel="noopener"
              className="hover:text-gold-400"
            >
              티스토리 블로그
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
