/**
 * AI 프롬프트에 쓰는 한국어 라벨.
 *
 * 화면용 라벨(`components/ui/Badge.tsx`의 FUNCTION_LABEL)과 분리해 둔다 —
 * 화면 문구를 다듬는다고 프롬프트의 용어가 같이 흔들리면
 * 모델 출력이 조용히 달라진다.
 */
import type { FunctionType } from "../types";

export const FUNCTION_LABEL_KO: Record<FunctionType, string> = {
  GROWTH: "성장",
  INCOME: "인컴",
  DEFENSE: "방어",
};
