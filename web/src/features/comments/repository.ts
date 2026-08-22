/**
 * 댓글의 DB 접근.
 *
 * ## 왜 이걸 만들었나
 * `/admin/comments`가 `lib/mock.ts`를 읽고 있어서 **승인·숨김·삭제 버튼이
 * 아무 데도 연결돼 있지 않았다.** 대표 포트폴리오·콘텐츠·홈 편집·사용자에서
 * 이미 다섯 번 겪은 것과 같은 사고다(2026-08-06). 처방도 같다 — D1을 읽는다.
 *
 * ⚠ 탭 → SQL 조건은 여기에만 둔다. 화면은 탭 이름만 알고 SQL을 모른다.
 * ⚠ 목록에 글 제목을 같이 낸다. 어떤 글에 달린 댓글인지 모르면 판단할 수 없다.
 */
import { execute, queryAll, queryOne, toBool } from "@/lib/d1";
import type { CommentTab } from "@/lib/comments";
import type { Comment, CommentStatus } from "@/lib/types";

type CommentRow = {
  id: string;
  postId: string;
  postTitle: string | null;
  postSlug: string | null;
  userId: string | null;
  authorName: string | null;
  body: string;
  status: string;
  reported: number;
  createdAt: string;
};

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.postId,
    postTitle: row.postTitle ?? undefined,
    postSlug: row.postSlug ?? undefined,
    userId: row.userId ?? undefined,
    authorName: row.authorName ?? undefined,
    body: row.body,
    status: row.status as CommentStatus,
    reported: toBool(row.reported),
    createdAt: row.createdAt,
  };
}

/** 글 제목까지 함께 읽는다. 글이 지워진 댓글은 CASCADE로 같이 사라지므로 LEFT JOIN이면 충분하다. */
const ADMIN_SELECT = `
  SELECT c.id, c.postId, p.title AS postTitle, p.slug AS postSlug, c.userId,
         c.authorName, c.body, c.status, c.reported, c.createdAt
    FROM Comment c
    LEFT JOIN Post p ON p.id = c.postId`;

/** 탭이 곧 조건이다. 모르는 탭은 `resolveCommentTab`이 이미 걸러 온다. */
function tabCondition(tab: CommentTab): string {
  switch (tab) {
    case "pending":
      return `WHERE c.status = 'PENDING'`;
    case "reported":
      return `WHERE c.reported = 1`;
    case "hidden":
      return `WHERE c.status = 'HIDDEN'`;
    default:
      return "";
  }
}

/** 관리자 목록 — 최신순. */
export async function loadCommentsForAdmin(tab: CommentTab, limit = 200): Promise<Comment[]> {
  const rows = await queryAll<CommentRow>(
    `${ADMIN_SELECT} ${tabCondition(tab)} ORDER BY c.createdAt DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toComment);
}

export type CommentCounts = Record<CommentTab, number>;

/**
 * 탭 옆 숫자. 목록을 통째로 읽어 세지 않는다 —
 * 개수를 세려고 전체를 읽던 것이 `/simplify`에서 잡혔던 그 패턴이다.
 */
export async function loadCommentCounts(): Promise<CommentCounts> {
  const row = await queryOne<{
    total: number;
    pending: number;
    reported: number;
    hidden: number;
  }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN reported = 1 THEN 1 ELSE 0 END) AS reported,
            SUM(CASE WHEN status = 'HIDDEN' THEN 1 ELSE 0 END) AS hidden
       FROM Comment`,
  );

  return {
    all: row?.total ?? 0,
    pending: row?.pending ?? 0,
    reported: row?.reported ?? 0,
    hidden: row?.hidden ?? 0,
  };
}

/**
 * 대시보드의 '처리 대기' — 승인대기 **또는** 신고됨.
 * 목록을 통째로 읽어 거르지 않고 DB에서 걸러 온다.
 */
