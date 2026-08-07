/**
 * 댓글 정책 — 순수 판단.
 *
 * ## 왜 이 모듈이 필요한가
 * `/admin/comments`의 승인·숨김·삭제 버튼은 **아무 데도 연결돼 있지 않았다.**
 * 목업을 읽는 화면에 `onClick` 없는 버튼이 놓여 있었다 — 누르면 눌린 것처럼 보이지만
 * 아무 일도 일어나지 않는다. 숨겼다고 믿은 댓글이 계속 노출되는 게 이 버그의 실제 값이다.
 *
 * 판단(무엇을 어떤 상태로 바꾸는가, 무엇이 공개되는가)을 여기 모아 테스트로 고정하고,
 * DB 접근은 `features/comments/repository.ts`, 화면은 라우트가 맡는다.
 *
 * ⚠ **작성 가능 여부(`canSubmitComment`)를 두 곳에서 판단하지 않는다.**
 *    화면(작성 폼을 보일지)과 서버 액션(실제로 받을지)이 같은 함수를 쓴다.
 *    같은 판단을 두 번 구현하면 한쪽이 반드시 뒤처진다 — `normalizePath` 사고가 그랬다.
 */
import type { Comment, CommentStatus } from "./types";

/* ─────────────── 관리자 목록의 탭 ─────────────── */

export const COMMENT_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "승인대기" },
  { key: "reported", label: "신고됨" },
  { key: "hidden", label: "숨김" },
] as const;

export type CommentTab = (typeof COMMENT_TABS)[number]["key"];

const TAB_KEYS = COMMENT_TABS.map((t) => t.key) as readonly string[];

/** 쿼리스트링은 무엇이든 올 수 있다. 모르는 값은 '전체'로 떨어뜨린다. */
export function resolveCommentTab(raw: string | null | undefined): CommentTab {
  return TAB_KEYS.includes(raw ?? "") ? (raw as CommentTab) : "all";
}

type Filterable = Pick<Comment, "status" | "reported">;

export function matchesTab(comment: Filterable, tab: CommentTab): boolean {
  switch (tab) {
    case "pending":
      return comment.status === "PENDING";
    case "reported":
      return comment.reported;
    case "hidden":
      return comment.status === "HIDDEN";
    default:
      return true;
  }
}

/** 탭 옆에 붙일 개수. 신고됨은 상태와 무관하므로 합계가 전체를 넘을 수 있다. */
export function countByTab(comments: Filterable[]): Record<CommentTab, number> {
  return {
    all: comments.length,
    pending: comments.filter((c) => matchesTab(c, "pending")).length,
    reported: comments.filter((c) => matchesTab(c, "reported")).length,
    hidden: comments.filter((c) => matchesTab(c, "hidden")).length,
  };
}

/** 관리자가 손봐야 하는 것 — 승인대기 + 신고됨(중복 제거). 대시보드 배지에 쓴다. */
export function needsAttention(comments: (Filterable & { id: string })[]): number {
  return comments.filter((c) => matchesTab(c, "pending") || matchesTab(c, "reported")).length;
}

/* ─────────────── 금지어 ─────────────── */

/**
 * 쉼표로 구분된 입력을 단어 목록으로. 공백·빈 항목·중복을 걷어낸다.
 * 비교는 소문자로 한다 — 대문자로 우회되면 필터가 아니다.
 */
export function parseBannedWords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const word = part.trim().toLowerCase();
    if (word) seen.add(word);
  }
  return [...seen];
}

/** 걸린 단어를 돌려준다(로그에 남기기 위해). 걸리지 않으면 undefined. */
export function findBannedWord(body: string, words: string[]): string | undefined {
  const haystack = body.toLowerCase();
  return words.find((w) => haystack.includes(w));
}

/* ─────────────── 새 댓글의 초기 상태 ─────────────── */

export type CommentPolicy = {
  commentsGloballyEnabled: boolean;
  requireLoginToComment: boolean;
  moderationOn: boolean;
  bannedWords: string;
};

/**
 * 금지어 → 승인제 → 그 외 순으로 판단한다.
 *
 * ⚠ 금지어가 승인제보다 **앞**이다. 승인제가 꺼져 있어도 금지어는 걸러야 한다.
 *   순서를 뒤집으면 승인제를 끈 순간 광고 댓글이 즉시 노출된다.
 */
export function initialCommentStatus(input: {
  body: string;
  moderationOn: boolean;
  bannedWords: string[];
}): CommentStatus {
  if (findBannedWord(input.body, input.bannedWords)) return "HIDDEN";
  return input.moderationOn ? "PENDING" : "VISIBLE";
}

/** 공개 목록에 나가는가. 한 곳에서만 판단한다. */
export function isPubliclyVisible(comment: Pick<Comment, "status">): boolean {
  return comment.status === "VISIBLE";
}

/**
 * 지금 이 사람이 댓글을 쓸 수 있는가.
 * 화면의 작성 폼 노출과 서버 액션의 수락 여부가 **같은 답**을 내야 한다.
 */
export function canSubmitComment(input: {
  commentsGloballyEnabled: boolean;
  postCommentsEnabled: boolean;
  requireLoginToComment: boolean;
  isLoggedIn: boolean;
}): boolean {
  if (!input.commentsGloballyEnabled) return false;
  if (!input.postCommentsEnabled) return false;
  return !input.requireLoginToComment || input.isLoggedIn;
}

/* ─────────────── 관리자 조작 ─────────────── */

export const COMMENT_ACTIONS = ["approve", "hide", "delete"] as const;
export type CommentAction = (typeof COMMENT_ACTIONS)[number];

export function isCommentAction(raw: string): raw is CommentAction {
  return (COMMENT_ACTIONS as readonly string[]).includes(raw);
}

export type CommentMutation =
  | { kind: "delete" }
  | { kind: "status"; status: CommentStatus; reported: boolean };

/**
 * 버튼 하나가 무엇을 바꾸는가.
 *
 * ⚠ 승인·숨김 **둘 다 신고 표시를 내린다.** 처리했는데 신고 표시가 남으면
 *   '신고됨' 탭에서 영원히 사라지지 않아 관리자가 같은 댓글을 계속 다시 본다.
 */
export function resolveCommentAction(action: CommentAction): CommentMutation {
  if (action === "delete") return { kind: "delete" };
  return {
    kind: "status",
    status: action === "approve" ? "VISIBLE" : "HIDDEN",
    reported: false,
  };
}

/** 본문 길이 제한 — 너무 짧으면 의미가 없고, 너무 길면 화면이 무너진다. */
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 2000;

export function validateCommentBody(raw: string): { body: string } | { error: string } {
  const body = raw.trim();
  if (body.length < COMMENT_MIN_LENGTH) return { error: "내용을 입력해주세요." };
  if (body.length > COMMENT_MAX_LENGTH) {
    return { error: `댓글은 ${COMMENT_MAX_LENGTH}자까지 쓸 수 있습니다.` };
  }
  return { body };
}
