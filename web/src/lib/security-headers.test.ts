import { describe, expect, it } from "vitest";
import {
  adminSecurityHeaders,
  globalSecurityHeaders,
  securityHeaderRules,
} from "./security-headers";

function value(headers: { key: string; value: string }[], key: string): string {
  const found = headers.find((h) => h.key.toLowerCase() === key.toLowerCase());
  if (!found) throw new Error(`${key} 헤더가 없다`);
  return found.value;
}

describe("전역 보안 헤더", () => {
  it("점검이 지목한 헤더가 전부 있다", () => {
    const keys = globalSecurityHeaders().map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
      ]),
    );
  });

  /**
   * ⚠ 이 테스트가 이 파일의 존재 이유다. `default-src`가 전역에 들어가는 순간
   * AdSense가 통째로 죽는데, 화면을 안 보면 아무도 모른다.
   */
  it("전역 CSP에 default-src·script-src·img-src·connect-src가 없다 — 광고를 막지 않는다", () => {
    const csp = value(globalSecurityHeaders(), "Content-Security-Policy");
    expect(csp).not.toMatch(/(^|;\s*)default-src/);
    expect(csp).not.toMatch(/(^|;\s*)script-src/);
    expect(csp).not.toMatch(/(^|;\s*)img-src/);
    expect(csp).not.toMatch(/(^|;\s*)connect-src/);
  });

  it("전역 CSP는 되돌림 없는 넷을 건다", () => {
    const csp = value(globalSecurityHeaders(), "Content-Security-Policy");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("⚠ form-action이 소셜 로그인 제공자를 허용한다 — 빼면 구글·카카오 로그인이 죽는다", () => {
    const csp = value(globalSecurityHeaders(), "Content-Security-Policy");
    expect(csp).toContain("https://accounts.google.com");
    expect(csp).toContain("https://kauth.kakao.com");
  });

  it("⚠ HSTS에 preload를 넣지 않는다 — 되돌리는 데 몇 달이 걸린다", () => {
    expect(value(globalSecurityHeaders(), "Strict-Transport-Security")).not.toContain("preload");
  });
});

describe("관리자 화면 엄격판", () => {
  it("default-src로 출처를 우리 쪽으로 좁힌다", () => {
    const csp = value(adminSecurityHeaders(), "Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src 'none'");
  });

  it("소셜 프로필 사진·붙여넣기 이미지를 막지 않는다", () => {
    const csp = value(adminSecurityHeaders(), "Content-Security-Policy");
    expect(csp).toContain("img-src 'self' data: https:");
  });

  it("CSP 말고는 전역판과 같다 — 한쪽만 고치는 사고를 막는다", () => {
    const admin = adminSecurityHeaders().filter((h) => h.key !== "Content-Security-Policy");
    const global = globalSecurityHeaders().filter((h) => h.key !== "Content-Security-Policy");
    expect(admin).toEqual(global);
  });
});

describe("next.config가 받는 규칙", () => {
  it("전역 다음에 /admin이 와야 엄격판이 이긴다", () => {
    const rules = securityHeaderRules();
    expect(rules.map((r) => r.source)).toEqual(["/:path*", "/admin/:path*"]);
  });

  it("/admin 규칙이 실제로 엄격판을 싣는다", () => {
    const admin = securityHeaderRules()[1];
    expect(value(admin.headers, "Content-Security-Policy")).toContain("default-src 'self'");
  });
});

describe("⚠ 개발 서버에서만 여는 예외", () => {
  it("개발에서는 unsafe-eval을 연다 — 막으면 관리자 화면 JS가 통째로 안 살아난다", () => {
    const csp = value(adminSecurityHeaders(true), "Content-Security-Policy");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("⚠ 운영에서는 절대 열지 않는다", () => {
    const csp = value(adminSecurityHeaders(false), "Content-Security-Policy");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
  });
});
