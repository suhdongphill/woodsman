/**
 * 인증 도메인의 DB 접근 — D1 직접 질의.
 *
 * 화면·서버액션은 여기만 통해 사용자 테이블에 닿는다.
 * SQL을 한곳에 모아 두면 컬럼이 바뀔 때 고칠 자리가 하나다.
 *
 * 컬럼명은 `prisma/schema.prisma`의 User 모델을 따른다(스키마 원본은 여전히 Prisma).
 */
import { execute, queryOne } from "@/lib/d1";
import type { AttemptRecord } from "@/lib/login-throttle";

export type AuthUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  /** ADMIN | USER */
  role: string;
  /** 소셜 전용 계정은 null */
  passwordHash: string | null;
};

export async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow>(
    `SELECT id, email, name, image, role, passwordHash FROM User WHERE email = ?`,
    [email],
  );
}

/**
 * 가입. **role은 인자로 받지 않는다** — 항상 USER로 고정한다.
 * 권한 승격 경로를 아예 만들지 않기 위해서다(ADMIN은 시드로만 생성).
 */
export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO User (id, email, name, role, passwordHash, createdAt, updatedAt)
     VALUES (?, ?, ?, 'USER', ?, ?, ?)`,
    [input.id, input.email, input.name, input.passwordHash, now, now],
  );
}

/**
 * 로그인 시도 기록 — 무차별 대입 방어의 저장 계층.
 *
 * 판정은 `src/lib/login-throttle.ts`(순수 함수 + 테스트)가 한다. 여기서는 읽고 쓰기만 한다.
 *
 * ⚠ **계정이 없는 이메일도 기록한다.** 없는 계정으로 두드리는 것을 세지 않으면
 *    "먼저 존재하는 계정을 찾고 나서 두드린다"는 흔한 순서를 그대로 통과시킨다.
 * ⚠ 이 표에 행이 있다는 것이 **계정이 있다는 뜻이 아니다.** 진단 화면을 만들 때
 *    이걸 계정 목록처럼 쓰지 않는다.
 */
export async function findLoginAttempt(email: string): Promise<AttemptRecord> {
  const row = await queryOne<{ failures: number; lastFailedAt: string | null }>(
    `SELECT failures, lastFailedAt FROM LoginAttempt WHERE email = ?`,
    [email],
  );
  if (!row) return { failures: 0, lastFailedAt: null };
  return { failures: Number(row.failures) || 0, lastFailedAt: row.lastFailedAt };
}

export async function saveLoginAttempt(email: string, record: AttemptRecord): Promise<void> {
  await execute(
    `INSERT INTO LoginAttempt (email, failures, lastFailedAt) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET failures = excluded.failures, lastFailedAt = excluded.lastFailedAt`,
    [email, record.failures, record.lastFailedAt],
  );
}

/** 로그인에 성공하면 기록을 지운다 — 실패 기록을 오래 쌓아 둘 이유가 없다. */
export async function clearLoginAttempt(email: string): Promise<void> {
  await execute(`DELETE FROM LoginAttempt WHERE email = ?`, [email]);
}
