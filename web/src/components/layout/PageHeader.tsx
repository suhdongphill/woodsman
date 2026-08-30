import type { ReactNode } from "react";

/** 공개 페이지 상단 타이틀 영역 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-[11px] tracking-[0.18em] text-gold-500 mb-2">{eyebrow}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">{title}</h1>
            {description && (
              <p className="mt-2.5 text-sm text-muted max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}