export async function loadCommentsNeedingAttention(limit = 5): Promise<Comment[]> {
  const rows = await queryAll<CommentRow>(
    `${ADMIN_SELECT} WHERE c.status = 'PENDING' OR c.reported = 1
      ORDER BY c.createdAt DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toComment);
}

/** 공개 화면 — 노출 상태만, 오래된 것부터(대화 순서). */
export async function loadVisibleComments(postId: string): Promise<Comment[]> {
  const rows = await queryAll<CommentRow>(
    `${ADMIN_SELECT} WHERE c.postId = ? AND c.status = 'VISIBLE' ORDER BY c.createdAt ASC`,
    [postId],
  );
  return rows.map(toComment);
}

export async function setCommentStatus(
  id: string,
  status: CommentStatus,
  reported: boolean,
): Promise<void> {
  await execute(`UPDATE Comment SET status = ?, reported = ? WHERE id = ?`, [
    status,
    reported ? 1 : 0,
    id,
  ]);
}

export async function deleteComment(id: string): Promise<void> {
  await execute(`DELETE FROM Comment WHERE id = ?`, [id]);
}

/** 방문자가 누른 '신고' — 상태는 건드리지 않고 표시만 세운다(판단은 관리자가 한다). */
export async function reportComment(id: string): Promise<void> {
  await execute(`UPDATE Comment SET reported = 1 WHERE id = ?`, [id]);
}

export type NewComment = {
  postId: string;
  userId?: string;
  authorName?: string;
  body: string;
  status: CommentStatus;
};

export async function createComment(input: NewComment): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO Comment (id, postId, userId, authorName, body, status, reported, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      `cm_${now}_${Math.floor(performance.now())}`,
      input.postId,
      input.userId ?? null,
      input.authorName ?? null,
      input.body,
      input.status,
      now,
    ],
  );
}

/* ─────────────── 속도 제한·중복 방지의 입력 ─────────────── */

/**
 * 판정에 쓸 **최근 댓글**을 최신순으로 읽는다. 판정 자체는 `lib/comment-throttle.ts`가 한다.
 *
 * ⚠ 로그인 사용자는 **본인 댓글 전체**를, 익명은 **그 글의 익명 댓글**을 센다.
 *    익명을 IP로 가르면 정확해지지만 방문자 IP가 DB에 남는다. 그 값을 치르지 않기로 했다
 *    (`lib/comment-throttle.ts` 머리말에 적어 뒀다).
 */
export async function loadRecentCommentsForThrottle(input: {
  userId?: string;
  postId: string;
  since: string;
  limit: number;
}): Promise<{ body: string; createdAt: string }[]> {
  const scope = input.userId
    ? { where: `c.userId = ?`, params: [input.userId] }
    : { where: `c.postId = ? AND c.userId IS NULL`, params: [input.postId] };

  return queryAll<{ body: string; createdAt: string }>(
    `SELECT body, createdAt FROM Comment c
      WHERE ${scope.where} AND c.createdAt >= ?
      ORDER BY c.createdAt DESC LIMIT ?`,
    [...scope.params, input.since, input.limit],
  );
}

/** 이 사람이 이 댓글을 이미 신고했나. */
export async function hasReportedComment(commentId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ one: number }>(
    `SELECT 1 AS one FROM CommentReport WHERE commentId = ? AND userId = ?`,
    [commentId, userId],
  );
  return row !== null;
}

/** 이 사람이 창 안에서 몇 건이나 신고했나. */
export async function countRecentReports(userId: string, since: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM CommentReport WHERE userId = ? AND createdAt >= ?`,
    [userId, since],
  );
  return row?.n ?? 0;
}

/**
 * 신고 한 건을 남긴다.
 * ⚠ 기본키가 (댓글, 사용자)라 두 번째는 DB가 거절한다 — `DO NOTHING`으로 받아 넘긴다.
 *    코드의 중복 검사가 경쟁 상태로 새어도 표는 한 사람당 한 줄을 지킨다.
 */
export async function insertCommentReport(commentId: string, userId: string): Promise<void> {
  await execute(
    `INSERT INTO CommentReport (commentId, userId, createdAt) VALUES (?, ?, ?)
     ON CONFLICT(commentId, userId) DO NOTHING`,
    [commentId, userId, new Date().toISOString()],
  );
}
