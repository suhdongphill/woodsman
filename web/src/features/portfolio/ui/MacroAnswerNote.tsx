import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

/**
 * "지금 부는 바람"과 이 페이지를 잇는 한 줄.
 *
 * ## 왜 있나 (2026-08-31, 홈 재편 Step 4)
 * 재편으로 `/portfolio`는 **"흐름에 대한 나의 답"**이라는 자리를 갖게 됐다
 * (`docs/설계_홈_콘텐츠중심_재편.md` §3·Step 4). 그런데 머리말만 그렇게 고치면 그건 구호다 —
 * **답이라면 무엇에 대한 답인지가 같은 화면에 있어야 한다.**
 * `/stocks`의 주도주 표가 마지막 줄에서 「그래서 내 배분은 →」으로 여기를 가리키고 있다.
 * 이 줄이 그 반대 방향을 이어 고리를 닫는다.
 *
 * ⚠ **없으면 지어내지 않는다.** 거시 값이 없으면 `lede`가 `null`이고, 이 줄은 **사라진다** —
 *    빈 상태를 그럴듯한 문장으로 덮지 않는다(`lib/home-lede.ts`와 같은 규칙).
 * ⚠ 판정 문구는 `macroLede()` **한 곳에서만** 만든다. 여기서 등급을 다시 조립하면
 *    홈과 이 화면이 같은 날 다른 말을 하게 된다.
 */
export function MacroAnswerNote({ lede }: { lede: string | null }) {
  if (!lede) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-[12.5px] leading-relaxed">
      <span className="text-muted">지금 부는 바람</span>
      <span className="tabular-nums text-ink">{lede}</span>
      <Link
        href="/macro"
        className="flex items-center gap-0.5 text-gold-400 transition-colors hover:text-gold-500"
      >
        흐름 읽기
        <ChevronRightIcon size={13} />
      </Link>
    </p>
  );
}
