import { describe, expect, it } from "vitest";
import { decideUserDelete, deleteSideEffects } from "./user-delete";

const other = { id: "u_2", role: "USER" as const, email: "b@x.com" };
const admin = { id: "u_admin2", role: "ADMIN" as const, email: "a2@x.com" };

describe("사용자 삭제 판단", () => {
  it("보통 회원은 지울 수 있다", () => {
    expect(decideUserDelete({ target: other, currentUserId: "u_1", adminCount: 2 })).toEqual({
      allowed: true,
    });
  });

  it("⚠ 자기 자신은 지울 수 없다 — 지우는 순간 돌아올 방법이 없다", () => {
    const d = decideUserDelete({ target: other, currentUserId: "u_2", adminCount: 5 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/자기 자신/);
  });

  it("⚠ 마지막 관리자는 지울 수 없다 — 관리자 0명이면 관리 화면이 잠긴다", () => {
    const d = decideUserDelete({ target: admin, currentUserId: "u_1", adminCount: 1 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/마지막 관리자/);
  });

  it("관리자가 둘 이상이면 관리자도 지울 수 있다", () => {
    expect(
      decideUserDelete({ target: admin, currentUserId: "u_1", adminCount: 2 }).allowed,
    ).toBe(true);
  });

  it("이미 없는 계정은 조용히 성공시키지 않는다", () => {
    const d = decideUserDelete({ target: null, currentUserId: "u_1", adminCount: 2 });
    expect(d.allowed).toBe(false);
  });
});

describe("삭제 부작용 안내", () => {
  it("무엇이 함께 사라지는지 미리 말한다", () => {
    expect(deleteSideEffects(0)).toMatch(/로그인 수단/);
  });

  it("댓글은 남고 작성자만 지워진다는 걸 밝힌다", () => {
    expect(deleteSideEffects(3)).toMatch(/댓글 3건은 남고/);
  });
});
