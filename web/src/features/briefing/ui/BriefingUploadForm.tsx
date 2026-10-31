"use client";

import Link from "next/link";
import { useActionState } from "react";
import { uploadBriefingAction } from "../actions";
import { emptyBriefingUploadState } from "../form-state";

const label = "block text-[11px] text-muted mb-1";

/**
 * 원고 올리기. 결과는 **초안**이다 — 미리보기를 보고 공개한다.
 * ⚠ AI가 되돌린 문장(숫자가 달라짐 등)과 AI를 못 쓴 이유를 그대로 보여 준다. 조용히 넘기지 않는다.
 */
export function BriefingUploadForm() {
  const [state, formAction, pending] = useActionState(uploadBriefingAction, emptyBriefingUploadState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={label}>원고 파일 — briefing 폴더의 .md 또는 .html (파일 이름의 날짜를 씁니다)</span>
        <input
          type="file"
          name="file"
          accept=".md,.markdown,.html,.htm,text/markdown,text/html"
          required
          className="block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-onAccent"
        />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label>
          <span className={label}>날짜(비우면 파일 이름에서)</span>
          <input type="date" name="date" className="rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" name="useAi" defaultChecked />
          AI로 기사 문체 다듬기
        </label>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent disabled:opacity-50"
        >
          {pending ? "정리하는 중…" : "올려서 초안 만들기"}
        </button>
      </div>

      {state.error && <p className="text-[12.5px] text-red-400">{state.error}</p>}
      {state.savedDate && (
        <div className="space-y-1 rounded-xl border border-border bg-bg px-4 py-3 text-[12.5px] text-ink">
          <p>
            초안을 저장했습니다 ·{" "}
            {state.editor === "rules" ? "규칙 정리만" : `${state.editor} · 다듬음 ${state.accepted}문장`} ·{" "}
            <Link href={`/admin/briefing/${state.savedDate}`} className="text-gold-500 underline">
              미리보기에서 공개하기
            </Link>
          </p>
          {state.aiSkipped && <p className="text-gold-500">⚠ AI를 쓰지 못했습니다 — {state.aiSkipped}</p>}
          {state.rejected && state.rejected.length > 0 && (
            <p className="text-muted">
              원문으로 되돌린 문장 {state.rejected.length}개:{" "}
              {state.rejected.map((r) => `${r.id}(${r.reason})`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
