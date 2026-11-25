/**
 * 10년물 분해 카드(2026-11-25 · ⑤-2) — 「10년물이 왜 이 수준이고, 최근엔 왜 움직였나」.
 *
 * ## 왜 이 자리인가
 * /macro 허브의 금리 흐름이 「정책금리 방향(준칙·선물)」 → 「장기금리는 왜」로 이어지게 준칙·선물 카드 바로 아래에 둔다.
 * `rates` 묶음 상세는 /macro/rates 전용 화면에 가려 쓸 수 없다(CHANGELOG 9/16).
 *
 * ## ⚠ 화면이 반드시 말해야 하는 것
 * - 두 분해는 축이 다르다 — 서로 더하지 않는다.
 * - 기대인플레(BEI)에는 TIPS 유동성 프리미엄이 섞여 위기 때 낮게 잡힌다 · Kim–Wright는 모형 추정치(ACM과 다른 값).
 */
import { Card } from "@/components/ui/Card";
import type { SplitChange, MarketSplit, ModelSplit, YieldDecomp } from "@/lib/macro/yield-decomp";

const num = (n: number) => `${n.toFixed(2)}%`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;

/** 쌓은 막대 — 성분이 모두 0 이상일 때만 그린다(음수가 섞이면 폭으로 말할 수 없다 · 숫자만 남긴다). */
function StackBar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (parts.some((p) => p.value < 0) || total <= 0) return null;
  return (
    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      {parts.map((p) => (
        <div key={p.label} className={p.tone} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

function Legend({ parts }: { parts: { label: string; value: number; dot: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-400">
      {parts.map((p) => (
        <li key={p.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${p.dot}`} aria-hidden="true" />
          {p.label} <strong className="tabular-nums text-gray-200">{num(p.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

function ChangeTable({
  market,
  model,
}: {
  market: SplitChange<MarketSplit>[];
  model: SplitChange<ModelSplit>[];
}) {
  const months = [...new Set([...market, ...model].map((c) => c.months))].sort((a, b) => a - b);
  if (months.length === 0) return null;
  const cell = (v: number | undefined) => (v === undefined ? "—" : signed(v));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-right text-[12px] tabular-nums">
        <caption className="mb-1 text-left text-[11.5px] text-gray-500">변화 분해(%p · 같은 날짜끼리 비교)</caption>
        <thead className="text-gray-500">
          <tr>
            <th className="py-1 text-left font-normal">기간</th>
            <th className="py-1 font-normal">10년물</th>
            <th className="py-1 font-normal">실질금리</th>
            <th className="py-1 font-normal">기대인플레</th>
            <th className="border-l border-border py-1 pl-2 font-normal">기대 단기금리</th>
            <th className="py-1 font-normal">텀 프리미엄</th>
          </tr>
        </thead>
        <tbody className="text-gray-300">
          {months.map((m) => {
            const a = market.find((c) => c.months === m);
            const b = model.find((c) => c.months === m);
            return (
              <tr key={m} className="border-t border-border/60">
                <td className="py-1.5 text-left text-gray-400">
                  {m}개월{a ? <span className="text-gray-600"> ({a.from.slice(5)}→)</span> : null}
                </td>
                <td className="py-1.5 font-semibold text-ink">{cell(a?.delta.nominal)}</td>
                <td className="py-1.5">{cell(a?.delta.real)}</td>
                <td className="py-1.5">{cell(a?.delta.bei)}</td>
                <td className="border-l border-border py-1.5 pl-2">{cell(b?.delta.expected)}</td>
                <td className="py-1.5">{cell(b?.delta.termPremium)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function YieldDecompCard({ result }: { result: YieldDecomp }) {
  const { market, model } = result;
  return (
    <Card padding="p-5 sm:p-6">
      <p className="text-[11px] font-semibold tracking-wide text-gray-500">10년물 분해 — 장기금리는 왜 이 수준인가</p>

      {result.sentence && <p className="mt-2 text-[13.5px] leading-relaxed text-gray-300">{result.sentence}</p>}

      {market && (
        <section className="mt-4">
          <h3 className="text-[12.5px] text-gray-400">
            시장 분해 · <span className="text-gray-500">{market.date} 기준</span>
          </h3>
          <p className="mt-1 text-[14px] tabular-nums text-ink">
            10년물 <strong>{num(market.nominal)}</strong> = 실질금리 {num(market.real)} + 기대인플레 {num(market.bei)}
          </p>
          <StackBar
            parts={[
              { label: "실질금리", value: market.real, tone: "bg-sky-500/70" },
              { label: "기대인플레", value: market.bei, tone: "bg-amber-500/70" },
            ]}
          />
          <Legend
            parts={[
              { label: "실질금리(TIPS)", value: market.real, dot: "bg-sky-500/70" },
              { label: "기대인플레(BEI)", value: market.bei, dot: "bg-amber-500/70" },
            ]}
          />
        </section>
      )}

      {model && (
        <section className="mt-4">
          <h3 className="text-[12.5px] text-gray-400">
            모형 분해(연준 이사회 Kim–Wright) · <span className="text-gray-500">{model.date} 기준</span>
          </h3>
          <p className="mt-1 text-[14px] tabular-nums text-ink">
            적합 10년 <strong>{num(model.fitted)}</strong> = 기대 단기금리 {num(model.expected)} + 텀 프리미엄{" "}
            {num(model.termPremium)}
          </p>
          <StackBar
            parts={[
              { label: "기대 단기금리", value: model.expected, tone: "bg-emerald-500/60" },
              { label: "텀 프리미엄", value: model.termPremium, tone: "bg-rose-500/60" },
            ]}
          />
          <Legend
            parts={[
              { label: "기대 단기금리(10년 평균)", value: model.expected, dot: "bg-emerald-500/60" },
              { label: "텀 프리미엄", value: model.termPremium, dot: "bg-rose-500/60" },
            ]}
          />
        </section>
      )}

      <ChangeTable market={result.marketChanges} model={result.modelChanges} />

      <dl className="mt-4 space-y-1 border-t border-border/70 pt-3 text-[11.5px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">읽는 법</dt>
          <dd className="m-0 text-gray-400">
            실질금리가 끌어올린 상승은 「돈값 자체가 비싸진 것」이라 성장주·금에 더 무겁고, 기대인플레가 끌어올린 상승은
            물가 걱정입니다. 텀 프리미엄이 오르면 정책 기대와 상관없이 장기채를 들고 있는 값을 더 요구한다는 뜻입니다.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">말할 수 없는 것</dt>
          <dd className="m-0 text-gray-400">
            두 분해는 축이 달라 서로 더하지 않습니다. 기대인플레(BEI)에는 물가연동국채의 유동성 웃돈이 섞여 위기 때 낮게
            잡힙니다. Kim–Wright는 모형 추정치라 다른 모형(뉴욕 연준 ACM)과 값이 다르고 수정될 수 있습니다.
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-gray-600">
        출처: FRED DGS10 · DFII10 · T10YIE · THREEFY10 · THREEFYTP10(연준 이사회). 기대 단기금리는 적합 10년 − 텀
        프리미엄으로 계산했습니다.
      </p>
    </Card>
  );
}
