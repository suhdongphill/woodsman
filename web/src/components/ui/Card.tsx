import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({
  children,
  className,
  hover = false,
  padding = "p-5",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
}) {
  return (
    <div
      className={cx(
        "bg-card border border-border rounded-2xl",
        hover && "card-hover hover:bg-cardHover hover:border-gold-600/40",
        padding,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-3 mb-4", className)}>
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {action}
    </div>
  );
}

/** 섹션 헤더 (제목 + 부제 + 우측 링크) */
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-card border border-dashed border-border rounded-2xl">
      {icon && <div className="text-gray-600 mb-3">{icon}</div>}
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && <p className="text-xs text-muted mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
