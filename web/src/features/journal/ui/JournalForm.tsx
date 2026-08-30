"use client";

/**
 * 투자일지 작성·수정 폼.
 *
 * 목록에서 "수정"을 누르면 그 항목을 채워 넣고, 아니면 새 글이다.
 * 한 화면에서 쓰고 바로 목록을 확인할 수 있게 접이식(details)으로 둔다 —
 * 매매할 때마다 여는 화면이라 단계가 늘어나면 안 쓰게 된다.
 */
import { useActionState } from "react";
import { saveJournalAction } from "../actions";
import { emptyJournalFormState } from "../form-state";
import type { JournalEntry } from "@/lib/types";

const ACTIONS = [
  { value: "BUY", label: "매수" },
  { value: "SELL", label: "매도" },
  { value: "REBALANCE", label: "리밸런싱" },
  { value: "NOTE", label: "관찰" },
] as const;

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function JournalForm({ entry, today }: { entry?: JournalEntry; today: string }) {
  const [state, formAction, pending] = useActionState(saveJournalAction, emptyJournalFormState);

  return (
    <form action={formAction} className="space-y-3">
      {entry && <input type="hidden" name="id" value={entry.id} />}

      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className={label}>날짜</span>
          <input type="date" name="date" defaultValue={entry?.date ?? today} className={field} />
        </label>
        <label>
          <span className={label}>구분</span>
          <select name="action" defaultValue={entry?.action ?? "BUY"} className={field}>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>제목</span>
          <input
            name="title"
            defaultValue={entry?.title}
            placeholder="무엇을 했는지 한 줄로"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>내용 — 왜 그렇게 했나</span>
        <textarea
          name="body"
          rows={4}
          defaultValue={entry?.body}
          placeholder="판단의 근거와, 무엇이 틀릴 수 있는지까지 적어 두면 나중에 그때의 판단을 재현할 수 있습니다."
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-6">
        <label>
          <span className={label}>종목명</span>
          <input name="name" defaultValue={entry?.name} className={field} />
        </label>
        <label>
          <span className={label}>티커</span>
          <input name="ticker" defaultValue={entry?.ticker} className={field} />
        </label>
        <label>
          <span className={label}>수량</span>
          <input name="shares" type="number" step="any" defaultValue={entry?.shares} className={field} />
        </label>
        <label>
          <span className={label}>단가</span>
          <input name="price" type="number" step="any" defaultValue={entry?.price} className={field} />
        </label>
        <label>
          <span className={label}>통화</span>
          <select name="currency" defaultValue={entry?.currency ?? "KRW"} className={field}>
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          <span className={label}>연결 글 slug</span>
          <input name="postSlug" defaultValue={entry?.postSlug} className={field} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-[12.5px] text-gray-300">
          <input
            type="checkbox"
            name="published"
            defaultChecked={entry?.published ?? true}
            className="h-4 w-4 accent-emerald-500"
          />
          공개 화면에 노출
        </label>

        <div className="flex items-center gap-3">
          {state.error && (
            <span role="alert" className="text-[12px] text-red-400">
              {state.error}
            </span>
          )}
          {state.savedAt && !state.error && (
            <span className="text-[12px] text-emerald-400">저장했습니다</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "저장 중…" : entry ? "수정 저장" : "일지 추가"}
          </button>
        </div>
      </div>
    </form>
  );
}
