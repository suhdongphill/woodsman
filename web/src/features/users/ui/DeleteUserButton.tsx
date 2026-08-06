"use client";

/**
 * 사용자 삭제 버튼 — **두 번 눌러야** 지워진다.
 *
 * 되돌릴 수 없는 동작이라 한 번의 오클릭으로 실행되면 안 된다. 브라우저 `confirm()`을 쓰지 않는
 * 이유는 그 창을 우리가 못 꾸미고 문구를 못 고치기 때문이다 —
 * 대신 **무엇이 함께 사라지는지**를 그 자리에서 보여주고 확인을 받는다.
 */
import { useActionState, useState } from "react";
import { deleteUserAction } from "../actions";
import { emptyUserFormState } from "../form-state";
import { TrashIcon } from "@/components/icons";

export function DeleteUserButton({
  id,
  email,
  sideEffects,
  disabledReason,
}: {
  id: string;
  email: string;
  sideEffects: string;
  /** 지울 수 없는 계정이면 그 이유 */
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(deleteUserAction, emptyUserFormState);
  const [armed, setArmed] = useState(false);

  if (disabledReason) {
    return (
      <span className="text-[11px] text-gray-600" title={disabledReason}>
        삭제 불가
      </span>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={`${email} 삭제`}
        className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover hover:text-red-400"
      >
        <TrashIcon size={14} />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <p className="max-w-[260px] text-[11px] leading-relaxed text-yellow-300">{sideEffects}</p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-lg border border-border px-2 py-1 text-[11px] text-gray-400 hover:text-white"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-500/90 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "삭제 중…" : "정말 삭제"}
        </button>
      </div>
      {state.error && (
        <span role="alert" className="max-w-[260px] text-[11px] text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
