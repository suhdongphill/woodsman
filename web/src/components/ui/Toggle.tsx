"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/format";

/** 목업 토글 — Phase 3에서 서버 액션과 연결된다. */
export function Toggle({
  label,
  description,
  defaultOn = false,
  size = "md",
}: {
  label?: string;
  description?: string;
  defaultOn?: boolean;
  size?: "sm" | "md";
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

  if (!label) return button;

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
      {button}
    </div>
  );
}
