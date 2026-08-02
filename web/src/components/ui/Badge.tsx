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

/** 클릭 가능한 필터 칩 */
export function Chip({
  children,
  active = false,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
        active
          ? "bg-gold-500/15 text-gold-400 border-gold-500/40"
          : "bg-card text-muted border-border hover:text-white hover:border-gold-600/40",
        className,
      )}
    >
      {children}
    </span>
  );
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
