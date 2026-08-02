"use client";

/**
 * 키 등록 폼 — 입력하면 프로그램이 `.env`에 써 준다.
 *
 * ⚠ **로컬 개발 서버에서만 보인다.** 배포본(Workers)에는 파일 시스템이 없어
 * `.env`라는 파일 자체가 존재할 수 없다. 화면(page.tsx)이 그 판단을 하고,
 * 서버 액션도 한 번 더 막는다.
 *
 * ⚠ 저장된 키를 **다시 보여주지 않는다.** 입력칸은 저장 후 비운다.
 */
import { useActionState, useEffect, useRef } from "react";
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import { saveAiKeyAction } from "../actions";
import { emptyKeyFormState } from "../key-form-state";

export function KeyRegisterForm({ connected }: { connected: string[] }) {
  const [state, formAction, pending] = useActionState(saveAiKeyAction, emptyKeyFormState);
  const inputRef = useRef<HTMLInputElement>(null);

  // 저장에 성공하면 입력칸을 비운다 — 화면에 키가 남아 있지 않게.
  useEffect(() => {
    if (state.savedName && inputRef.current) inputRef.current.value = "";
  }, [state.savedName]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[190px]">
          <span className="block text-[11px] text-muted mb-1">제공자</span>
          <select
            name="apiKeyEnv"
            defaultValue={AI_PROVIDERS[0].apiKeyEnv}
            className="w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-ink"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.apiKeyEnv}>
                {p.label} {p.free ? "(무료)" : "(유료)"}
                {connected.includes(p.apiKeyEnv) ? " · 설정됨" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-[2] min-w-[240px]">
          <span className="block text-[11px] text-muted mb-1">API 키</span>
          <input
            ref={inputRef}
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="발급받은 키를 붙여넣으세요"
            className="w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-white font-mono"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-xl bg-gold-600/90 hover:bg-gold-600 text-[13px] font-medium text-black disabled:opacity-50 transition-colors"
        >
          {pending ? "저장 중…" : ".env에 저장"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {state.error}
        </p>
      )}
      {state.savedName && (
        <p className="text-[12px] text-emerald-400">
          <code>{state.savedName}</code> 를 `.env`에 기록했습니다. 개발 서버를 다시 시작하면
          &ldquo;연결됨&rdquo;으로 바뀝니다. 배포본에도 반영하려면{" "}
          <code className="text-gray-300">npm run ai:sync</code> 를 실행하세요.
        </p>
      )}
    </form>
  );
}
