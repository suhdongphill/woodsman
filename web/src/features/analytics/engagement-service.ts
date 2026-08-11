/**
 * 화면 개편 판단용 집계 — 화면이 쓰는 모양으로 조립한다.
 *
 * ⚠ 집계를 **못 읽은 것**과 **아직 표본이 없는 것**을 구분한다(null vs 빈 배열).
 *    둘이 같은 화면이 되면 지표가 죽은 줄 모르고 지나간다.
 */
import {
  rollupByTemplate,
  sortByRedesignPriority,
  toEngagementView,
  type EngagementView,
} from "@/lib/engagement";
import { loadPathStats } from "./engagement-repository";

export type ScreenReport = {
  /** 개별 경로 — 글 하나하나까지 */
  paths: EngagementView[];
  /** 템플릿으로 접은 것 — 화면 단위 판단은 이쪽을 본다 */
  templates: EngagementView[];
  /** 집계 기간(일) */
  days: number;
  /** 체류시간을 한 번이라도 보고한 표본 총합 — 0이면 "아직 안 쌓였다"고 말한다 */
  totalSamples: number;
  totalViews: number;
};

export async function loadScreenReport(days = 30): Promise<ScreenReport | null> {
  try {
    const rows = await loadPathStats(days);

    const paths = sortByRedesignPriority(rows.map(toEngagementView));
    const templates = sortByRedesignPriority(rollupByTemplate(rows).map(toEngagementView));

    return {
      paths,
      templates,
      days,
      totalSamples: rows.reduce((sum, r) => sum + r.samples, 0),
      totalViews: rows.reduce((sum, r) => sum + r.views, 0),
    };
  } catch (error) {
    console.error("[analytics] 화면 집계를 읽지 못했습니다", error);
    return null;
  }
}
