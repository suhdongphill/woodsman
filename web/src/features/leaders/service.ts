/**
 * 주도주 화면 조립 — 실행·레이어·종목·지난 실행·운영 포트폴리오 보유를 모아 `buildLeadersView`에 넘긴다.
 *
 * ⚠ 「아직 실린 실행이 없음」과 「읽지 못함」을 다른 상태로 돌려준다(web/CLAUDE.md §3).
 *   둘이 같은 빈 화면이면 적재가 안 된 건지 DB가 죽은 건지 모른다.
 */
import { buildLeadersView, type LeadersView } from "@/lib/leaders/view";
import { loadPublishedHoldings } from "@/features/portfolio/repository";
import { loadLeaderClasses, loadLeaderGroups, loadLeaderMembers, loadLeaderRuns } from "./repository";

export type LeadersState =
  | { state: "ok"; view: LeadersView }
  | { state: "empty" }
  | { state: "error" };

export async function loadLeadersView(today: string): Promise<LeadersState> {
  try {
    const runs = await loadLeaderRuns(2);
    if (!runs.length) return { state: "empty" };
    const [run, prevRun] = runs;
    const [groups, members, prevMembers, holdings] = await Promise.all([
      loadLeaderGroups(run.id),
      loadLeaderMembers(run.id),
      prevRun ? loadLeaderClasses(prevRun.id) : Promise.resolve(undefined),
      // 보유 표시는 덤이다 — 못 읽어도 화면은 그린다(남기기는 한다).
      loadPublishedHoldings().catch((error) => {
        console.error("[leaders] 운영 포트폴리오를 못 읽어 보유 표시를 뺀다", error);
        return [];
      }),
    ]);
    return {
      state: "ok",
      view: buildLeadersView({
        run,
        groups,
        members,
        prev: prevRun && prevMembers ? { id: prevRun.id, members: prevMembers } : undefined,
        heldTickers: holdings.map((h) => h.ticker).filter((t): t is string => !!t),
        today,
      }),
    };
  } catch (error) {
    console.error("[leaders] 주도주 사본을 읽지 못했다", error);
    return { state: "error" };
  }
}
