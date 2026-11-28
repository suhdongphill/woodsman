/**
 * 유가 전가 점검표 카드(2026-11-25 · ⑤-3) — /macro/inflation(물가 압력) 맨 위.
 *
 * 독자 질문: 「유가가 내렸는데 주유소 값과 물가는 언제·얼마나 따라오나? 덜 내려온 몫은 어디에 남아 있나?」
 * ⚠ 비율의 해석 기준(몇 %면 정상)은 두지 않는다 — 관측값과 원문 확인한 문헌 메모만 낸다.
 */
import { Fragment } from "react";
import { Card } from "@/components/ui/Card";
import type { PassRate, PassThrough } from "@/lib/macro/oil-passthrough";

const usd = (n: number) => `$${n.toFixed(2)}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

function PassCell({ pass }: { pass: PassRate }) {
  if (pass.kind === "rate") return <span className="text-gray-200">{Math.round(pass.value * 100)}%</span>;
  if (pass.kind === "opposite") return <span className="text-gray-500">방향 다름</span>;
  if (pass.kind === "small") return <span className="text-gray-500">변화 작음</span>;
  return <span className="text-gray-600">—</span>;
}

export function OilPassThroughCard({ result }: { result: PassThrough }) {
  const weeks = result.rows[0]?.changes.map((c) => c.weeks) ?? [];
  return (
    <Card padding="p-5 sm:p-6">
      <p className="text-[11px] font-semibold tracking-wide text-gray-500">
        유가 전가 점검표 — 원유 → 도매 → 주유소 → 물가 · <span className="font-normal">{result.asOf} 주 기준</span>
      </p>
      {result.sentence && <p className="mt-2 text-[13.5px] leading-relaxed text-gray-300">{result.sentence}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-right text-[12px] tabular-nums">
          <caption className="mb-1 text-left text-[11.5px] text-gray-500">
            달러/갤런 · 변화는 같은 주끼리 · 전가율 = 이 단계 변화 ÷ 앞 단계 변화
          </caption>
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 text-left font-normal">단계</th>
              <th className="py-1 font-normal">지금</th>
              {weeks.map((w) => (
                <th key={w} className="py-1 font-normal" colSpan={2}>
                  {w}주 변화 · 전가율
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {result.rows.map((row) => (
              <tr key={row.key} className="border-t border-border/60">
                <td className="py-1.5 text-left text-gray-400">{row.label}</td>
                <td className="py-1.5">{row.level === undefined ? "—" : usd(row.level)}</td>
                {row.changes.map((c) => (
                  <Fragment key={c.weeks}>
                    <td className="py-1.5 pl-3 font-semibold text-ink">
                      {c.delta === undefined ? "—" : signed(c.delta)}
                    </td>
                    <td className="py-1.5 pl-2">
                      {row.upstream ? <PassCell pass={c.pass} /> : <span className="text-gray-600">기준</span>}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
        {result.margins.map((m) => (
          <div key={m.fuel} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-[11px] text-gray-500">{m.fuel} 소매 마진(주유소 − 도매)</dt>
            <dd className="mt-0.5 tabular-nums text-gray-300">
              지금 {m.now === undefined ? "—" : usd(m.now)}
              <span className="text-gray-500"> · 지난 52주 평균 {m.avg52 === undefined ? "—" : usd(m.avg52)}</span>
            </dd>
          </div>
        ))}
        <div className="rounded-lg border border-border px-3 py-2">
          <dt className="text-[11px] text-gray-500">다음 CPI 휘발유 미리 보기</dt>
          <dd className="mt-0.5 tabular-nums text-gray-300">
            {result.cpiPreview ? (
              <>
                주유소 값 {result.cpiPreview.month} 평균은 {result.cpiPreview.prevMonth}보다{" "}
                <strong>{pct(result.cpiPreview.change)}</strong>
                <span className="text-gray-500"> ({result.cpiPreview.weeks}주분)</span>
              </>
            ) : (
              "—"
            )}
            {result.cpiGasolineMom && (
              <span className="block text-gray-500">
                최신 CPI 휘발유 {result.cpiGasolineMom.month} 전월비 {pct(result.cpiGasolineMom.value)}
              </span>
            )}
          </dd>
        </div>
        {result.secondRound.map((s) => (
          <div key={s.pair} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-[11px] text-gray-500">2차 전가 · {s.pair} (전년비)</dt>
            <dd className="mt-0.5 tabular-nums text-gray-300">
              {s.upstream ? `${s.upstream.label} ${pct(s.upstream.yoy)}` : "—"}
              <span className="text-gray-500"> → </span>
              {s.cpi ? `${s.cpi.label} ${pct(s.cpi.yoy)} (${s.cpi.month})` : "—"}
              {s.cpi?.skipped && (
                <span className="mt-0.5 block text-[11px] text-gray-500">
                  {s.cpi.skipped}분은 1년 전 값이 원출처에 없어 전년비를 계산하지 않았습니다 — {s.cpi.month}분을 보여 드립니다.
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 space-y-1 border-t border-border/70 pt-3 text-[11.5px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">읽는 법</dt>
          <dd className="m-0 text-gray-400">
            전가율이 낮고 소매 마진이 평소보다 넓으면, 내린 원가가 주유소 단계에 아직 남아 있다는 뜻입니다. 미국 연구에서
            원유 가격이 오르면 주유소 값에 거의 4주 안에 반영됐지만, 내리면 8주에 걸쳐 천천히 반영됐습니다
            (Borenstein·Cameron·Gilbert 1997, QJE — 비대칭은 주로 도매 → 소매 단계).
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">말할 수 없는 것</dt>
          <dd className="m-0 text-gray-400">
            가을에는 휘발유가 겨울용 규격으로 바뀌어 도매가가 계절적으로 내립니다(13주 변화에 섞임). 소매 마진에는
            세금·유통비가 들어 있어 0이 되지 않습니다. CPI는 계절조정 값이라 주유소 월평균과 다를 수 있고, 이 표는 근원
            물가로의 전가를 직접 재지 않습니다.
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-gray-600">
        출처: FRED DCOILWTICO · DGASUSGULF · DDFUELUSGULF · DJFUELUSGULF(EIA) · GASREGW · GASDESW(EIA 주간) ·
        CUSR0000SETB01 · CUSR0000SETG01 · CUSR0000SAS4(BLS). 1배럴 = 42갤런.
      </p>
    </Card>
  );
}
