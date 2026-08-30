"use client";

/**
 * 발행 · 발행 취소.
 *
 * ⚠ 버튼이 비활성이어도 그것을 보호로 삼지 않는다. 발행 액션이 **서버에서 다시 규율을
 *    검증**한다(화면을 우회한 요청도 막아야 한다). 여기 `disabled`는 안내일 뿐이다.
 */
import { useActionState } from "react";
import { publishReportAction, unpublishReportAction } from "../actions";
import { emptyReportFormState } from "../form-state";
import type { ReportStatus } from "@/lib/report/types";

export function PublishBar({
  ticker,
  status,
  blockerCount,
}: {
  ticker: string;
  status: ReportStatus;
  blockerCount: number;
}) {
  const [state, formAction, pending] = useActionState(publishReportAction, emptyReportFormState);
  const blocked = blockerCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "PUBLISHED" ? (
        <>
          <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">
            발행됨
          </span>
          <form action={unpublishReportAction}>
            <input type="hidden" name="ticker" value={ticker} />
            <button
              type="submit"
              className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-red-500/40 hover:text-ink"
            >
              발행 취소 (초안으로)
            </button>
          </form>
        </>
      ) : (
        <>
          <span className="rounded-lg bg-cardHover px-2 py-1 text-[11px] text-gray-400">초안</span>
          <form action={formAction}>
            <input type="hidden" name="ticker" value={ticker} />
            <button
              type="submit"
              disabled={pending || blocked}
              title={blocked ? `규율 ${blockerCount}건이 남아 발행할 수 없습니다` : undefined}
              className="rounded-xl bg-gold-600/90 px-4 py-2 text-[12.5px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-40"
            >
              {pending ? "발행 중…" : blocked ? `발행 불가 (규율 ${blockerCount}건)` : "발행"}
            </button>
          </form>
        </>
      )}

      {state.error && (
        <span role="alert" className="text-[12px] text-red-400">
          {state.error}
        </span>
      )}
      {state.notice && !state.error && (
        <span className="text-[12px] text-emerald-400">{state.notice}</span>
      )}
    </div>
  );
}
