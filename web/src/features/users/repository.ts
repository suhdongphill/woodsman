/**
 * 사용자 조회·삭제의 DB 접근.
 *
 * ⚠ 삭제는 되돌릴 수 없다. **누가 지워도 되는지 판단은 `actions.ts`가** 하고, 여기서는
 *    묻지 않고 실행한다 — 판단을 두 곳에 두면 한쪽만 고쳐진다.
 */
import { execute, queryAll, queryOne } from "@/lib/d1";
import { normalizeRole } from "@/lib/access";
import type { DeleteTarget } from "@/lib/user-delete";
import type { UserRow } from "@/lib/types";

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  commentCount: number;
};

/** 가입자 목록. 댓글 수를 함께 센다(지우기 전에 무엇이 사라지는지 보여주려고). */
export async function loadUsers(limit = 200): Promise<UserRow[]> {
  const rows = await queryAll<Row>(
    `SELECT u.id, u.email, u.name, u.role, u.createdAt,
            (SELECT COUNT(*) FROM Comment c WHERE c.userId = u.id) AS commentCount
       FROM User u
      ORDER BY u.createdAt DESC
      LIMIT ?`,
    [limit],
  );

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? undefined,
    // ⚠ DB 값을 그대로 믿지 않는다 — 좁히는 일은 access.normalizeRole이 한다.
    role: normalizeRole(r.role),
    createdAt: r.createdAt,
    commentCount: r.commentCount,
  }));
}

/**
 * 삭제 판단에 필요한 것만. ⚠ 화면용 타입(`UserRow`)을 재사용하면 쓰지도 않는 칸
 *    (댓글 수)을 0으로 지어내게 된다 — 없는 값을 만들지 않는다.
 */
export async function findDeleteTarget(id: string): Promise<DeleteTarget | null> {
  const row = await queryOne<{ id: string; email: string; role: string }>(
    `SELECT id, email, role FROM User WHERE id = ?`,
    [id],
  );
  return row ? { id: row.id, email: row.email, role: normalizeRole(row.role) } : null;
}

/** 관리자를 뺀 회원 수. ⚠ 세려고 목록을 통째로 읽지 않는다. */
export async function countMembers(): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM User WHERE role <> 'ADMIN'`,
  );
  return row?.n ?? 0;
}

/** 남아 있는 관리자 수. 마지막 관리자를 지우지 못하게 막는 근거. */
export async function countAdmins(): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM User WHERE role = 'ADMIN'`,
  );
  return row?.n ?? 0;
}

/**
 * 사용자 삭제.
 *
 * 스키마의 연쇄 규칙대로 따라 지워진다: 로그인 수단(Account·Session)과 개인 포트폴리오는
 * 함께 삭제되고, **댓글은 남되 작성자 연결만 끊어진다**(`onDelete: SetNull`).
 * 남긴 글이 갑자기 사라지면 대화의 맥락이 무너지기 때문이다.
 */
export async function deleteUser(id: string): Promise<void> {
  await execute(`DELETE FROM User WHERE id = ?`, [id]);
}
