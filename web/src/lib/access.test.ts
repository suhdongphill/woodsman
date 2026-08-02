/**
 * 접근 정책 회귀 테스트.
 * 여기가 깨지면 "관리자 영역이 열렸다"는 뜻이므로 규칙을 바꿀 때 반드시 같이 고친다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideAccess,
  isUnder,
  loginPath,
  normalizeRole,
  PROTECTED_MATCHER,
  safeNextPath,
} from "./access";

describe("isUnder", () => {
  it("경로 자신과 하위 경로만 매칭한다", () => {
    expect(isUnder("/admin", "/admin")).toBe(true);
    expect(isUnder("/admin/posts", "/admin")).toBe(true);
    expect(isUnder("/administrator", "/admin")).toBe(false);
    expect(isUnder("/adminx/posts", "/admin")).toBe(false);
    expect(isUnder("/", "/admin")).toBe(false);
  });
});

describe("normalizeRole", () => {
  it("ADMIN 문자열만 ADMIN이고 나머지는 전부 USER로 좁힌다", () => {
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole("admin")).toBe("USER");
    expect(normalizeRole("USER")).toBe("USER");
    expect(normalizeRole(undefined)).toBe("USER");
    expect(normalizeRole(null)).toBe("USER");
    expect(normalizeRole(true)).toBe("USER");
  });
});

describe("safeNextPath", () => {
  it("같은 사이트 절대경로만 통과시킨다", () => {
    expect(safeNextPath("/admin/posts")).toBe("/admin/posts");
    expect(safeNextPath("/me?tab=1")).toBe("/me?tab=1");
  });

  it("외부로 나가는 값은 전부 기본값으로 되돌린다", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("admin")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});

describe("decideAccess", () => {
  it("공개 경로는 로그인 여부와 무관하게 통과한다", () => {
    for (const path of ["/", "/insights", "/board/1", "/stocks/AAPL", "/login"]) {
      expect(decideAccess(path, null).kind, path).toBe("allow");
      expect(decideAccess(path, "USER").kind, path).toBe("allow");
    }
  });

  it("비로그인은 보호 경로에서 로그인 화면으로 간다", () => {
    expect(decideAccess("/admin", null)).toEqual({ kind: "login", to: loginPath("/admin") });
    expect(decideAccess("/me", null)).toEqual({ kind: "login", to: loginPath("/me") });
  });

  it("로그인 후 원래 위치(쿼리 포함)로 되돌아갈 수 있게 next를 붙인다", () => {
    const decision = decideAccess("/admin/posts", null, "?page=2");
    expect(decision).toEqual({ kind: "login", to: "/login?next=%2Fadmin%2Fposts%3Fpage%3D2" });
  });

  it("일반 사용자는 관리자 영역에 못 들어간다", () => {
    expect(decideAccess("/admin", "USER")).toEqual({ kind: "forbidden", to: "/" });
    expect(decideAccess("/admin/users", "USER")).toEqual({ kind: "forbidden", to: "/" });
  });

  it("일반 사용자도 회원 영역은 들어간다", () => {
    expect(decideAccess("/me", "USER").kind).toBe("allow");
  });

  it("관리자는 양쪽 다 통과한다", () => {
    expect(decideAccess("/admin/ai", "ADMIN").kind).toBe("allow");
    expect(decideAccess("/me", "ADMIN").kind).toBe("allow");
  });
});

describe("미들웨어 matcher", () => {
  // Next.js는 matcher를 빌드 타임 리터럴로만 읽어 상수를 참조할 수 없다.
  // 그래서 두 곳이 어긋나지 않는지 소스 텍스트로 검증한다.
  const middleware = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");

  it("PROTECTED_MATCHER와 동일한 범위를 선언한다", () => {
    for (const pattern of PROTECTED_MATCHER) {
      expect(middleware).toContain(`"${pattern}"`);
    }
  });

  it("보호 경로 목록이 조용히 줄지 않는다", () => {
    expect(PROTECTED_MATCHER).toEqual(["/admin/:path*", "/me/:path*"]);
  });
});
