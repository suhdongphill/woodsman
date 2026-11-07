/** 주도주 최신화 요청(`LeaderRefreshRequest`) DB 접근. 판단은 `lib/leaders/refresh.ts`. 상태는 볼트 스크립트가 바꾼다. */
import { execute, queryAll } from "@/lib/d1";
import type { RefreshRequest, RefreshStatus } from "@/lib/leaders/refresh";
import type { SectorFlowRow } from "@/lib/sector-flow";

const STATUSES: RefreshStatus[] = ["REQUESTED", "RUNNING", "DONE", "FAILED"];

export async function loadRefreshRequests(limit = 5): Promise<RefreshRequest[]> {
  const rows = await queryAll<Omit<RefreshRequest, "status"> & { status: string }>(
    `SELECT id, requestedAt, status, startedAt, finishedAt, note FROM LeaderRefreshRequest ORDER BY requestedAt DESC LIMIT ?`,
    [limit],
  );
  // ⚠ 모르는 상태는 「끝남」으로 읽지 않는다.
  return rows.map((r) => ({ ...r, status: STATUSES.includes(r.status as RefreshStatus) ? (r.status as RefreshStatus) : "FAILED" }));
}

/**
 * 섹터 ETF 유입 — ⚠ 관리자 화면에서만 부른다(`lib/sector-flow.ts`).
 * 보조 표라 실패해도 화면을 죽이지 않되 「없음」과 「못 읽음」을 가른다.
 */
export async function loadSectorFlows(): Promise<{ rows: SectorFlowRow[]; failed: boolean }> {
  try {
    const rows = await queryAll<SectorFlowRow>(
      `SELECT month, ticker, name, flowPct FROM SectorEtfFlow WHERE month >= ? ORDER BY month ASC`,
      [new Date(Date.now() - 800 * 86_400_000).toISOString().slice(0, 7)],
    );
    return { rows, failed: false };
  } catch (error) {
    console.error("[sector-flow] 유입 자료를 읽지 못했다", error);
    return { rows: [], failed: true };
  }
}

export async function createRefreshRequest(requestedBy: string): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO LeaderRefreshRequest (id, requestedAt, requestedBy, status) VALUES (?, ?, ?, 'REQUESTED')`,
    [`lr_${now.replace(/[^0-9]/g, "")}`, now, requestedBy],
  );
}
