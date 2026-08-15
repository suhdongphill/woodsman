import { CanslimDial } from "@/components/ui/CanslimScore";
import { Badge } from "@/components/ui/Badge";
import { BotIcon } from "@/components/icons";
import { cx, scoreColor } from "@/lib/format";
import { canslimCoverageNotice } from "@/lib/canslim/score";
import type { CanslimScore } from "@/lib/canslim/score";

/**
 * CANSLIM 결과 패널.
 *
 * ## ⚠ 2026-08-15에 고친 것 — 화면이 정책과 다른 말을 하고 있었다
 * 이 화면은 세 가지를 잘못하고 있었다(설계서 §1의 진단 그대로다).
 *
 * 1. ⚠ **결측을 0점으로** 그렸다(`scores[key] ?? 0`). 버블 점수에서 "안 본 것을 괜찮은 것으로
 *    만들지 않는다"고 정해 둔 규칙의 정반대다. 이제 **채점 안 된 축은 막대를 그리지 않고
 *    '미채점'이라고 적는다.**
 * 2. ⚠ **등급 경계가 7.0 / 5.0**이었다. 정책은 **8.0 / 6.5**다 — 화면이 정책보다 후하게
 *    판정하고 있었다. 이제 판정은 `lib/canslim/score.ts`의 밴드를 그대로 쓴다.
 * 3. 점수의 출처가 없었다(호출부에 하드코딩된 예시 표). 근거·출처·기준일 없는 점수는
 *    숫자 모양의 의견이다. 이제 **없으면 없다고 그린다.**
 *
 * ⚠ 판정 문구를 여기서 만들지 않는다. 등급·게이트·커버리지 문장은 전부 순수 모듈이 만들고
 *    화면은 펴기만 한다 — 같은 판단을 두 곳에서 하면 언젠가 갈린다.
 */
export function CanslimPanel({
  score,
  provider,
  analyzedAt,
}: {
  score: CanslimScore;
  /** 실제로 호출한 AI 제공자. 아직 채점 경로가 없으면 넘기지 않는다. */
  provider?: string;
  /** 실제 분석 시각. */
  analyzedAt?: string;
}) {
  const composite = score.composite10;
  const c = composite === undefined ? undefined : scoreColor(composite);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BotIcon size={16} className="text-gold-400" />
          CANSLIM 분석
        </h3>
        <Badge tone={provider ? "neutral" : "warn"}>{provider ?? "미채점"}</Badge>
      </div>

      <div className="flex items-center gap-6">
        {composite === undefined ? (
          /* ⚠ 0.0으로 그리지 않는다 — 0은 '저조'로 읽힌다. 빈 다이얼이 정직하다. */
          <div className="w-24 h-24 shrink-0 rounded-full border-[7px] border-[#2a2e3a] flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-600">—</span>
            <span className="text-[10px] text-gray-600">/ 10</span>
          </div>
        ) : (
          <CanslimDial score={composite} />
        )}

        <div className="flex-1 min-w-0 space-y-2.5">
          {score.axes.map((axis) => {
            // "Current — 최근 분기 실적" → "최근 분기 실적". 목록은 카탈로그 하나에서만 온다.
            const label = axis.item.name.split("—").slice(1).join("—").trim() || axis.item.name;
            const sc = axis.points === undefined ? undefined : scoreColor(axis.points);

            return (
              <div key={axis.item.key} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-bold text-gray-500">{axis.item.key}</span>
                <span className="hidden sm:block text-[11px] text-muted w-24 shrink-0 truncate">
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[#12141c] overflow-hidden">
                  {axis.points !== undefined && (
                    <div
                      className={cx("h-full rounded-full", sc?.bg)}
                      style={{ width: `${axis.points * 10}%` }}
                    />
                  )}
                </div>
                <span
                  className={cx(
                    "text-[11px] font-semibold tabular-nums w-8 text-right",
                    sc?.text ?? "text-gray-600",
                  )}
                  title={axis.scored ? undefined : "채점하지 않았습니다(0점이 아닙니다)"}
                >
                  {axis.points ?? "N/A"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border/70 space-y-1.5">
        {composite === undefined ? (
          <p className="text-[11px] text-gray-500">
            아직 채점하지 않았습니다. ⚠ 0점으로 표시하지 않습니다 — 0은 &lsquo;저조&rsquo;로 읽힙니다.
          </p>
        ) : (
          <p className={cx("text-[11px]", c?.text)}>
            종합 {composite.toFixed(1)}점 — {score.band?.grade} · {score.band?.action}
          </p>
        )}

        {/* ⚠ 시장 게이트. 채점 안 했으면 '통과'가 아니라 '모름'이라고 적는다. */}
        {score.gate.state !== "clear" && (
          <p
            className={cx(
              "text-[11px]",
              score.gate.state === "hold" ? "text-amber-400" : "text-gray-500",
            )}
          >
            {score.gate.text}
          </p>
        )}

        <p className="text-[11px] text-gray-600">{canslimCoverageNotice(score.coverage)}</p>

        {analyzedAt && <p className="text-[11px] text-gray-600">{analyzedAt} 분석</p>}
      </div>
    </div>
  );
}
