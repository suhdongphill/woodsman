/**
 * 관리자 활동 로그 — D1 질의.
 *
 * ⚠ **기록이 하던 일을 막지 않는다.** 로그를 쓰다 실패했다고 글 저장이 실패하면 본말이
 *    뒤집힌다. 그래서 여기서만 예외를 삼킨다 — 다만 **반드시 `console.error`로 남긴다**
 *    (CLAUDE.md §3의 "조용한 실패를 만들지 않는다"는 그대로 지킨다).
 */
import { execute, queryAll, queryOne } from "@/lib/d1";
import type { AdminLogEntry } from "@/lib/admin-log";

type Row = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  summary: string | null;
};

function toEntry(row: Row): AdminLogEntry {
  return {
    id: row.id,
    at: row.at,
    actor: row.actor,
    action: row.action,
    target: row.target ?? undefined,
    summary: row.summary ?? undefined,
  };
}

export async function recordAdminLog(input: {
  actor: string | null;
  action: string;
  target?: string;
  summary?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  try {
    await execute(
      `INSERT INTO AdminLog (id, at, actor, action, target, summary) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `al_${now}_${Math.floor(performance.now())}`,
        now,
        // ⚠ 누가 했는지 모를 때 빈칸으로 두지 않는다. "모른다"고 적는다.
        input.actor ?? "(알 수 없음)",
        input.action,
        input.target ?? null,
        input.summary ?? null,
      ],
    );
  } catch (error) {
    console.error("[admin-log] 기록 실패 — 하던 일은 계속한다", error);
  }
}

/** 최근 것부터. 색인(`AdminLog_at_idx`)이 이 정렬을 받친다. */
export async function loadAdminLogs(limit = 200): Promise<AdminLogEntry[]> {
  const rows = await queryAll<Row>(
    `SELECT id, at, actor, action, target, summary FROM AdminLog ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}

/** ⚠ 목록을 통째로 읽어 세지 않는다. */
export async function countAdminLogs(): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM AdminLog`, []);
  return row?.n ?? 0;
}
