/**
 * 주도주 모니터 사본(LeaderRun·LeaderGroup·LeaderMember)의 DB 접근.
 *
 * 볼트 `_scripts/export-portal-leaders.py`가 싣는다. ⚠ 이 코드는 **읽기만** 한다 — 판정을 고치는 경로를 만들지 않는다.
 * ⚠ 화면은 `LeaderRun`에 있는 실행만 읽는다. 볼트가 LeaderRun을 맨 마지막에 넣으므로 적재 중인 실행은 안 보인다.
 */
import { queryAll } from "@/lib/d1";
import type { GroupRow, MemberRow, RunRow } from "@/lib/leaders/view";

/** 최근 실행 n개(새것부터). */
export async function loadLeaderRuns(limit = 2): Promise<RunRow[]> {
  return queryAll<RunRow>(
    `SELECT id, collectedAt, meta, fit FROM LeaderRun ORDER BY id DESC LIMIT ?`,
    [limit],
  );
}

export async function loadLeaderGroups(runId: string): Promise<GroupRow[]> {
  return queryAll<GroupRow>(
    `SELECT groupId, ord, name, why, src, rsMedianM3, breadthHigh, leaders, prime, supply, etf
       FROM LeaderGroup WHERE runId = ? ORDER BY ord ASC`,
    [runId],
  );
}

export async function loadLeaderMembers(runId: string): Promise<MemberRow[]> {
  return queryAll<MemberRow>(
    `SELECT groupId, ticker, ord, name, role, mkt, cls, tier, why, flag, rs3m, offHigh, revYoy, accel, detail
       FROM LeaderMember WHERE runId = ? ORDER BY groupId, ord ASC`,
    [runId],
  );
}

/** 지난 실행과 비교할 때는 판정만 있으면 된다. */
export async function loadLeaderClasses(
  runId: string,
): Promise<Pick<MemberRow, "ticker" | "groupId" | "cls">[]> {
  return queryAll(`SELECT ticker, groupId, cls FROM LeaderMember WHERE runId = ?`, [runId]);
}
