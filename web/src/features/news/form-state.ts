/**
 * 파도 기사 관리자 폼 상태.
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있다. 상수·타입은 여기 둔다.
 */
import type { NewsCategory } from "@/lib/news/feeds";

export type NewsFormState = { error?: string; savedAt?: string };

export const emptyNewsFormState: NewsFormState = {};

/** 관리자가 넣는 분류 — 자동 수집(연준·물가)과 같은 이름을 쓴다(홈에서 한 목록으로 섞인다) */
export const MANUAL_NEWS_CATEGORIES: NewsCategory[] = ["유가", "지정학", "금리", "환율", "물가", "연준"];

/** 한 줄 요약 최대 글자 — ⚠ 본문을 옮기지 않기 위한 선이다(저작권) */
export const NEWS_SUMMARY_MAX = 200;
