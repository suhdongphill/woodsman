/**
 * 작업별 라우팅 — "이 버튼을 누르면 어디로 가나"를 미리 보여준다.
 *
 * 이게 없으면 비용 사고는 청구서가 와야 알게 된다.
 * 각 작업이 요구하는 급, 실제로 잡힌 1순위, 폴백 순서, 1회 예상 비용을 함께 보여준다.
 */
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AlertIcon } from "@/components/icons";
import type { ProviderUsage } from "@/lib/ai/routing";
import { estimateCostUsd, routeCandidates } from "@/lib/ai/routing";
import { PERSONAS, type AiTask } from "@/lib/ai/persona";

/** 1회 호출의 대략적 규모 — 비용 감을 잡기 위한 것이지 정확한 청구액이 아니다. */
const SAMPLE_IN = 4_000;
const SAMPLE_OUT = 1_200;

const REQUIRE_LABEL = { deep: "고급", balanced: "중급", cheap: "경량" } as const;

export function TaskRouting({
  connectedEnv,
  usage,
}: {
  /** 키가 채워진 env 변수명만 (값 아님) */
  connectedEnv: string[];
  usage: ProviderUsage[];
}) {
  // routeCandidates는 env 객체의 '존재 여부'만 본다 — 여기서 값 대신 표식을 넣는다.
  const env = Object.fromEntries(connectedEnv.map((name) => [name, "set"]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(Object.keys(PERSONAS) as AiTask[]).map((task) => {
        const persona = PERSONAS[task];
        const candidates = routeCandidates({ task, env, usage });
        const primary = candidates[0];
        const cost = primary ? estimateCostUsd(primary.model, SAMPLE_IN, SAMPLE_OUT) : null;

        return (
          <Card key={task}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">{persona.label}</h3>
                <p className="mt-1 text-[11.5px] text-muted leading-relaxed">{persona.purpose}</p>
              </div>
              <Badge tone={persona.requires === "deep" ? "gold" : "neutral"}>
                {REQUIRE_LABEL[persona.requires]} 이상
              </Badge>
            </div>

            {primary ? (
              <>
                <div className="mt-4 rounded-xl border border-border bg-[#12141c] px-3 py-2.5">
                  <p className="text-[10.5px] text-gray-600">1순위</p>
                  <p className="mt-0.5 text-[13px] text-white">
                    {primary.providerLabel}
                    <span className="ml-2 font-mono text-[11.5px] text-gray-400">
                      {primary.model.id}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    1회 예상{" "}
                    {cost === null ? (
                      <span className="text-emerald-400">무료 티어 (요금 미확인)</span>
                    ) : (
                      <span className="tabular-nums text-gold-500">${cost.toFixed(4)}</span>
                    )}
                    <span className="ml-1 text-gray-600">
                      · 입력 {SAMPLE_IN / 1000}K / 출력 {SAMPLE_OUT / 1000}K 기준
                    </span>
                  </p>
                </div>

                <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                  폴백:{" "}
                  {candidates.map((c, i) => (
                    <span key={c.providerId}>
                      {i > 0 && <span className="text-gray-700"> → </span>}
                      <span className={c.free ? "text-emerald-400" : "text-gold-500"}>
                        {c.providerLabel}
                      </span>
                    </span>
                  ))}
                </p>
              </>
            ) : (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-[11.5px] text-red-300">
                <AlertIcon size={13} className="mt-0.5 shrink-0" />
                지금 이 작업을 처리할 제공자가 없습니다. {REQUIRE_LABEL[persona.requires]} 이상
                모델을 가진 제공자의 키를 등록하거나, 꺼 둔 제공자를 켜세요.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
