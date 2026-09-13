"use client";

/**
 * 파도 기사 입력 — 유가 · 지정학 · 금리 · 환율.
 * ⚠ 본문을 붙여넣는 칸이 없다. 요약은 **우리가 쓰는 한 줄**(최대 200자)이다.
 */
import { useActionState } from "react";
import { saveManualNewsAction } from "../actions";
import { MANUAL_NEWS_CATEGORIES, NEWS_SUMMARY_MAX, emptyNewsFormState } from "../form-state";

const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink";

export function NewsForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveManualNewsAction, emptyNewsFormState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="text-[12px] text-muted">
        분류
        <select name="category" className={`mt-1 ${field}`} defaultValue="유가">
          {MANUAL_NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[12px] text-muted">
        기사 날짜
        <input type="date" name="publishedAt" defaultValue={today} className={`mt-1 ${field}`} />
      </label>
      <label className="text-[12px] text-muted sm:col-span-2">
        제목(원문 그대로 또는 우리말 한 줄)
        <input name="title" required className={`mt-1 ${field}`} placeholder="예: 사우디, East–West 송유관 예방 폐쇄" />
      </label>
      <label className="text-[12px] text-muted sm:col-span-2">
        원문 링크(https)
        <input name="url" type="url" required className={`mt-1 ${field}`} placeholder="https://" />
      </label>
      <label className="text-[12px] text-muted">
        발언자(선택)
        <input name="speaker" className={`mt-1 ${field}`} placeholder="예: 파월" />
      </label>
      <label className="text-[12px] text-muted sm:col-span-2">
        한 줄 요약(선택 · 최대 {NEWS_SUMMARY_MAX}자 · 본문을 옮기지 않습니다)
        <textarea name="summary" maxLength={NEWS_SUMMARY_MAX} rows={2} className={`mt-1 ${field}`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "기사 올리기"}
        </button>
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
        {!pending && state.savedAt && <span className="text-[12px] text-emerald-400">올렸습니다 — 홈 「파도」에 보입니다.</span>}
      </div>
    </form>
  );
}
