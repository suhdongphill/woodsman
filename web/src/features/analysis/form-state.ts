/**
 * 그날의 분석 관리자 폼 상태.
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있다. 상수·타입은 여기 둔다.
 */
import type { GuardFinding } from "@/lib/analysis/guard";

export type AnalysisDraft = { date: string; oneLine: string; body: string; sourceLabel: string };

export type AnalysisFormState = {
  error?: string;
  savedAt?: string;
  /** 점검에 걸린 줄 — 있으면 저장하지 않고 돌려준다 */
  findings?: GuardFinding[];
  /** 저장하지 않고 돌려줄 때 입력을 되살린다(폼이 비워지지 않게) */
  draft?: AnalysisDraft;
};

export const emptyAnalysisFormState: AnalysisFormState = {};

/** 한 줄 결론 최대 글자 — 홈 팝업 머리에 한 줄로 들어간다 */
export const ANALYSIS_ONE_LINE_MAX = 120;

/** 출처 표기 기본값 — ⚠ 외부 AI 보고서를 운영자가 정리했다는 사실을 숨기지 않는다 */
export const DEFAULT_ANALYSIS_SOURCE = "운영자 정리 · 외부 AI 분석 참고";
