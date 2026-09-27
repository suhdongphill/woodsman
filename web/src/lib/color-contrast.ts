/**
 * 색 대비 — WCAG 2.1 상대 휘도 공식. 순수 함수(2026-09-27 (82) 티스토리 글 검사).
 *
 * 상대 휘도 L = 0.2126·R + 0.7152·G + 0.0722·B, 각 채널 c(0~1)는 c ≤ 0.04045면 c/12.92, 아니면 ((c+0.055)/1.055)^2.4.
 * 대비 = (L밝은 + 0.05) / (L어두운 + 0.05). 흰색·검정은 21:1.
 * 기준(WCAG 2.1 SC 1.4.3 AA): 본문 4.5:1 · 큰 글자(24px 이상, 또는 굵게 18.66px 이상) 3:1.
 */

export type Rgb = { r: number; g: number; b: number };

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", gray: "#808080", grey: "#808080",
  orange: "#ffa500", navy: "#000080", maroon: "#800000", purple: "#800080", teal: "#008080",
};

/** `#rgb` · `#rrggbb` · `rgb(r,g,b)` · `rgba(r,g,b,a)`(알파 무시) · 몇몇 색 이름. 못 읽으면 null. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  const named = NAMED[s];
  if (named) return parseColor(named);
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    return r <= 255 && g <= 255 && b <= 255 ? { r, g, b } : null;
  }
  return null;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** 큰 글자인가 — 24px 이상, 또는 굵게(700 이상) 18.66px 이상. */
export function isLargeText(fontSizePx: number | null, bold: boolean): boolean {
  if (fontSizePx === null) return false;
  return fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
}

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
