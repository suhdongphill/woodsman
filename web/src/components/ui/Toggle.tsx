"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/format";

/**
 * 켜고 끄는 스위치.
 *
 * ⚠ `name`을 주면 **폼과 함께 제출된다.** 주지 않으면 화면에서만 움직이는 스위치다 —
 *   `/admin/comments`의 토글이 오래 그랬고, 켜도 아무 일이 없어 관리자가
 *   "커뮤니티를 열었다"고 잘못 믿었다. 저장이 필요한 자리에는 반드시 `name`을 준다.
 */
export function Toggle({
  label,
  description,
  defaultOn = false,
  size = "md",
  name,
}: {
  label?: string;
  description?: string;
  defaultOn?: boolean;
  size?: "sm" | "md";
  /** 폼으로 제출할 필드명. 켜져 있을 때만 `on`이 실린다. */
  name?: string;
}) {
  const [on, setOn] = useState(defaultOn);
  const id = useId();
  const w = size === "sm" ? "w-9 h-5" : "w-11 h-6";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";

  const button = (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => setOn((v) => !v)}
      className={cx(
        "relative rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50",
        w,
        on ? "bg-emerald-500" : "bg-[#3a3f4d]",
      )}
    >
      <span
        className={cx(
          "absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-white transition-transform",
          on && shift,
        )}
        style={{ width: size === "sm" ? 14 : 18, height: size === "sm" ? 14 : 18 }}
      />
    </button>
  );

  // 꺼진 값은 아예 싣지 않는다 — 체크박스와 같은 규칙이라 서버가 헷갈리지 않는다.
  const control = name ? (
    <>
      {button}
      {on && <input type="hidden" name={name} value="on" />}
    </>
  ) : (
    button
  );

  if (!label) return control;

  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13.5px] text-white cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-[11.5px] text-muted mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <span className="shrink-0">{control}</span>
    </div>
  );
}
