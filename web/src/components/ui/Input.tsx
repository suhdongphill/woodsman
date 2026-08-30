import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/format";

/** 폼 입력 공통 스타일 (다크 카드 위 어두운 입력면 + 에메랄드 포커스) */
export const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink " +
  "placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 " +
  "focus:ring-emerald-500/30 transition-colors";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
};

export function TextField({ id, label, hint, className, ...rest }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted mb-1.5">
        {label}
      </label>
      <input id={id} name={rest.name ?? id} className={cx(inputClass, className)} {...rest} />
      {hint && <p className="mt-1.5 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

/** 폼 상단/하단에 공통으로 쓰는 오류 배너 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300"
    >
      {message}
    </p>
  );
}
