/**
 * 신선도 표시 — 값 옆에 "이걸 지금 믿어도 되나"를 붙인다.
 *
 * ## ⚠ 색만으로 말하지 않는다
 * 이 사이트의 다른 배지(`SignalPill`)와 같은 규칙이다. 색각 이상인 사람에게 빨강/호박은
 * 같은 색이고, 흑백 인쇄와 강한 햇빛 아래서도 색은 사라진다. **글자로 먼저 말한다.**
 *
 * ## ⚠ 정상일 때는 아무것도 렌더하지 않는다
 * 늘 무언가 떠 있으면 사람은 그 자리를 통째로 무시한다. 그러면 진짜 낡은 값이 떴을 때도
 * 안 읽힌다 — 기능이 있으나 마나가 되는 가장 흔한 경로다(볼트 사양서 §6 판정 원장 카드).
 */
import { cx } from "@/lib/format";
import { AlertIcon } from "@/components/icons";
import {
  freshnessBadge,
  freshnessTone,
  healthNotice,
  type MacroFreshness,
  type MacroHealth,
} from "@/lib/macro/freshness";
import { MACRO_LAYERS, type MacroLayer } from "@/lib/macro/layers";

const TONE: Record<string, string> = {
  // 수집기가 죽은 것 — 고칠 대상이 코드다
  stalled: "border-red-500/40 bg-red-500/10 text-red-300",
  // 값이 낡은 것 — 기다리거나 사람이 새로 조사한다
  stale: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  // 언제 들어왔는지 모르는 값
  unknown: "border-border bg-ink/5 text-gray-400",
};

export function FreshnessBadge({
  freshness,
  className,
}: {
  freshness: MacroFreshness;
  className?: string;
}) {
  const label = freshnessBadge(freshness);
  if (!label) return null;

  const tone = freshnessTone(freshness);
  return (
    <span
      title={freshness.staleAfter ? `갱신 기한 ${freshness.staleAfter}` : undefined}
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium leading-4 whitespace-nowrap",
        TONE[tone] ?? TONE.unknown,
        className,
      )}
    >
      <span aria-hidden="true">{tone === "stalled" ? "■" : "▲"}</span>
      {label}
    </span>
  );
}

/**
 * 레이어 칩 — 이 지표가 **인과의 어디에 있나**.
 * ⚠ 툴팁 문구는 `lib/macro/layers.ts`에서만 읽는다. 화면에 다시 적지 않는다
 *    (볼트 사양서 §7: layers 사전을 화면에 하드코딩하지 말 것).
 */
export function LayerChip({ layer, className }: { layer: MacroLayer; className?: string }) {
  const def = MACRO_LAYERS[layer];
  return (
    <span
      title={`${def.key} ${def.label} — ${def.desc}`}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] leading-4 text-gray-400",
        className,
      )}
    >
      <span className="font-semibold text-gray-300">{def.key}</span>
      <span className="hidden sm:inline">{def.label}</span>
    </span>
  );
}

/**
 * 해석이 뒤집히는 조건 — `capacity_remaining` 계열과 회의 주기가 있는 정책금리에 붙는다.
 * ⚠ 이 문장이 없으면 "역레포 감소 = 유동성 공급"처럼 **고갈 구간에서 정반대로** 읽힌다.
 */
export function StateDependencyNote({ text }: { text: string }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5 text-[11.5px] leading-relaxed text-amber-200/90">
      <AlertIcon size={13} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

/**
 * 화면 상단 건강도 한 줄.
 * ⚠ 문제가 없으면 **아무것도 렌더하지 않는다.**
 */
export function HealthNotice({ health }: { health: MacroHealth }) {
  const notice = healthNotice(health);
  if (!notice) return null;

  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-200/90">
      <AlertIcon size={14} className="mt-0.5 shrink-0" />
      <span>
        <strong className="font-semibold">지표 신선도</strong> · {notice}
        <span className="ml-1 text-gray-500">
          — 값은 그대로 보여주되, 낡은 것은 흐리게 표시했습니다.
        </span>
      </span>
    </p>
  );
}
