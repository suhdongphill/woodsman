/**
 * 조회 집계를 화면이 쓰기 좋은 형태로.
 *
 * ⚠ 집계를 **못 읽은 것**과 **0회**를 구분한다(null vs 0). 둘이 같은 화면이 되면
 *    지표가 죽은 줄 모르고 지나간다. 실패는 반드시 로그로 남긴다.
 */
import { loadViewStats, type ViewStats } from "./repository";

export async function loadViewStatsSafe(): Promise<ViewStats | null> {
  try {
    return await loadViewStats();
  } catch (error) {
    console.error("[analytics] 조회 집계를 읽지 못했습니다", error);
    return null;
  }
}
