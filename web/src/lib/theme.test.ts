import { describe, expect, it } from "vitest";
import {
  THEME_BOOT_SCRIPT,
  THEME_CHOICES,
  THEME_KEY,
  nextTheme,
  parseTheme,
  themeAttr,
} from "./theme";

describe("테마 선택", () => {
  it("세 가지다 — 시스템으로 돌아갈 길을 남긴다", () => {
    expect(THEME_CHOICES).toEqual(["system", "light", "dark"]);
  });

  it("⚠ 모르는 값은 시스템으로 떨어진다 — 화면이 깨진 채 뜨는 것보다 낫다", () => {
    for (const bad of [null, undefined, "", "  ", "DARK", "sepia", "true"]) {
      expect(parseTheme(bad), String(bad)).toBe("system");
    }
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
  });

  it("⚠ 시스템이면 data-theme 속성을 지운다 — CSS는 'system'을 모른다", () => {
    expect(themeAttr("system")).toBeNull();
    expect(themeAttr("light")).toBe("light");
    expect(themeAttr("dark")).toBe("dark");
  });

  it("한 바퀴 돌면 제자리로 온다", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("⚠ 첫 페인트 스크립트는 저장 키를 쓰고 실패해도 넘어간다", () => {
    expect(THEME_BOOT_SCRIPT).toContain(THEME_KEY);
    expect(THEME_BOOT_SCRIPT).toContain("catch");
    // ⚠ 스크립트가 문서에 그대로 박히므로 태그를 닫는 문자열이 섞이면 안 된다
    expect(THEME_BOOT_SCRIPT).not.toContain("</");
  });
});
