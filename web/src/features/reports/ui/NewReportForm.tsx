"use client";

import { useActionState } from "react";
import { createReportAction } from "../actions";
import { emptyReportFormState } from "../form-state";

const field =
  "w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

/**
 * 새 보고서 초안 만들기.
 * ⚠ 티커는 문자열이다 — 국내 종목은 `005930`처럼 앞의 0까지 그대로 넣는다.
 */
export function NewReportForm() {
  const [state, formAction, pending] = useActionState(createReportAction, emptyReportFormState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr_120px]">
        <label>
          <span className={label}>티커</span>
          <input name="ticker" className={field} placeholder="TSM · 005930" />
        </label>
        <label>
          <span className={label}>종목명</span>
          <input name="name" className={field} placeholder="TSMC" />
        </label>
        <label>
          <span className={label}>시장</span>
          <select name="market" className={field} defaultValue="US">
            <option value="US">미국</option>
            <option value="KR">한국</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className={label}>한 줄 논지 (나중에 고칠 수 있습니다)</span>
        <input name="headline" className={field} />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-600">
          ⚠ 국내 종목은 <strong>6자리 그대로</strong> 넣습니다. 삼성전자는 5930이 아니라 005930입니다.
        </p>
        <div className="flex items-center gap-3">
          {state.error && (
            <span role="alert" className="text-[12px] text-red-400">
              {state.error}
            </span>
          )}
          {state.notice && !state.error && (
            <span className="text-[12px] text-emerald-400">{state.notice}</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "만드는 중…" : "초안 만들기"}
          </button>
        </div>
      </div>
    </form>
  );
}
