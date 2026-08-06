/**
 * 지식 검색 폼 상태.
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있다. 상수·타입은 반드시 여기 둔다
 *    (다른 기능의 `form-state.ts`와 같은 이유 — 어기면 액션 호출이 500으로 죽는다).
 */
import type { ScoredDoc } from "@/lib/ai/retrieval";

export type KnowledgeSearchState = {
  query?: string;
  hits?: ScoredDoc[];
  prompt?: string;
  /** 창고에 들어 있는 전체 문서 수 */
  total?: number;
  error?: string;
};

export const emptyKnowledgeState: KnowledgeSearchState = {};
