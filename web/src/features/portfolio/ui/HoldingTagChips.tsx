import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/format";
import { describeTags } from "@/lib/holding-tags";
import type { HoldingTags } from "@/lib/types";

/**
 * 볼트 판정 태그 칩 — 판정 → 레이어 → 종류 순서(2026-09-25, UI 권고).
 *
 * 판정이 가장 앞이다: 이 사이트가 이 종목에 대해 **새로 말하는 것**이 판정이고, 레이어·종류는 그 판정을 읽는 배경이다.
 * 색은 판정 칩에만 쓴다(레이어·종류는 회색) — 칩이 다 색을 가지면 어느 것도 눈에 안 띈다.
 * ⚠ 판정일을 같이 보인다(`compact`에서도 title 로). 오래된 판정은 「오래됨」.
 */
export function HoldingTagChips({
  tags,
  today,
  compact = false,
}: {
  tags: HoldingTags;
  /** YYYY-MM-DD */
  today: string;
  /** 관리자 표처럼 좁은 자리 — 판정 칩 하나만 */
  compact?: boolean;
}) {
  const v = describeTags(tags, today);
  const dateNote = v.asOf ? `판정 ${v.asOf}${v.stale ? " · 오래됨" : ""}` : "판정일 없음";

  if (compact) {
    return v.verdict ? (
      <span title={`${v.verdict.hint} · ${v.layer} · ${dateNote}`}>
        <Badge tone={v.stale ? "neutral" : v.verdict.tone}>
          {v.verdict.label}
          {v.verdict.stars && ` ${v.verdict.stars}`}
        </Badge>
      </span>
    ) : (
      <span className="text-[11px] text-gray-600">—</span>
    );
  }

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {v.verdict && (
          <span title={v.verdict.hint}>
            <Badge tone={v.stale ? "neutral" : v.verdict.tone}>
              {v.verdict.label}
              {v.verdict.stars && ` ${v.verdict.stars}`}
            </Badge>
          </span>
        )}
        <Badge tone="neutral">{v.layer}</Badge>
        {v.kind && <Badge tone="neutral">{v.kind}</Badge>}
        <span className={cx("text-[10.5px] tabular-nums", v.stale ? "text-gold-500" : "text-gray-500")}>
          {dateNote}
        </span>
      </div>
      {/* 경고는 첫 문장만 — 나머지는 title 로. 카드가 경고 목록이 되면 편입 논리가 밀린다. */}
      {v.flags.length > 0 && (
        <p className="text-[11px] leading-snug text-gray-500 line-clamp-1" title={v.flags.join("\n")}>
          ⚑ {v.flags[0]}
          {v.flags.length > 1 && <span className="text-gray-600"> 외 {v.flags.length - 1}</span>}
        </p>
      )}
    </div>
  );
}
