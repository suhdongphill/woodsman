"use client";

/**
 * 「전체 시세 가져오기」 카드 (`/admin/stocks`).
 *
 * ## ⚠ 여기서 지키는 것
 * - **마지막 수집 시각을 항상 보여준다.** 수집이 멈춰도 화면은 옛 종가를 그대로 보여주므로,
 *   언제 받았는지를 안 적으면 멈춘 줄도 모른다(CLAUDE.md 3장).
 * - **받기만 하고 보고서에 얼리지 않는다.** 반영은 각 보고서의 「사이트 자료 주입」이 한다 —
 *   그래야 "언제 기준의 숫자인가"가 사람의 결정으로 남는다.
 */
import { useActionState } from "react";
import { fetchAllQuotesAction } from "../actions";
import { emptyQuoteFormState } from "../form-state";

export function FetchQuotesCard({
  /** 마지막 수집 시각(ISO). 없으면 한 번도 받지 않았다는 뜻이다 */
  lastIngestAt,
  /** 시세가 하루 이상 묵었나 — 서버가 판단한 값을 받는다(같은 판단을 두 번 하지 않는다) */
  staleNote,
}: {
  lastIngestAt?: string;
  staleNote?: string;
}) {
  const [state, action, pending] = useActionState(fetchAllQuotesAction, emptyQuoteFormState);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-gray-500">
          {lastIngestAt ? (
            <>
              마지막 수집{" "}
              <span className="tabular-nums text-gray-400">
                {lastIngestAt.slice(0, 16).replace("T", " ")}
              </span>
              {staleNote && <span className="ml-2 text-amber-400">⚠ {staleNote}</span>}
            </>
          ) : (
            // ⚠ "없음"과 "못 읽음"을 같은 화면으로 만들지 않는다.
            <span className="text-amber-400">⚠ 아직 한 번도 시세를 받지 않았습니다.</span>
          )}
        </p>

        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl border border-gold-600/40 px-3 py-2 text-[12.5px] text-gold-300 transition-colors hover:bg-gold-600/10 disabled:opacity-40"
          >
            {pending ? "받는 중…" : "전체 시세 가져오기"}
          </button>
        </form>
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {state.error}
        </p>
      )}
      {state.notice && !state.error && (
        <p className="text-[12px] text-emerald-400">{state.notice}</p>
      )}

      <p className="text-[11.5px] text-gray-600">
        Yahoo Finance 일봉 종가입니다. ⚠ 받기만 하고 보고서에는 반영되지 않습니다 — 각 보고서에서
        「사이트 자료 주입」을 눌러야 그 시점 값으로 얼립니다.
      </p>
    </div>
  );
}
