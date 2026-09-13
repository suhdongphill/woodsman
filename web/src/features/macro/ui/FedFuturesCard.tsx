/**
 * 선물 내재 정책금리 카드 — **사람들이 거는 것**.
 *
 * `FedHikeCard`(테일러 준칙)가 「모형이 처방하는 것」이라면 이쪽은 「시장이 돈으로 거는 것」이다.
 * 둘을 나란히 두는 것이 이 카드의 목적이고, 벌어질 때가 볼 만한 때다.
 *
 * ## ⚠ 화면이 반드시 말해야 하는 것
 * - **CME 페드워치가 아니다.** 같은 원재료(연방기금 선물)에서 **우리가** 계산한 값이다.
 *   CME는 우리를 막아 두었고(403 + 스크래핑은 약관 위반), 그래서 우리가 계산했다.
 * - **계산식과 입력을 같은 카드에 남긴다.** 되짚을 수 없는 확률은 신뢰가 아니라 장식이다
 *   (`docs/분석_막힌_지표_경로.md` §2).
 * - **가정의 크기를 숨기지 않는다.** 계약월 안의 회의는 「변화 없음」으로 뒀고, 그 가정이
 *   몇 %의 날수에 걸려 있는지 그대로 적는다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { STEP, type FedFuturesResult } from "@/lib/macro/fedfutures";

/** 부호를 붙인 %p. ⚠ 마이너스는 하이픈이 아니라 −(U+2212)다(`series.ts`와 같은 규칙). */
function signed(n: number, digits = 3): string {
  const body = Math.abs(n).toFixed(digits);
  return n >= 0 ? `+${body}` : `−${body}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] tabular-nums text-gray-300">{children}</dd>
    </div>
  );
}

export function FedFuturesCard({
  result,
  asOf,
}: {
  result: FedFuturesResult;
  asOf?: string;
}) {
  const up = result.impliedChange >= 0;
  const dir = up ? "인상" : "인하";
  /** ⚠ 1을 넘을 수 있다 — 「인상 두 번」이면 200%다. 잘라 버리면 그 사실이 사라진다. */
  const share = Math.abs(result.hikeShare);

  return (
    <Card padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            up
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-sky-500/30 bg-sky-500/10 text-sky-300"
          }`}
        >
          📈 시장이 거는 것 · {dir} 쪽
        </span>
        <span className="text-[11px] text-gray-500">
          {asOf ? `${asOf} 선물 종가 기준` : "수집 전"} · {result.contractMonth} 계약
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-300">
        {result.contractMonth} 연방기금 선물이 말하는 그 달 평균 실효금리는{" "}
        <strong className="text-ink">{result.impliedAvg.toFixed(3)}%</strong>입니다. 현재{" "}
        {result.currentRate.toFixed(2)}%보다{" "}
        <strong className={up ? "text-red-300" : "text-sky-300"}>
          {signed(result.impliedChange)}%p
        </strong>{" "}
        {up ? "높습니다" : "낮습니다"}.
      </p>

      {result.singleMeeting ? (
        <div className="mt-4 rounded-xl border border-border bg-bg px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-gray-400">
              {result.reflected[0]} 회의 · {STEP * 100}bp {dir} 한 번을 1로 보면
            </span>
            <span className="text-[17px] font-bold tabular-nums text-gold-400">
              {(share * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold-500"
              style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
            />
          </div>
        </div>
      ) : (
        /* ⚠ 회의 하나의 몫으로 나눌 수 없을 때는 나누지 않는다. 나눠 보이면 그게 답인 줄 안다. */
        <p className="mt-4 rounded-xl border border-border bg-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-gray-400">
          {result.reflected.length > 1
            ? `이 계약에는 회의 ${result.reflected.length}번(${result.reflected.join(" · ")})의 결과가 함께 반영돼 있어, 회의 하나의 몫으로 나눌 수 없습니다. 위 차이는 그 회의들을 합친 기대입니다.`
            : "이 계약에는 계약월 안의 회의만 걸려 있어, 회의 하나의 몫으로 읽을 수 없습니다."}
        </p>
      )}

      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <Row label="선물 가격 → 금리">
          {(100 - result.impliedAvg).toFixed(3)} → {result.impliedAvg.toFixed(3)}%
        </Row>
        <Row label="현재 실효금리">{result.currentRate.toFixed(2)}%</Row>
        <Row label="온전히 반영된 회의">
          {result.reflected.length > 0 ? result.reflected.join(" · ") : "없음"}
        </Row>
      </dl>

      {result.assumedFlat.length > 0 && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-gold-500/90">
          ⚠ 계약월 안에 열리는 {result.assumedFlat.join(" · ")} 회의는{" "}
          <strong>「변화 없음」으로 가정</strong>했습니다. 계약 하나로는 회의 전·후 금리를 함께
          풀 수 없기 때문이고, 그 가정이 이 달 날수의{" "}
          <strong className="tabular-nums">{(result.assumedWeight * 100).toFixed(0)}%</strong>에
          걸려 있습니다.
        </p>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-gray-600">
        ※ 30일 연방기금 선물은 <strong>계약월의 평균 실효금리</strong>를 거래합니다
        (금리 = 100 − 가격). 계약월이 시작되기 전에 열리는 회의의 결과는 그 달 전체에
        반영되므로, 현재 금리와의 차이를 {STEP * 100}bp로 나누면 「인상 한 번」 기준의 비중이
        됩니다. <strong>CME 페드워치가 아니라 선물 가격에서 우리가 계산한 값이며</strong>,
        페드워치와 소수점이 다를 수 있습니다. 확률의 절대 수준이 아니라 방향과 변화로
        읽어 주세요.{" "}
        <Link href="/disclaimer" className="underline hover:text-gold-400">
          투자 판단 책임 고지
        </Link>
      </p>
    </Card>
  );
}
