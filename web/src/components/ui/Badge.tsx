import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import type { FunctionType, PostType, PostSource } from "@/lib/types";

export type BadgeTone = "gold" | "emerald" | "neutral" | "warn" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  gold: "bg-gold-500/15 text-gold-400 border-gold-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  neutral: "bg-white/5 text-gray-400 border-border",
  warn: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
  info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium leading-5 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * 필터 칩.
 *
 * ⚠ `href`를 주면 링크가 되고, 안 주면 **커서도 바뀌지 않는 표시용 라벨**이다.
 *   전에는 href 없이도 `cursor-pointer`가 붙어 있어 누를 수 있어 보였는데 아무 일도
 *   일어나지 않았다(2026-08-07 점검). 죽은 버튼을 두지 않는다 — 운영지침 1장.
 */
export function Chip({
  children,
  active = false,
  className,
  href,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
  /** 누를 수 있게 하려면 반드시 준다. */
  href?: string;
}) {
  const classes = cx(
    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
    active
      ? "bg-gold-500/15 text-gold-400 border-gold-500/40"
      : "bg-card text-muted border-border",
    // 누를 수 있을 때만 누를 수 있어 보이게 한다.
    href && "cursor-pointer hover:text-white hover:border-gold-600/40",
    className,
  );

  if (href) {
    return (
      <Link href={href} scroll={false} className={classes}>
        {children}
      </Link>
    );
  }
  return <span className={classes}>{children}</span>;
}

export const FUNCTION_LABEL: Record<FunctionType, string> = {
  GROWTH: "성장",
  INCOME: "인컴",
  DEFENSE: "방어",
};

export const FUNCTION_COLOR: Record<FunctionType, string> = {
  GROWTH: "#36a06a",
  INCOME: "#c9a657",
  DEFENSE: "#5b7fa6",
};

export function FunctionBadge({ type }: { type: FunctionType }) {
  const tone: BadgeTone = type === "GROWTH" ? "emerald" : type === "INCOME" ? "gold" : "info";
  return <Badge tone={tone}>{FUNCTION_LABEL[type]}</Badge>;
}

export const POST_TYPE_LABEL: Record<PostType, string> = {
  INSIGHT: "인사이트",
  ANALYSIS: "종목분석",
  NOTICE: "공지",
};

export function PostTypeBadge({ type }: { type: PostType }) {
  const tone: BadgeTone = type === "INSIGHT" ? "gold" : type === "ANALYSIS" ? "emerald" : "info";
  return <Badge tone={tone}>{POST_TYPE_LABEL[type]}</Badge>;
}

export function SourceBadge({ source }: { source: PostSource }) {
  if (source === "SELF") return null;
  return <Badge tone="neutral">티스토리</Badge>;
}
