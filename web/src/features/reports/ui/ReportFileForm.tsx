"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveReportFileAction } from "../file-actions";
import { emptyReportFileFormState } from "../file-form-state";

const label = "mb-1 block text-[11px] text-muted";
const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink";

/**
 * 종목에 보고서 HTML이나 블로그 글을 잇는다. 결과는 **초안**이다 — 미리보기를 보고 공개한다.
 * 같은 티커로 다시 저장하면 고쳐진다. 파일을 비우면 있던 HTML을 그대로 둔다.
 */
export function ReportFileForm() {
  const [state, formAction, pending] = useActionState(saveReportFileAction, emptyReportFileFormState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={label}>보고서 HTML (선택) — 파일 이름이 2026-09-25_000660_종목명.html 꼴이면 티커·종목명을 읽습니다</span>
        <input
          type="file"
          name="file"
          accept=".html,.htm,text/html"
          className="block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-onAccent"
        />
      </label>
      <label className="block">
        <span className={label}>블로그 글 주소 (선택)</span>
        <input name="blogUrl" type="url" placeholder="https://suhdp.tistory.com/…" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={label}>티커 (비우면 파일 이름에서)</span>
          <input name="ticker" placeholder="000660" className={field} />
        </label>
        <label>
          <span className={label}>종목명 (비우면 파일 이름에서)</span>
          <input name="name" className={field} />
        </label>
        <label>
          <span className={label}>제목 (비우면 본문에서)</span>
          <input name="headline" className={field} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent disabled:opacity-50"
        >
          {pending ? "저장하는 중…" : "초안으로 저장"}
        </button>
        {state.error && <p className="text-[12.5px] text-red-400">{state.error}</p>}
        {state.savedTicker && (
          <p className="text-[12.5px] text-ink">
            저장했습니다 ·{" "}
            <Link href={`/admin/stocks/files/${state.savedTicker}`} className="text-gold-500 underline">
              미리보기에서 공개하기
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
