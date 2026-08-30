"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import {
  THEME_KEY,
  THEME_LABEL,
  nextTheme,
  parseTheme,
  themeAttr,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * 테마 토글 — 시스템 · 밝게 · 어둡게.
 *
 * ⚠ **서버는 사람이 무엇을 골랐는지 모른다.** 그래서 첫 렌더는 항상 "시스템"으로 그리고,
 *    붙은 뒤에 저장된 값을 읽어 맞춘다. 서버와 다른 것을 그리면 hydration이 깨진다.
 *    실제 색은 이미 `layout`의 첫 페인트 스크립트가 맞춰 놓았으므로 화면은 안 번쩍인다.
 * ⚠ 판단(무엇이 다음인가·무엇을 속성에 넣는가)은 `lib/theme.ts`에 있다. 여기서 다시 정하지 않는다.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      // 저장소를 못 읽는 브라우저(사생활 보호 모드 등)도 있다. 시스템으로 둔다.
      stored = null;
    }
    setChoice(parseTheme(stored));
    setReady(true);
  }, []);

  function apply(next: ThemeChoice) {
    setChoice(next);
    const attr = themeAttr(next);
    if (attr) document.documentElement.setAttribute("data-theme", attr);
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // 저장이 안 돼도 이번 방문에는 적용된다. 조용히 넘어가되 화면은 바뀐다.
    }
  }

  return (
    <button
      type="button"
      onClick={() => apply(nextTheme(choice))}
      aria-label={`화면 테마: ${THEME_LABEL[choice]} (눌러서 바꾸기)`}
      title={`화면 테마 — ${THEME_LABEL[choice]}`}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-gold-600/40 hover:text-ink",
        className,
      )}
    >
      <ThemeIcon choice={choice} />
      {/* ⚠ 붙기 전에는 라벨을 비워 둔다 — 서버와 다른 글자를 그리면 hydration이 깨진다 */}
      {/* ⚠ "시스템"만 있으면 무엇의 시스템인지 모른다 — 「화면」을 앞에 붙인다 */}
      <span className="tabular-nums">{ready ? `화면 ${THEME_LABEL[choice]}` : ""}</span>
    </button>
  );
}

/** 아이콘은 1.5px stroke·둥근 끝 — 각진 아이콘 세트를 쓰지 않는다. */
function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
    </svg>
  );
}
