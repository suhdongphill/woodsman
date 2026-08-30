"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { cx } from "@/lib/format";
import { TreeMark, Wordmark } from "@/components/brand/Wordmark";

/**
 * 엠블럼(나무만).
 *
 * ⚠ 2026-08-30: **JPEG를 걷어냈다.** 배경색이 박힌 비트맵이라 크림 배경에서 검은 사각형처럼
 *    떴고, 24px로 줄이면 뭉개졌으며, 다크/라이트에 따라 색을 바꿀 수 없었다.
 *    지금은 `TreeMark`(SVG)가 부모의 `color`를 따라간다.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center text-series-1", className)}>
      <TreeMark size={size} />
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
      className={cx("group flex select-none items-center", className)}
    >
      <Wordmark compact={compact} />
    </Link>
  );
}
