/**
 * 자본 엔진 카드 — 「수요를 죽여 물가를 잡는가, 공급을 늘려 흡수하는가」.
 *
 * ## 이 카드가 신뢰를 얻는 방식
 * 이 화면의 두 숫자는 **표준 지표가 아니라 우리가 계산한 것**이다. 그러면 독자가 믿을 이유가
 * 없다. 그래서 믿을 이유를 카드 안에 전부 넣는다.
 *
 * 1. ⭐ **우리가 만든 이름이라고 먼저 말한다.** 남의 권위를 빌리지 않는다.
 * 2. ⭐ **계산식을 적는다.** 뺄셈 하나라서 독자가 직접 검산할 수 있다.
 * 3. ⭐ **투입값마다 값·기준일·1차 출처 링크**를 단다. FRED가 아니라 **BLS·BEA·재무부**다.
 * 4. ⚠ **기준일이 다르다는 것을 숨기지 않는다.** 생산성은 분기 발표라 두 달 넘게 늦다.
 * 5. ⚠ **기준선 0을 긋는다.** 선이 없으면 −0.02%p가 좋은지 나쁜지 알 수 없다.
 * 6. ⚠ **두 읽기(추세·최근분기)를 함께 낸다.** 부호가 갈리면 갈렸다고 적는다.
 * 7. ⚠ **두 격차가 서로 다른 질문**임을 적는다. 엇갈릴 때가 볼 만한 때다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  capitalSentence,
  SPREAD_BASELINE,
  type CapitalSpreads,
  type PrysResult,
  type Spread,
  type SpreadPart,
} from "@/lib/macro/capital";
import { findClaim } from "@/lib/macro/claims";
import { findTerm, sourceNote } from "@/lib/macro/glossary";

/** ⚠ 마이너스는 하이픈이 아니라 −(U+2212)다. 작은 글씨에서 하이픈은 옆 숫자에 붙는다. */
function signed(n: number, digits = 2): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
}

function Part({ part }: { part: SpreadPart }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] text-muted">{part.label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-ink">
        {part.value.toFixed(2)}
        {part.unit}
        {part.asOf && <span className="ml-1.5 text-[10.5px] font-normal text-ink-3">{part.asOf} 기준</span>}
      </dd>
      {part.url && (
        <a
          href={part.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block text-[10.5px] text-ink-3 underline decoration-dotted hover:text-gold-400"
        >
          {part.sourceLabel} ↗
        </a>
      )}
    </div>
  );
}

/** 격차 한 칸. `emphasis`는 0을 넘었는지로 정한다 — 색이 곧 해석이다. */
function SpreadBlock({
  spread,
  question,
  children,
}: {
  spread: Spread;
  question: string;
  children?: React.ReactNode;
}) {
  const positive = spread.value >= SPREAD_BASELINE;
  const term = findTerm(spread.name);

  return (
    <div className="rounded-xl border border-border bg-bg px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">{spread.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">{question}</p>
        </div>
        <p
          className={`text-[22px] font-bold tabular-nums ${positive ? "text-emerald-300" : "text-red-300"}`}
        >
          {signed(spread.value)}%p
        </p>
      </div>

      {/* ⚠ 기준선. 0을 넘었는지가 해석을 뒤집으므로 눈에 보이게 둔다. */}
      <p className="mt-1.5 text-[11px] text-ink-3">
        기준선 <strong className="text-muted">0</strong> · 지금은 0보다{" "}
        <strong className={positive ? "text-emerald-400" : "text-red-400"}>
          {positive ? "위" : "아래"}
        </strong>
        {spread.asOf && ` · ${spread.asOf} 기준`}
        {spread.gapDays !== undefined && spread.gapDays > 0 && (
          <> · ⚠ 투입값 기준일이 {spread.gapDays}일 벌어져 있습니다</>
        )}
      </p>

      {children}

      <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {spread.parts.map((p) => (
          <Part key={p.label} part={p} />
        ))}
      </dl>

      {term && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-3">
          <strong className="text-muted">{term.term}</strong> — {term.short} {sourceNote(term)}
        </p>
      )}
    </div>
  );
}

