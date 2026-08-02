/**
 * 화면설계 단계의 정책 회귀 테스트.
 * - 디자인 토큰이 고정값에서 벗어나지 않았는지
 * - 로그인 화면에 관리자 기본 비밀번호 힌트가 노출되지 않는지
 * - 브라우저 코드에 API 키가 들어가지 않았는지
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** 우리가 작성한 소스만 검사한다(생성된 Prisma 클라이언트 제외) */
const SKIP_DIRS = new Set(["generated"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const TOKENS: Record<string, string> = {
  "--color-bg": "#0f1117",
  "--color-card": "#1a1d27",
  "--color-cardHover": "#222633",
  "--color-border": "#2a2e3a",
  "--color-ink": "#e5e7eb",
  "--color-muted": "#9ca3af",
  "--color-gold": "#c9a657",
  "--color-gold-400": "#d8bd7a",
  "--color-emerald": "#2f9e63",
  "--color-emerald-500": "#36a06a",
  "--color-emerald-400": "#56b98a",
};

describe("디자인 토큰", () => {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");

  it("기존 index.html 값과 동일하게 유지된다", () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(css).toContain(`${name}: ${value};`);
    }
  });

  it("Noto Sans KR 폰트를 사용한다", () => {
    expect(css).toContain("Noto Sans KR");
  });

  it("card-hover 인터랙션을 유지한다", () => {
    expect(css).toContain("translateY(-4px)");
  });
});

describe("보안 정책", () => {
  it("로그인 화면에 기본 비밀번호 힌트가 없다", () => {
    const login = readFileSync(join(SRC, "app", "(public)", "login", "page.tsx"), "utf8");
    // 주석은 사용자에게 노출되지 않으므로 제외하고 검사한다
    const visible = login.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(visible).not.toMatch(/admin1234|기본\s*비밀번호|default password/i);
  });

  it("소스 어디에도 실제 API 키 리터럴이 없다", () => {
    const files = walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f));
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      expect(body, f).not.toMatch(/sk-ant-api\d/);
      expect(body, f).not.toMatch(/["']gsk_[A-Za-z0-9]{10,}["']/);
    }
  });
});
