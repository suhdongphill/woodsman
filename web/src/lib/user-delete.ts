/**
 * 사용자를 지워도 되는지 판단 — 순수 함수.
 *
 * ## 왜 규칙을 따로 빼나
 * 삭제는 되돌릴 수 없고, 잘못 지우면 **아무도 로그인할 수 없는 사이트**가 된다.
 * 그런 규칙은 화면이나 액션 안에 묻어 두지 않고 테스트로 고정한다.
 */
import type { Role } from "./types";

export type DeleteTarget = {
  id: string;
  role: Role;
  email: string;
};

export type DeleteDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * ⚠ 두 가지는 절대 허용하지 않는다.
 * 1. **자기 자신** — 지우는 순간 로그아웃되고 돌아올 방법이 없다.
 * 2. **마지막 관리자** — 관리자 0명이면 어떤 화면도 다시 열 수 없다.
 *    (관리자 계정은 시드 스크립트로만 만들 수 있어 복구가 배포 작업이 된다.)
 */
export function decideUserDelete(input: {
  target: DeleteTarget | null;
  currentUserId: string;
  adminCount: number;
}): DeleteDecision {
  const { target, currentUserId, adminCount } = input;

  if (!target) return { allowed: false, reason: "이미 삭제되었거나 없는 계정입니다." };

  if (target.id === currentUserId) {
    return {
      allowed: false,
      reason: "자기 자신은 삭제할 수 없습니다. 지우는 순간 로그인할 방법이 없어집니다.",
    };
  }

  if (target.role === "ADMIN" && adminCount <= 1) {
    return {
      allowed: false,
      reason: "마지막 관리자는 삭제할 수 없습니다. 관리자가 0명이면 관리 화면을 열 수 없습니다.",
    };
  }

  return { allowed: true };
}

/** 삭제 버튼 옆에 적을 경고 — 무엇이 함께 사라지는지 미리 말한다. */
export function deleteSideEffects(commentCount: number): string {
  const base = "로그인 수단과 개인 포트폴리오가 함께 삭제됩니다.";
  if (commentCount <= 0) return base;
  return `${base} 작성한 댓글 ${commentCount}건은 남고 작성자 표시만 사라집니다.`;
}
