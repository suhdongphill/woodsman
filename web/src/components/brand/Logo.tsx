"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { cx } from "@/lib/format";

/**
 * Woodsman 엠블럼.
 * 원본은 `logo-data-uri.txt`(428×428 JPEG)를 `public/woodsman-logo.jpg`로 추출한 것.
 * 배경이 짙은 초록/검정이라 컨테이너 배경도 같은 톤으로 맞춰 경계가 보이지 않게 한다.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gold-600/30 bg-[#0b0f0c]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/woodsman-logo.jpg"
        alt=""
        width={size}
        height={size}
        priority
        className="h-full w-full object-cover"
      />
    </span>
  );
}

/**
 * 헤더 로고.
 *
 * 운영 진입점: **로고를 더블클릭하면 관리자 로그인 화면으로 간다.**
 * 이 사이트는 공개 회원가입을 받지 않으므로 상단 메뉴에 로그인 링크를 두지 않는다
 * (`src/lib/site-policy.ts` 참고). 그래서 관리자만 아는 진입 경로를 여기에 둔다.
 * 첫 클릭은 평소대로 홈으로 가고, 두 번째 클릭이 로그인으로 이어진다 —
 * 크롤러와 키보드 사용자에게는 여전히 평범한 홈 링크로 남는다.
 */
export function Logo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();

  function handleDoubleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    router.push("/login");
  }

  return (
    <Link
      href={href}
      onDoubleClick={handleDoubleClick}
      className={cx("flex select-none items-center gap-2.5 group", className)}
    >
      <LogoMark size={compact ? 30 : 36} />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-ink group-hover:text-gold-400 transition-colors">
          Woodsman
        </span>
        {!compact && (
          <span className="mt-1 text-[9px] text-muted tracking-[0.16em]">
            DISCIPLINE · PATIENCE · COMPOUNDING
          </span>
        )}
      </span>
    </Link>
  );
}
