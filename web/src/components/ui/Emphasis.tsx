/**
 * 카탈로그 설명글의 `**강조**`를 굵게 낸다.
 *
 * ⚠ 마크다운 렌더러가 아니다. **코드 상수만** 받는다(지표 카탈로그의 what/why/read).
 *    사용자가 쓴 글은 `lib/sanitize-html.ts` 경로로 간다 — 두 경로를 섞지 않는다.
 */
import { splitEmphasis } from "@/lib/format";

export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {splitEmphasis(text).map((part, i) =>
        part.strong ? (
          <strong key={i} className="font-semibold text-white">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
