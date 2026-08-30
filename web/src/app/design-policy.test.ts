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

/**
 * ⚠ 2026-08-30 개편: 이 테스트는 전에 **옛 다크 토큰의 hex를 그대로 고정**하고 있었다.
 *    디자인이 몰래 바뀌는 것을 막던 좋은 장치였지만, 값을 박아 두면 **의도한 개편까지 막는다.**
 *    그래서 값이 아니라 **정책**을 지키도록 다시 썼다 — 색은 바뀔 수 있고, 규칙은 안 바뀐다.
 */
describe("디자인 토큰", () => {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");

  it("라이트·다크 두 벌이 다 있다", () => {
    expect(css).toContain("--w-bg:");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("⚠ @theme inline이어야 테마 토글이 먹는다 — inline이 빠지면 값이 박혀 조용히 죽는다", () => {
    expect(css).toContain("@theme inline");
  });

  it("⚠ 순색을 쓰지 않는다 — 순수 검정·흰색은 눈이 아프다", () => {
    // ⚠ 주석 안의 색 이름까지 세면 "쓰지 말라"는 설명 문장이 위반으로 잡힌다.
    //    실제로 그렇게 한 번 걸렸다(2026-08-30).
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const uiColors = declarations.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const c of uiColors) {
      expect(c.toLowerCase(), c).not.toBe("#fff");
      expect(c.toLowerCase(), c).not.toBe("#ffffff");
      expect(c.toLowerCase(), c).not.toBe("#000");
      expect(c.toLowerCase(), c).not.toBe("#000000");
    }
  });

  it("⚠ 등락은 한국식이다 — 상승 적 · 하락 청", () => {
    expect(css).toContain("--w-up: #d0342c");
    expect(css).toContain("--w-down: #1f63c4");
  });

  it("⚠ 움직임을 끈 사람에게는 전부 끈다", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("Noto Sans KR 폰트를 사용한다", () => {
    expect(css).toContain("Noto Sans KR");
  });

  it("카드 모서리는 12px — 인쇄물용 4px는 화면에서 딱딱하다", () => {
    expect(css).toContain("--radius-card: 12px");
  });

  it("⚠ 그림자는 숲 잉크 계열이다 — 검정 그림자는 크림 위에서 회색 때처럼 보인다", () => {
    expect(css).toContain("rgba(30, 58, 43,");
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
