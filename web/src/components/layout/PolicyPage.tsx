import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * 정책·안내 문서 공용 껍데기.
 * 광고·검색 심사에서 이런 문서는 "언제 기준인지"가 함께 보여야 신뢰를 얻는다.
 */
export function PolicyPage({
  eyebrow,
  title,
  description,
  effectiveDate,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** 시행일 — 문서를 고칠 때 같이 올린다 */
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <p className="text-[11px] text-gray-600">시행일 · {effectiveDate}</p>
        <div className="policy-body mt-6 space-y-8">{children}</div>
      </div>
    </>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-gray-300">{children}</div>
    </section>
  );
}

export function PolicyList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
