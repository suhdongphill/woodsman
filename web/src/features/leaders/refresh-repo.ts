/** 주도주 최신화 요청(`LeaderRefreshRequest`) DB 접근. 판단은 `lib/leaders/refresh.ts`. 상태는 볼트 스크립트가 바꾼다. */
import { execute, queryAll } from "@/lib/d1";
import type { RefreshRequest, RefreshStatus } from "@/lib/leaders/refresh";

const STATUSES: RefreshStatus[] = ["REQUESTED", "RUNNING", "DONE", "FAILED"];

export async function loadRefreshRequests(limit = 5): Promise<RefreshRequest[]> {
  const rows = await queryAll<Omit<RefreshRequest, "status"> & { status: string }>(
    `SELECT id, requestedAt, status, startedAt, finishedAt, note FROM LeaderRefreshRequest ORDER BY requestedAt DESC LIMIT ?`,
    [limit],
  );
  // ⚠ 모르는 상태는 「끝남」으로 읽지 않는다.
  return rows.map((r) => ({ ...r, status: STATUSES.includes(r.status as RefreshStatus) ? (r.status as RefreshStatus) : "FAILED" }));
}

export async function createRefreshRequest(requestedBy: string): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO LeaderRefreshRequest (id, requestedAt, requestedBy, status) VALUES (?, ?, ?, 'REQUESTED')`,
    [`lr_${now.replace(/[^0-9]/g, "")}`, now, requestedBy],
  );
}
