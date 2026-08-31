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

  /**
   * ⚠ 소스 **전체**를 읽는 검사라 코드가 늘수록 느려진다. 2026-08-30에 기본 5초를 넘겨
   *    실패했는데, **규칙이 깨진 게 아니라 한도가 낡은 것**이었다.
   *    한도를 넉넉히 주되 검사 자체는 줄이지 않는다 — 키가 새는 것보다 20초가 싸다.
   */
  it(
    "소스 어디에도 실제 API 키 리터럴이 없다",
    () => {
      const files = walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f));
      for (const f of files) {
        const body = readFileSync(f, "utf8");
        expect(body, f).not.toMatch(/sk-ant-api\d/);
        expect(body, f).not.toMatch(/["']gsk_[A-Za-z0-9]{10,}["']/);
      }
    },
    20_000,
  );
});

/**
 * 홈과 `/portfolio`의 **자리 나눔** — 홈 콘텐츠 중심 재편(`docs/설계_홈_콘텐츠중심_재편.md`).
 *
 * ⚠ 이 규칙들은 화면을 띄우지 않으면 안 보인다. 그래서 **소스를 직접 훑어** 지킨다 —
 *    `beacon-path.test.ts`가 라우트 목록을 지키는 것과 같은 방식이다(CLAUDE.md §2-1).
 */
describe("홈과 포트폴리오의 자리 나눔 (Step 4)", () => {
  const routes = walk(join(SRC, "app")).filter((f) => f.endsWith("page.tsx"));
  const uses = (needle: string) =>
    routes.filter((f) => readFileSync(f, "utf8").includes(needle));

  it("⚠ 자금흐름 차트는 한 화면에만 있다 — 홈에서 내려온 것이라 두 번 그리면 중복이다", () => {
    // 컴포넌트를 감싼 섹션이 어느 라우트에 들어갔는지로 센다.
    const owners = uses("CapitalFlowSection");
    expect(owners.map((f) => f.replace(SRC, ""))).toHaveLength(1);
    expect(owners[0]).toContain("portfolio");
    // 라우트가 차트를 직접 조립하지 않는다(조립은 섹션이 한다 — CLAUDE.md §1).
    expect(uses("<CapitalFlowChart")).toHaveLength(0);
  });

  /* ⚠ "스냅숏이 없어도 섹션이 남는가"는 소스가 아니라 **렌더 결과**로 지킨다 —
     `features/portfolio/ui/CapitalFlowSection.test.tsx`. */

  it("⚠ 「흐름에 대한 답」 한 줄은 판정을 다시 만들지 않는다 — macroLede 한 곳에서만 만든다", () => {
    const note = readFileSync(
      join(SRC, "features", "portfolio", "ui", "MacroAnswerNote.tsx"),
      "utf8",
    );
    // 값이 없으면 줄을 지운다(지어내지 않는다).
    expect(note).toContain("if (!lede) return null;");
    // 등급 문구를 여기서 조립하면 홈과 다른 말을 하게 된다.
    expect(note).not.toContain("침체");
  });
});

/**
 * 카탈로그 설명글(`what`·`why`·`read`)은 `**강조**`를 품고 있다.
 *
 * ⚠ 2026-08-31 사고: 홈의 `MacroStrip`이 그것을 **그대로** 그려서, 지표 칩을 펼치면
 *    화면에 별표가 보였다. 다른 화면은 전부 `components/ui/Emphasis`를 쓰고 있었는데
 *    새로 만든 화면 하나만 빠져 있었다 — 사람이 잊는 자리라 테스트가 센다.
 *    (기계가 읽는 자리는 `Emphasis`가 아니라 `stripEmphasis`다 — 별표가 검색결과로 새지 않게.)
 */
describe("설명글의 강조 표시", () => {
  it("⚠ 화면이 what·why·read를 날것으로 그리지 않는다 — Emphasis를 거친다", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))) {
      // JSX 자식으로 그대로 꽂은 자리만 잡는다: {…indicator.read}
      // ⚠ `text={indicator.what}`(올바른 용법)이 아니라 **JSX 자식**으로 꽂은 자리만 잡는다.
      //    `=` 뒤는 속성값, `$` 뒤는 템플릿 문자열이다 — 둘 다 그리는 자리가 아니다.
      const raw = /(?<![=$\w])[{]\s*[\w.]*(indicator|group)[.](what|why|read|intro)\s*[}]/;
      if (raw.test(readFileSync(f, "utf8"))) {
        offenders.push(f.replace(SRC, ""));
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * 검색·AI가 읽는 문장은 **한 곳에서만** 정한다(`lib/site-identity.ts`).
 *
 * ⚠ 이 사고는 두 번 났다 — 2026-08-25에 화면을 고치고 메타를 두었고, 2026-08-30에
 *    홈이 흐름 이야기로 바뀌었는데 검색결과는 계좌 이야기였다. 화면은 눈에 보이니까
 *    고쳐지고, 이 문장들은 안 보이니까 안 고쳐진다.
 */
describe("사이트 자기소개 문장 (Step 5)", () => {
  const TAGLINE = "거시 지표로 읽는 경제 흐름과 투자 기록";

  it("⚠ 한 곳에서만 정한다 — 메타·llms.txt·JSON-LD가 같은 상수를 읽는다", () => {
    const owners: string[] = [];
    for (const f of walk(SRC)) {
      if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
      // 주석에 적힌 것은 설명이다. 실제로 쓰는 문자열 리터럴만 센다.
      const body = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (body.includes(TAGLINE)) owners.push(f);
    }
    expect(owners).toHaveLength(1);
    expect(owners[0].endsWith("site-identity.ts"), owners[0]).toBe(true);
  });
});
