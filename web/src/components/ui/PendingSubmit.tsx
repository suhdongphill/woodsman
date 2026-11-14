"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * 오래 걸리는 서버 액션 버튼 — 누르면 잠기고, 도는 표시 · 경과 초 · 지금 하는 일을 보인다(2026-11-14 운영자
 * 「눌릴 때 도는 모습과 진행 상황을 보이게 · 동작하는지 확인이 되지 않음」).
 *
 * ⚠ 진행률(%)을 지어내지 않는다 — 서버가 단계를 알려 주지 않으므로 **경과 시간**과 **보통 걸리는 시간**만 말한다.
 * ⚠ 잠그는 이유: 기다리다 다시 누르면 같은 일이 두 번 돈다(같은 날 해설 만들기가 두 번 눌려 「다시 만들지 않았다」 로그가 남았다).
 */
export function PendingSubmit({
  label,
  pendingLabel = "진행 중",
  hint,
  className = "rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent",
  formAction,
}: {
  label: string;
  pendingLabel?: string;
  /** 기다리는 동안 보일 설명(무엇을 하고 있고 보통 얼마나 걸리는지) */
  hint?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) {
      setSeconds(0);
      return;
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  return (
    <div className="inline-flex flex-col gap-1.5">
      <button
        type="submit"
        formAction={formAction}
        disabled={pending}
        aria-busy={pending}
        className={`${className} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-70`}
      >
        {pending && (
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {pending ? `${pendingLabel}… ${seconds}초` : label}
      </button>
      {pending && hint && (
        <p role="status" aria-live="polite" className="max-w-md text-[11.5px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
