"use client";

/**
 * 인용 문구 복사 버튼(2026-11-15) — 글·브리핑에 옮길 때 관측일이 붙은 문장을 그대로 가져가게.
 * ⚠ 복사가 안 되면(권한·구형 브라우저) 조용히 넘기지 않는다 — 문장을 펼쳐 직접 고를 수 있게 보여 준다.
 */
import { useState } from "react";

export function CopyCitation({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch (error) {
      console.error("[citation] 클립보드에 쓰지 못했다", error);
      setState("failed");
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={copy}
        title={text}
        className="text-left text-[10.5px] text-gold-500 underline-offset-2 hover:underline"
      >
        {state === "copied" ? "복사했습니다 ✓" : "인용 문구 복사(관측일 포함)"}
      </button>
      {state === "failed" && (
        <span className="mt-1 select-all rounded border border-border px-1.5 py-1 text-[10.5px] text-ink-3">
          복사하지 못했습니다. 아래 문장을 길게 눌러 직접 복사하세요: {text}
        </span>
      )}
    </span>
  );
}
