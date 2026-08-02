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
 * CANSLIM 결과 패널(목업).
 * Phase 7에서 서버 라우트(AI 제공자 폴백 체인 + 24h 캐시) 결과로 채워진다.
 */
export function CanslimPanel({
  composite,
  scores,
  provider = "NVIDIA NIM",
  cachedAt = "2026-07-31 06:00",
}: {
  composite: number;
  scores: Record<string, number>;
  provider?: string;
  cachedAt?: string;
}) {
  const c = scoreColor(composite);
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BotIcon size={16} className="text-gold-400" />
          CANSLIM 분석
        </h3>
        <Badge tone="neutral">{provider}</Badge>
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
        캐시 {cachedAt} 기준 · 24시간마다 갱신 · 실행 권한: 관리자
      </p>
    </div>
  );
}
