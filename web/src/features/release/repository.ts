/**
 * 릴리스 기록 — D1 질의.
 *
 * ⚠ 판정(무엇을 말할 수 있고 무엇을 못 말하는가)은 여기 없다.
 *    `src/lib/release-effect.ts`(순수 함수 + 테스트)가 한다 — 규칙이 질의에 섞이면
 *    "무엇을 근거로 그렇게 말했나"를 테스트로 지킬 수 없다.
 */
import { execute, queryAll } from "@/lib/d1";

export type SiteRelease = {
  id: string;
  at: string;
  title: string;
  kind: string;
  hypothesis?: string;
  metric: string;
  commitHash?: string;
};

type Row = {
  id: string;
  at: string;
  title: string;
  kind: string;
  hypothesis: string | null;
  metric: string;
  commitHash: string | null;
};

function toRelease(row: Row): SiteRelease {
  return {
    id: row.id,
    at: row.at,
    title: row.title,
    kind: row.kind,
    hypothesis: row.hypothesis ?? undefined,
    metric: row.metric,
    commitHash: row.commitHash ?? undefined,
  };
}

export async function loadReleases(limit = 50): Promise<SiteRelease[]> {
  const rows = await queryAll<Row>(
    `SELECT id, at, title, kind, hypothesis, metric, commitHash FROM SiteRelease
      ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toRelease);
}

export async function createRelease(input: {
  at: string;
  title: string;
  kind: string;
  hypothesis?: string;
  metric: string;
  commitHash?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO SiteRelease (id, at, title, kind, hypothesis, metric, commitHash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `rel_${now}_${Math.floor(performance.now())}`,
      input.at,
      input.title,
      input.kind,
      input.hypothesis ?? null,
      input.metric,
      input.commitHash ?? null,
    ],
  );
}

export async function deleteRelease(id: string): Promise<void> {
  await execute(`DELETE FROM SiteRelease WHERE id = ?`, [id]);
}
