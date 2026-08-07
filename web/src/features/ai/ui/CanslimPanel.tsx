import { CanslimDial } from "@/components/ui/CanslimScore";
import { Badge } from "@/components/ui/Badge";
import { BotIcon } from "@/components/icons";
import { cx, scoreColor } from "@/lib/format";

const ITEMS = [
  { key: "C", label: "최근 분기 이익" },
  { key: "A", label: "연간 이익 성장" },
  { key: "N", label: "신제품·신고가" },
  { key: "S", label: "수급(유통주식)" },
  { key: "L", label: "선도주 여부" },
  { key: "I", label: "기관 수급" },
  { key: "M", label: "시장 방향" },
];

/**
 * CANSLIM 결과 패널.
 *
 * ⚠ 지금 점수는 **AI가 낸 값이 아니라 예시**다(P6에서 실제 호출로 채운다).
 *   그래서 제공자 이름과 캐시 시각을 찍지 않는다 — 2026-08-07 점검 전까지
 *   부르지도 않은 "NVIDIA NIM"과 있지도 않은 "캐시 2026-07-31 06:00"을 기본값으로
 *   표시하고 있었다. 없는 근거를 지어내는 것은 값을 안 보여주는 것보다 나쁘다.
 *   실제 호출이 붙으면 provider·analyzedAt을 받아서 그때 표시한다.
 */
export function CanslimPanel({
  composite,
  scores,
  provider,
  analyzedAt,
}: {
  composite: number;
  scores: Record<string, number>;
  /** 실제로 호출한 AI 제공자. 예시 점수일 때는 넘기지 않는다. */
  provider?: string;
  /** 실제 분석 시각. 예시 점수일 때는 넘기지 않는다. */
  analyzedAt?: string;
}) {
  const c = scoreColor(composite);
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BotIcon size={16} className="text-gold-400" />
          CANSLIM 분석
        </h3>
        <Badge tone={provider ? "neutral" : "warn"}>{provider ?? "예시 점수"}</Badge>
      </div>

      <div className="flex items-center gap-6">
        <CanslimDial score={composite} />
        <div className="flex-1 min-w-0 space-y-2.5">
          {ITEMS.map((it) => {
            const s = scores[it.key] ?? 0;
            const sc = scoreColor(s);
            return (
              <div key={it.key} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-bold text-gray-500">{it.key}</span>
                <span className="hidden sm:block text-[11px] text-muted w-24 shrink-0 truncate">
                  {it.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[#12141c] overflow-hidden">
                  <div
                    className={cx("h-full rounded-full", sc.bg)}
                    style={{ width: `${s * 10}%` }}
                  />
                </div>
                <span className={cx("text-[11px] font-semibold tabular-nums w-5 text-right", sc.text)}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className={cx("mt-5 pt-4 border-t border-border/70 text-[11px]", c.text)}>
        종합 {composite.toFixed(1)}점 — {composite >= 7 ? "편입 후보" : composite >= 5 ? "관찰" : "보류"}
      </p>
      <p className="text-[11px] text-gray-600 mt-1">
        {analyzedAt
          ? `${analyzedAt} 분석 · 실행 권한: 관리자`
          : "AI 분석을 아직 붙이지 않았습니다. 위 점수는 화면 구성을 보여주는 예시입니다."}
      </p>
    </div>
  );
}
