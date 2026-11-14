"use client";

import { useActionState } from "react";
import { importResearchAction } from "../actions";
import { emptyResearchImportState } from "../form-state";

const REASON: Record<string, string> = {
  "same-url": "URL이 같다",
  "same-doi": "DOI가 같다",
  "same-title": "제목이 같다",
  "duplicate-id-in-file": "파일 안에 같은 id가 두 번",
};

/**
 * Research Lab JSON 가져오기. ⚠ 같은 파일을 다시 올려도 중복이 생기지 않는다 — 결과(새로·고침·그대로·확인 필요)를 그대로 보인다.
 * 「확인 필요」는 넣지 않은 것이다 — 중복인지 개정판인지 사람이 정한다.
 */
export function ResearchImportForm() {
  const [state, formAction, pending] = useActionState(importResearchAction, emptyResearchImportState);
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted">Research Lab에서 내보낸 JSON (schema_version 1)</span>
        <input
          type="file"
          name="file"
          accept=".json,application/json"
          required
          className="block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-onAccent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent disabled:opacity-50"
      >
        {pending ? "가져오는 중…" : "가져오기"}
      </button>

      {state.error && <p className="text-[12.5px] text-red-400">{state.error}</p>}
      {state.errors && (
        <ul className="list-disc pl-5 text-[12px] text-red-400">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {state.done && (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-[12.5px] text-ink">
          <p>
            새로 {state.done.inserted} · 고침 {state.done.updated} · 그대로 {state.done.unchanged} · 확인 필요{" "}
            {state.done.conflicts.length}
          </p>
          {state.done.conflicts.length > 0 && (
            <ul className="mt-1 text-muted">
              {state.done.conflicts.map((c) => (
                <li key={`${c.id}-${c.reason}`}>
                  {c.id} ↔ {c.withId} · {REASON[c.reason] ?? c.reason} — 넣지 않았습니다(중복인지 개정판인지 정해 주세요)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
