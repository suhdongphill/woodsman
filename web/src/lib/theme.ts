/**
 * 테마 선택 — 순수 모듈.
 *
 * ## 세 가지 상태다 (둘이 아니다)
 * `시스템` · `라이트` · `다크`. **기본은 시스템**이고, 사람이 고르면 그것이 이긴다.
 * ⚠ 토글을 두 상태로 만들면 "시스템을 따르던 상태"로 **되돌아갈 방법이 없어진다.**
 *    한 번 고르면 영영 고른 채로 사는 화면은 설정이 아니라 함정이다.
 *
 * ## ⚠ 저장 값을 믿지 않는다
 * `localStorage`에는 사람이 무엇이든 넣을 수 있고, 옛 버전이 넣어 둔 값이 남아 있을 수도 있다.
 * 모르는 값은 **시스템으로 떨어뜨린다** — 화면이 깨진 채로 뜨는 것보다 낫다.
 */

/** ⚠ 키를 바꾸면 이미 고른 사람의 설정이 사라진다. 바꾸지 않는다. */
export const THEME_KEY = "woodsman-theme";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** 저장된 문자열 → 쓸 수 있는 선택. 모르는 값은 시스템. */
export function parseTheme(raw: string | null | undefined): ThemeChoice {
  return (THEME_CHOICES as readonly string[]).includes(raw ?? "")
    ? (raw as ThemeChoice)
    : "system";
}

/**
 * `<html data-theme="…">`에 넣을 값. 시스템이면 **속성 자체를 지운다**(null).
 * ⚠ `data-theme="system"` 같은 값을 넣지 않는다 — CSS는 그런 값을 모른다.
 */
export function themeAttr(choice: ThemeChoice): "light" | "dark" | null {
  return choice === "system" ? null : choice;
}

/** 다음 상태 — 시스템 → 라이트 → 다크 → 시스템. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  const i = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(i + 1) % THEME_CHOICES.length];
}

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "시스템",
  light: "밝게",
  dark: "어둡게",
};

/**
 * 첫 페인트 전에 돌릴 스크립트.
 *
 * ⚠ 이게 없으면 **잘못된 테마가 한 번 번쩍인다**(FOUC). 서버는 사람이 무엇을 골랐는지
 *    모르기 때문에 라이트로 그려 보내고, 다크를 고른 사람은 흰 화면을 한 번 맞는다.
 * ⚠ 실패해도 화면은 떠야 한다 — 그래서 try/catch로 감싸고, 실패하면 시스템 설정대로 둔다.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;
