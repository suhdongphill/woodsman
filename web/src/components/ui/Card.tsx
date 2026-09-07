import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({
  children,
  className,
  hover = false,
  padding = "p-5",
  id,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
  /**
   * 앵커. ⚠ **글이 지표를 문장 단위로 가리킬 수 있게 하는 자리**다 —
   * `/macro/rates#dgs30`처럼 링크하면 독자가 스크롤로 카드를 찾지 않아도 된다.
   * 앵커로 도착하면 `scroll-mt`가 헤더에 가리는 것을 막고, `target:`이 잠깐 강조한다.
   */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cx(
        "bg-card border border-border rounded-2xl",
        hover && "card-hover hover:bg-cardHover hover:border-gold-600/40",
        // ⚠ 앵커가 있을 때만 붙인다 — 없는 카드에 스크롤 여백을 주면 간격이 어긋난다.
        id && "scroll-mt-24 target:border-gold-500 target:ring-2 target:ring-gold-500/30",
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
