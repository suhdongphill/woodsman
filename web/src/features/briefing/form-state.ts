/** 브리핑 올리기 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
import type { Rejection } from "@/lib/briefing/rewrite";

export type BriefingUploadState = {
  error?: string;
  /** 저장된 초안 날짜 — 미리보기 링크 */
  savedDate?: string;
  /** 누가 다듬었나 — rules | ai:<모델> */
  editor?: string;
  /** AI가 다듬은 문장 수 */
  accepted?: number;
  /** AI가 다듬었다가 되돌린 문장(숫자가 달라졌거나 길이가 크게 달라짐) */
  rejected?: Rejection[];
  /** AI를 못 쓴 이유 — 규칙 정리본으로 저장했을 때 */
  aiSkipped?: string;
};

export const emptyBriefingUploadState: BriefingUploadState = {};
