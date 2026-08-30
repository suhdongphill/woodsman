import { cx } from "@/lib/format";

/**
 * Woodsman 워드마크 — 침엽수 3단 + 테라코타 밑동 + 세리프 "WoodsMan".
 *
 * ## 왜 SVG인가 (2026-08-30 개편)
 * 전에는 428×428 **JPEG**였다. 그래서
 *   - 라이트/다크에 따라 색을 못 바꾸고(배경이 박혀 있다),
 *   - 24px로 줄이면 뭉개졌으며,
 *   - 크림 배경 위에서 로고만 검은 사각형처럼 떴다.
 * SVG로 옮기면 **부모의 `color`를 따라간다** — 두 벌을 만들 필요가 없다.
 *
 * ## 형태 — B안(둥근 모서리)
 * ⚠ `stroke-linejoin="round"` + **같은 색 stroke**가 둥근 모서리를 만든다.
 *    `strokeWidth`를 줄이면 각이 다시 살아나므로 **2.6을 유지한다.**
 * ⚠ 최소 크기 20px. 그 아래에서는 워드마크 글자를 떼고 나무만 쓴다.
 */
export function TreeMark({ size = 34, className }: { size?: number; className?: string }) {
  const height = size;
  const width = Math.round((size * 26) / 34);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 26 34"
      role="img"
      aria-label="Woodsman"
      className={cx("shrink-0", className)}
    >
      {/* 나무는 currentColor — 부모에서 색을 주면 라이트/다크가 자동으로 맞는다 */}
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      >
        <path d="M13 2.6 L19.6 11 L6.4 11 Z" />
        <path d="M13 10.5 L21.8 20.4 L4.2 20.4 Z" />
        <path d="M13 18.4 L24.4 28.8 L1.6 28.8 Z" />
      </g>
      {/* 밑동만 테라코타 — ⚠ 속성이 아니라 style이어야 var()가 읽힌다 */}
      <rect x="11.5" y="28.4" width="3" height="4.6" rx="1.5" style={{ fill: "var(--w-series-2)" }} />
    </svg>
  );
}

/**
 * 나무 + 글자.
 *
 * ⚠ 표기는 **WoodsMan**, 아래 줄은 테라코타 **「나무꾼 이야기」**다(2026-08-30 개편).
 *    전에는 `DISCIPLINE · PATIENCE · COMPOUNDING`이었다. 브랜드 문구를 바꾸는 일이라
 *    **이 파일 한 곳에만** 두었다 — 되돌릴 때 여기만 보면 된다.
 * ⚠ 세리프는 **이름에만** 쓴다. 본문·표에 세리프를 쓰지 않는다(읽기 피로).
 */
export function Wordmark({
  size = 36,
  compact = false,
  className,
}: {
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("flex select-none items-center gap-2.5", className)}>
      <span className="text-series-1">
        <TreeMark size={compact ? 26 : size} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className="text-[17px] font-bold tracking-tight text-ink"
          style={{ fontFamily: '"Noto Serif KR", Georgia, "Times New Roman", serif' }}
        >
          WoodsMan
        </span>
        {!compact && (
          <span className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-gold-500">
            나무꾼 이야기
          </span>
        )}
      </span>
    </span>
  );
}
