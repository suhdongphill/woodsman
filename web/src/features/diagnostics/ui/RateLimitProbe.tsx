"use client";

/**
 * 속도 제한 자가 진단 — 버튼 하나로 "실제로 막히는지" 잰다.
 *
 * ⚠ 판정 문구를 여기서 만들지 않는다. 판단은 `lib/beacon-selftest.judgeProbe()`에 있고
 *    테스트로 고정돼 있다. 화면은 그 결과를 **펴기만** 한다.
 */
import { useActionState } from "react";
import { probeRateLimitAction } from "../actions";
import { emptyDiagnosticsState } from "../form-state";
import { SELFTEST_CALLS, SELFTEST_LIMIT, judgeProbe } from "@/lib/beacon-selftest";

const TONE = {
  ok: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200",
  fail: "border-red-500/30 bg-red-500/[0.06] text-red-200",
  unknown: "border-border bg-cardHover text-gray-300",
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="text-[12.5px] text-gray-200 font-mono break-all text-right">{value}</span>
    </div>
  );
}

export function RateLimitProbe() {
  const [state, formAction, pending] = useActionState(probeRateLimitAction, emptyDiagnosticsState);
  const verdict = state.probe ? judgeProbe(state.probe, SELFTEST_LIMIT) : undefined;

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "재는 중…" : "속도 제한 재 보기"}
        </button>
        <p className="text-[11.5px] text-gray-600">
          진단 전용 바인딩을 {SELFTEST_CALLS}회 연속으로 부릅니다(상한 {SELFTEST_LIMIT}회).
          운영 카운터는 건드리지 않습니다.
        </p>
      </form>

      {state.error && (
        <p role="alert" className="text-[12.5px] text-red-400">
          {state.error}
        </p>
      )}

      {verdict && state.probe && (
        <div className={`rounded-xl border px-4 py-3 ${TONE[verdict.level]}`}>
          <p className="text-[13.5px] font-medium">{verdict.headline}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed opacity-90">{verdict.detail}</p>

          <div className="mt-3 rounded-lg bg-ink/10 px-3 py-2">
            <Row label="진단 바인딩" value={state.probe.binding} />
            <Row label="바인딩 상태" value={state.probe.state} />
            <Row label="객체 타입" value={state.probe.typeName ?? "—"} />
            <Row label="호출 / 차단" value={`${state.probe.calls} / ${state.probe.blocked}`} />
            <Row label="첫 반환값" value={state.probe.firstResult ?? "—"} />
            {state.beaconBinding && (
              <Row
                label="운영 바인딩(BEACON_LIMITER)"
                value={`${state.beaconBinding.state}${
                  state.beaconBinding.typeName ? ` · ${state.beaconBinding.typeName}` : ""
                }`}
              />
            )}
            {state.ranAt && <Row label="측정 시각" value={state.ranAt} />}
          </div>
        </div>
      )}
    </div>
  );
}
