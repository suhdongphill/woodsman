"use client";

/**
 * 댓글 작성 폼.
 *
 * ⚠ 전에는 `<span>등록</span>`이었다 — 커서만 손가락으로 바뀌고 눌러도 아무 일이 없었다.
 *   이제 서버 액션으로 실제 저장한다. 승인제가 켜져 있으면 **바로 안 보이는 이유를 말한다.**
 *   말 없이 사라지면 쓴 사람은 "안 올라갔다"고 읽는다.
 */
import { useActionState } from "react";
import { submitCommentAction } from "../actions";
import { emptyCommentFormState } from "../form-state";
import { Card } from "@/components/ui/Card";
import { COMMENT_MAX_LENGTH } from "@/lib/comments";

export function CommentForm({
  postId,
  moderationOn,
}: {
  postId: string;
  moderationOn: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitCommentAction, emptyCommentFormState);

  return (
    <Card className="mb-6">
      <form action={formAction}>
        <input type="hidden" name="postId" value={postId} />
        <textarea
          name="body"
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          required
          placeholder="근거와 함께 의견을 남겨주세요."
          className="w-full resize-none rounded-xl border border-border bg-[#12141c] px-3.5 py-3 text-sm text-white placeholder-gray-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-600">
            {state.error ? (
              <span role="alert" className="text-red-400">
                {state.error}
              </span>
            ) : state.notice ? (
              <span className="text-emerald-400">{state.notice}</span>
            ) : moderationOn ? (
              "승인제가 켜져 있어 관리자 승인 후 노출됩니다."
            ) : (
              "작성 즉시 노출됩니다."
            )}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emeraldDark disabled:opacity-50"
          >
            {pending ? "등록 중…" : "등록"}
          </button>
        </div>
      </form>
    </Card>
  );
}
