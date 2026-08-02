import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return <div className="px-4 sm:px-6 lg:px-8 py-7 max-w-6xl">{children}</div>;
}
