/**
 * 연준 정책금리 방향 카드 — "금리가 어디로 가는가"를 지표 나열 앞에 한 줄로.
 *
 * ## 왜 이 자리인가
 * 허브의 안내문이 "1. 금리부터 보세요"라고 말한다. 그런데 화면에는 금리의 **현재 값**만
 * 있고 **방향**이 없었다. 초보자가 실제로 궁금한 건 "지금 몇 %냐"가 아니라 "오르냐 내리냐"다.
 *
 * ## ⚠ 화면이 반드시 말해야 하는 것
 * 이 확률은 **시장 내재확률(CME FedWatch)이 아니다.** 문헌 표준값으로 보정한 준칙 모델이고,
 * 회귀로 적합한 것도 아니다. 숫자만 크게 띄우면 읽는 사람이 시장 컨센서스로 오해한다 —
 * 그래서 근거(처방금리·보정 내역)와 한계를 **같은 카드 안에** 둔다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatProbability, type FedHikeResult } from "@/lib/macro/fedhike";

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
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1c1f2a]">
        <div
          className={`h-full rounded-full ${emphasis ? "bg-gold-500" : "bg-gray-600"}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </li>
  );
}

/**
 * 보정 한 칸.
 * ⚠ 값이 없어 건너뛴 보정은 `0.00`이 아니라 `—`로 둔다 — 0으로 적으면
 *    "재 보니 영향이 없었다"로 읽히고, 그건 "안 쟀다"와 다른 말이다.
 */
function Adjustment({
  label,
  value,
  sign,
  applied,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  applied: boolean;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt>{label}</dt>
      <dd className={applied ? "tabular-nums text-gray-300" : "text-gray-600"}>
        {applied ? `${sign}${value.toFixed(2)}%p` : "— 값 없음"}
      </dd>
    </div>
  );
}

export function FedHikeCard({ result, asOf }: { result: FedHikeResult; asOf?: string }) {
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
          {asOf ? `${asOf} 기준(가장 오래된 투입 지표)` : "수집 전"}
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-300">
        테일러 준칙이 지금 경제에 처방하는 금리는{" "}
        <strong className="text-ink">{result.prescribedRate.toFixed(2)}%</strong>로, 현재 기준금리보다{" "}
        {result.gap >= 0 ? "높습니다" : "낮습니다"}(처방갭 {sign(result.gap)}%p).{" "}
        {result.gap >= 0
          ? "준칙 기준으로는 지금 정책이 다소 완화적이라는 뜻입니다."
          : "준칙 기준으로는 지금 정책이 다소 긴축적이라는 뜻입니다."}
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        <Bar label="인상" value={result.hike} emphasis={result.hike === top} />
        <Bar label="동결" value={result.hold} emphasis={result.hold === top} />
        <Bar label="인하" value={result.cut} emphasis={result.cut === top} />
      </ul>

      <dl className="mt-4 grid gap-2 text-[11.5px] text-gray-500 sm:grid-cols-3">
        <Adjustment
          label="비용압력(매파)"
          value={result.adjustments.costPush}
          sign="+"
          applied={result.adjustmentsApplied.costPush}
        />
        <Adjustment
          label="성장 약화(비둘기)"
          value={result.adjustments.growth}
          sign="−"
          applied={result.adjustmentsApplied.growth}
        />
        <Adjustment
          label="심리 약화(비둘기)"
          value={result.adjustments.sentiment}
          sign="−"
          applied={result.adjustmentsApplied.sentiment}
        />
      </dl>

      <p className="mt-2 text-[11.5px] leading-relaxed text-gray-600">
        보정 후 압력지수 <strong className="text-gray-400">{sign(result.adjustedGap)}%p</strong>
        {result.missingOptional.length > 0 && (
          <>
            {" "}
            · 아직 값이 없어 보정에서 빠진 지표: {result.missingOptional.join(" · ")}
          </>
        )}
      </p>

      <p className="mt-4 text-[11.5px] leading-relaxed text-gray-600">
        ※ 테일러(1993) 준칙에 오쿤 근사 산출갭을 넣고, 기대인플레·비용압력·성장·심리로 보정한 뒤
        확률로 편 값입니다. <strong>계수는 문헌 표준값으로 보정한 것이지 회귀로 적합한 것이
        아니며, 연방기금 선물에서 뽑는 시장 내재확률(CME FedWatch)과는 다른 숫자입니다.</strong>{" "}
        방향과 상대 비교로만 읽어 주세요. 여기서 내는 것은 상태 표시까지입니다.{" "}
        <Link href="/disclaimer" className="underline hover:text-gold-400">
          투자 판단 책임 고지
        </Link>
      </p>
    </Card>
  );
}