/** 추세와 최근분기 두 읽기. ⚠ 부호가 갈리면 그 사실이 결론이다. */
function TwoReadings({ prys }: { prys: PrysResult }) {
  return (
    <p
      className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed ${
        prys.split ? "bg-gold-500/10 text-gold-400" : "text-muted"
      }`}
    >
      {prys.quartersUsed}분기 평균으로 재면 <strong className="tabular-nums">{signed(prys.byTrend)}%p</strong>,
      최근 분기만 보면 <strong className="tabular-nums">{signed(prys.byLatest)}%p</strong>
      {prys.split ? (
        <> — ⚠ <strong>부호가 갈립니다.</strong> 어느 쪽이라고 단정하지 않습니다.</>
      ) : (
        <> — 두 읽기가 같은 방향입니다.</>
      )}
    </p>
  );
}

export function CapitalEngineCard({ capital }: { capital: CapitalSpreads }) {
  const { prys, growthFunding: gf } = capital;
  if (!prys && !gf) return null;

  const sentence = capitalSentence(capital);
  /** ⭐ 사장님이 확인을 부탁한 지점 — 법에 쓰인 사실이다. */
  const mandate = findClaim("fed-mandate-potential");

  return (
    <Card padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-gold-600/30 bg-gold-500/10 px-2.5 py-1 text-[11px] font-semibold text-gold-400">
          ⚙ 미국 자본 엔진
        </span>
        <span className="text-[11px] text-gray-500">
          수요를 줄여 물가를 잡는가, 공급을 늘려 흡수하는가
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-gray-400">
        물가를 잡는 길은 둘입니다. 금리를 올려 <strong className="text-ink">수요를 줄이는</strong> 길과,
        생산성을 올려 <strong className="text-ink">공급을 늘리는</strong> 길입니다. 아래 두 숫자는 지금
        어느 쪽 힘이 더 센지를 재려고 우리가 계산한 것입니다.
      </p>

      <div className="mt-4 space-y-3">
        {prys && (
          <SpreadBlock
            spread={prys}
            question="빌려서 투자할 값이 남아 있는가 (민간 CAPEX)"
          >
            <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-muted">
              추세 생산성 증가율 − 실질 10년 금리 = {prys.trend.toFixed(2)} −{" "}
              {prys.parts[1].value.toFixed(2)} = {signed(prys.byTrend)}%p
            </p>
            <TwoReadings prys={prys} />
          </SpreadBlock>
        )}

        {gf && (
          <SpreadBlock spread={gf} question="경제가 이자보다 빨리 자라는가 (부채 지속가능성)">
            <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-muted">
              명목 GDP 증가율 − 10년 국채 금리 = {gf.parts[0].value.toFixed(2)} −{" "}
              {gf.parts[1].value.toFixed(2)} = {signed(gf.value)}%p
            </p>
          </SpreadBlock>
        )}
      </div>

      {sentence && (
        <p className="mt-4 rounded-xl border border-border bg-bg px-3.5 py-3 text-[13px] leading-relaxed text-gray-300">
          {sentence}
        </p>
      )}

      {/* ⭐ 법에 쓰인 사실 — 등급과 원문 링크를 함께 낸다. */}
      {mandate && (
        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-emerald-300">
            사실 · 1차 출처 확인 {mandate.checked}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-300">{mandate.statement}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            {mandate.why}{" "}
            <a
              href={mandate.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted hover:text-gold-400"
            >
              {mandate.sourceLabel} ↗
            </a>
          </p>
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-gray-600">
        ※ <strong>두 격차는 우리가 계산해 붙인 이름이며 표준 지표가 아닙니다.</strong> 뺄셈 하나라서
        위의 투입값으로 직접 검산하실 수 있고, 각 투입값은 원 발표 기관(노동통계국·경제분석국·재무부)으로
        링크해 두었습니다. ⚠ 생산성은 분기 발표라 금리보다 기준일이 늦습니다 — 그래서 이 카드의 기준일은
        <strong> 더 오래된 쪽</strong>으로 적습니다. 여기서 내는 것은 상태 표시까지입니다.{" "}
        <Link href="/disclaimer" className="underline hover:text-gold-400">
          투자 판단 책임 고지
        </Link>
      </p>
    </Card>
  );
}
