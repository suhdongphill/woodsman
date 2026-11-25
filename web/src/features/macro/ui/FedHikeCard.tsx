/**
 * 연준 정책금리 방향 카드 — "금리가 어디로 가는가"를 지표 나열 앞에 한 줄로.
 *
 * ## 왜 이 자리인가
 * 허브의 안내문이 "1. 금리부터 보세요"라고 말한다. 그런데 화면에는 금리의 **현재 값**만
 * 있고 **방향**이 없었다. 초보자가 실제로 궁금한 건 "지금 몇 %냐"가 아니라 "오르냐 내리냐"다.
 *
 * ## ⚠ 화면이 반드시 말해야 하는 것
 * 이 확률은 **시장 내재확률(CME FedWatch)이 아니다.** 처방갭과 직전 회의 결정으로 과거 FOMC 결정을 추정한
 * 모형이다(2026-11-25 교체 · 전에는 정해 둔 계수 + 보정항). 숫자만 크게 띄우면 읽는 사람이 시장 컨센서스로
 * 오해한다 — 그래서 근거(처방금리·직전 결정)와 한계를 **같은 카드 안에** 둔다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  DECISION_LABEL,
  FED_HIKE_MODEL,
  formatProbability,
  hikeOverHoldThreshold,
  type FedHikeResult,
} from "@/lib/macro/fedhike";

const BIAS_STYLE: Record<FedHikeResult["bias"], string> = {
  hawkish: "border-red-500/30 bg-red-500/10 text-red-300",
  neutral: "border-border bg-bg text-gray-300",
  dovish: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};

function Bar({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-gray-400">{label}</span>
        <span
          className={`text-[17px] font-bold tabular-nums ${emphasis ? "text-gold-400" : "text-ink"}`}
        >
          {formatProbability(value)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${emphasis ? "bg-gold-500" : "bg-gray-600"}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </li>
  );
}

export function FedHikeCard({
  result,
  asOf,
  asOfBy = [],
  lastMeeting,
}: {
  result: FedHikeResult;
  asOf?: string;
  /** 기준일을 잡고 있는 투입 지표 이름 — 독자가 「왜 이 날짜인가」를 바로 알게 */
  asOfBy?: string[];
  /** 확률에 넣은 직전 정례회의 날짜 */
  lastMeeting?: string;
}) {
  const top = Math.max(result.hike, result.hold, result.cut);
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

  return (
    <Card padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${BIAS_STYLE[result.bias]}`}
        >
          🏦 정책 편향 {result.biasLabel}
        </span>
        <span className="text-[11px] text-gray-500">
          {asOf
            ? asOfBy.length
              ? `${asOf} 기준 · 가장 오래된 투입 지표: ${asOfBy.join(", ")}`
              : `${asOf} 기준(가장 오래된 투입 지표)`
            : "수집 전"}
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-300">
        테일러 준칙이 지금 경제에 처방하는 금리는{" "}
        <strong className="text-ink">{result.prescribedRate.toFixed(2)}%</strong>로, 현재 목표 범위 중간값(
        {result.policyRate.toFixed(3)}%)보다 {result.gap >= 0 ? "높습니다" : "낮습니다"}(처방갭 {sign(result.gap)}%p).{" "}
        {result.gap >= 0
          ? "준칙 기준으로는 지금 정책이 다소 완화적이라는 뜻입니다."
          : "준칙 기준으로는 지금 정책이 다소 긴축적이라는 뜻입니다."}
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        <Bar label="인상" value={result.hike} emphasis={result.hike === top} />
        <Bar label="동결" value={result.hold} emphasis={result.hold === top} />
        <Bar label="인하" value={result.cut} emphasis={result.cut === top} />
      </ul>

      {/* ⭐ 2026-11-24 — 「FedWatch는 인상인데 왜 동결?」에 확률 바로 아래에서 답한다 */}
      <p className="mt-3 text-[12px] leading-relaxed text-gray-400">
        이 모형은 <strong className="text-gray-300">경제 지표와 직전 회의 결정만</strong> 봅니다. 연준 위원
        발언·점도표·시장 기대는 넣지 않습니다. 과거 연준은 한번 움직이면 이어서 움직이는 경향이 가장 뚜렷했습니다 —
        직전 회의({lastMeeting ?? "날짜 미상"})가 <strong className="text-gray-300">{DECISION_LABEL[result.lastDecision]}</strong>
        이어서{" "}
        {result.lastDecision === 0
          ? `처방갭이 웬만큼 커도 동결이 기본값입니다(인상이 동결을 앞서려면 처방갭이 약 +${hikeOverHoldThreshold(0).toFixed(1)}%p를 넘어야 합니다).`
          : `같은 방향이 이어질 확률이 높게 나옵니다.`}{" "}
        시장이 실제로 거는 확률은 아래 「시장이 거는 것」 카드에 있습니다.
      </p>

      <p className="mt-4 text-[11.5px] leading-relaxed text-gray-600">
        ※ 처방금리는 테일러(1993) 준칙(오쿤 근사 산출갭 · r* {"="} FOMC 경제전망 장기 금리 − 2)이고, 확률은 처방갭과
        직전 회의 결정으로 <strong>{FED_HIKE_MODEL.sample}의 실제 결정을 추정한 순서형 로짓</strong>입니다(표본 밖
        2012년 이후 검증에서 기준선보다 나음). 사후 수정 자료로 추정했고, 아래 「시장이 거는 것」 카드(연방기금 선물
        내재)와는 다른 숫자입니다. 방향과 상대 비교로만 읽어 주세요. 여기서 내는 것은 상태 표시까지입니다.{" "}
        <Link href="/disclaimer" className="underline hover:text-gold-400">
          투자 판단 책임 고지
        </Link>
      </p>
    </Card>
  );
}
