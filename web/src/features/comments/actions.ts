"use server";

/**
 * 댓글 서버 액션.
 *
 * 전에는 화면이 목업을 읽어서 **승인·숨김·삭제 버튼이 아무 일도 하지 않았다.**
 * 숨겼다고 믿은 댓글이 계속 노출되는 게 그 버그의 실제 값이었다. 이제 D1에 실제로 쓴다.
 *
 * ⚠ 모든 관리자 액션이 `requireAdmin`을 먼저 부른다. 미들웨어는 1차 방어선일 뿐이다.
 * ⚠ 공개 액션(작성·신고)은 **서버에서 다시 판단한다.** 화면에 폼이 보이지 않는다는 것은
 *    보호가 아니다 — 정책이 닫혀 있으면 요청이 와도 받지 않는다.
 * ⚠ 이 파일은 async 함수만 export한다(상수·타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import {
  createComment,
  deleteComment,
  loadCommentCounts,
  reportComment,
  setCommentStatus,
} from "./repository";
import { emptyCommentFormState, type CommentFormState } from "./form-state";
import {
  canSubmitComment,
  initialCommentStatus,
  isCommentAction,
  parseBannedWords,
  resolveCommentAction,
  validateCommentBody,
} from "@/lib/comments";
import { findPost } from "@/features/posts/repository";
import { getSiteFlags, getSitePolicy } from "@/lib/site-settings";
import { currentUser, requireAdmin } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** 관리자 화면과 대시보드 배지가 같이 갱신돼야 "처리했다"가 눈에 보인다. */
function revalidateAdmin() {
  revalidatePath("/admin/comments");
  revalidatePath("/admin");
}

/** 댓글이 달린 글의 공개 화면 — 승인했는데 사이트에 안 나오면 고친 줄 모른다. */
function revalidatePost(slug: string | undefined) {
  revalidatePath("/insights/[slug]", "page");
  revalidatePath("/board/[id]", "page");
  if (slug) revalidatePath(`/insights/${slug}`);
}

/* ─────────────── 관리자 ─────────────── */

/** 승인 · 숨김 · 삭제. 버튼 세 개가 이 액션 하나로 들어온다. */
export async function moderateCommentAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/comments");

  const id = text(formData, "id");
  const raw = text(formData, "action");
  if (!id || !isCommentAction(raw)) {
    console.error("[comments] 알 수 없는 조작", { id, action: raw });
    return;
  }

  const mutation = resolveCommentAction(raw);
  try {
    if (mutation.kind === "delete") {
      await deleteComment(id);
    } else {
      await setCommentStatus(id, mutation.status, mutation.reported);
    }
  } catch (error) {
    console.error("[comments] 처리 실패", { id, action: raw }, error);
    return;
  }

  revalidateAdmin();
  revalidatePost(text(formData, "postSlug") || undefined);
}

/* ─────────────── 공개 화면 ─────────────── */

export async function submitCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const postId = text(formData, "postId");
  if (!postId) return { error: "글을 찾을 수 없습니다." };

  const [policy, flags, post, user] = await Promise.all([
    getSitePolicy(),
    getSiteFlags(),
    findPost(postId),
    currentUser(),
  ]);

  if (!post) return { error: "글을 찾을 수 없습니다." };

  // 커뮤니티 자체가 닫혀 있으면 댓글도 없다.
  const allowed =
    policy.commentsEnabled &&
    canSubmitComment({
      commentsGloballyEnabled: flags.commentsGloballyEnabled,
      postCommentsEnabled: post.commentsEnabled,
      requireLoginToComment: flags.requireLoginToComment,
      isLoggedIn: !!user,
    });
  if (!allowed) return { error: "지금은 댓글을 받지 않습니다." };

  const validated = validateCommentBody(String(formData.get("body") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const status = initialCommentStatus({
    body: validated.body,
    moderationOn: flags.moderationOn,
    bannedWords: parseBannedWords(flags.bannedWords),
  });

  try {
    await createComment({
      postId,
      userId: user?.id,
      authorName: user?.name ?? "익명",
      body: validated.body,
      status,
    });
  } catch (error) {
    console.error("[comments] 작성 실패", { postId }, error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  revalidateAdmin();
  revalidatePost(post.slug);

  return {
    ...emptyCommentFormState,
    savedAt: new Date().toISOString(),
    // ⚠ 바로 안 보이는 이유를 말해 준다. 말 없이 사라지면 "안 올라갔다"고 읽힌다.
    notice:
      status === "VISIBLE"
        ? "댓글을 남겼습니다."
        : "댓글을 접수했습니다. 확인 후 노출됩니다.",
  };
}

/** 방문자 신고 — 상태는 바꾸지 않는다. 판단은 관리자가 한다. */
export async function reportCommentAction(formData: FormData): Promise<void> {
  const policy = await getSitePolicy();
  if (!policy.commentsEnabled) return;

  const id = text(formData, "id");
  if (!id) return;

  try {
    await reportComment(id);
  } catch (error) {
    console.error("[comments] 신고 실패", { id }, error);
    return;
  }
  revalidateAdmin();
}

/** 대시보드 배지용 — 승인대기·신고 개수. */
export async function getCommentCounts() {
  await requireAdmin("/admin");
  return loadCommentCounts();
}
