import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";

export type ButtonVariant = "emerald" | "gold" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  emerald:
    "bg-emerald-500 hover:bg-emeraldDark text-white border border-transparent shadow-[0_2px_10px_rgba(54,160,106,.25)]",
  gold: "bg-gold-500 hover:bg-gold-400 text-[#1a1400] font-semibold border border-transparent shadow-[0_2px_10px_rgba(201,166,87,.25)]",
  ghost: "bg-transparent hover:bg-cardHover text-muted hover:text-white border border-transparent",
  outline: "bg-transparent hover:bg-cardHover text-ink border border-border hover:border-gold-600",
  danger: "bg-red-600 hover:bg-red-700 text-white border border-transparent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-[15px] rounded-xl gap-2",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  full?: boolean;
};

function classes({ variant = "emerald", size = "md", full, className }: BaseProps) {
  return cx(
    "inline-flex items-center justify-center font-medium transition-colors duration-150 whitespace-nowrap",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
    className,
  );
}

export function Button({
  type = "button",
  ...props
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { variant, size, full, className, children, ...rest } = props;
  return (
    <button type={type} className={classes({ variant, size, full, className, children })} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  ...props
}: BaseProps & { href: string; target?: string; rel?: string }) {
  const { variant, size, full, className, children, ...rest } = props;
  return (
    <Link href={href} className={classes({ variant, size, full, className, children })} {...rest}>
      {children}
    </Link>
  );
}
