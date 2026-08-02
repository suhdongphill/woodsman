/**
 * 인증 도메인의 DB 접근 — D1 직접 질의.
 *
 * 화면·서버액션은 여기만 통해 사용자 테이블에 닿는다.
 * SQL을 한곳에 모아 두면 컬럼이 바뀔 때 고칠 자리가 하나다.
 *
 * 컬럼명은 `prisma/schema.prisma`의 User 모델을 따른다(스키마 원본은 여전히 Prisma).
 */
import { execute, queryOne } from "@/lib/d1";

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
