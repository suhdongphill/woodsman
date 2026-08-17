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

/**
 * 분류 키 → 프롬프트에 쓸 한국어.
 *
 * ⚠ 2026-08-17부터 관리자가 분류를 추가할 수 있어 **키가 이 세 개로 끝나지 않는다.**
 *    기본 셋은 위 표를 쓰고(프롬프트 용어를 고정하기 위해서다), 커스텀 분류는
 *    **관리자가 붙인 이름을 그대로** 쓴다. 둘 다 없으면 키를 쓴다 —
 *    ⚠ `undefined`가 프롬프트에 박히면 모델이 "undefined 기능"을 근거로 쓴다.
 */
export function functionLabelKo(key: string, name?: string): string {
  if (key in FUNCTION_LABEL_KO) return FUNCTION_LABEL_KO[key as FunctionType];
  return name?.trim() || key;
}
