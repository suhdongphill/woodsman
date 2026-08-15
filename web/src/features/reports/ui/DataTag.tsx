import { findDataTag } from "@/lib/canslim/catalog";
import type { DataTagKey } from "@/lib/canslim/types";

/**
 * 데이터 태그 배지 — **정직성 원칙의 시각화**(`references/report-format.md`).
 *
 * ⚠ 같은 표 안에 감사보고서 확정치와 리서치 추정치가 섞여 있으면 읽는 사람은 **전부 확정으로
 *    읽는다.** 색으로 구분하는 것이 이 배지의 전부이자 목적이다.
 * ⚠ `N/A`는 회색이다. 빨강으로 칠하면 "나쁜 값"으로 읽히는데, N/A는 나쁜 게 아니라 **안 본 것**이다.
 */
const TONE: Record<DataTagKey, string> = {
  confirmed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  needsCheck: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  na: "border-border bg-cardHover text-gray-400",
};

export function DataTag({ tag }: { tag?: DataTagKey }) {
  if (!tag) return null;
  const def = findDataTag(tag);
  if (!def) return null;

  return (
    <span
      title={def.note}
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] ${TONE[tag]}`}
    >
      {def.label}
    </span>
  );
}
