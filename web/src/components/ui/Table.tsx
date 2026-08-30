import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className={cx("w-full text-left", className)}>{children}</table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cx(
        "px-4 py-3 text-[11px] font-medium text-muted whitespace-nowrap bg-surface-2 border-b border-border",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cx("px-4 py-3.5 text-[13px] text-gray-300 align-middle", className)}>
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-cardHover transition-colors">
      {children}
    </tr>
  );
}
