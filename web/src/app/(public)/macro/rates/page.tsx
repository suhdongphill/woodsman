import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { absoluteUrl } from "@/lib/site-url";
import { seoulDay } from "@/lib/kst";
import {
  BAND_LABEL,
  LAYER_LABEL,
  formatMetric,
  latestObservation,
  staleness,
  tail,
  type RatesPayload,
} from "@/lib/rates";
import { loadRates } from "@/features/rates/repository";
import { RatesChart } from "@/features/rates/ui/RatesChart";

export const metadata: Metadata = {
  title: "금리·거시",
  description:
    "실질 정책금리와 수동적 긴축, 두 속도 경제, 참가율 조정 실업률, 한·미 금리차를 한 화면에서 봅니다. 값의 근거가 된 계열과 관측일을 함께 적습니다.",
  alternates: { canonical: absoluteUrl("/macro/rates") },
};

/** ⚠ 정적 생성 금지 — 스케줄러가 새로 올린 값이 안 보이면 이 화면은 의미가 없다. */
export const dynamic = "force-dynamic";

const pct = (v: number) => `${v.toFixed(1)}%`;

/** 카드마다 붙는 두 줄. ⚠ 문구는 `docs/금리섹션_지표해설.md`에서 가져온다(명세 §6·§9). */
function ReadingNote({ how, cannot }: { how: string; cannot: string }) {
  return (
    <dl className="mt-4 space-y-1 border-t border-border/70 pt-3 text-[11.5px] leading-relaxed">
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted">이 숫자를 읽는 법</dt>
        <dd className="m-0 text-ink-3">{how}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted">이 숫자로 말할 수 없는 것</dt>
        <dd className="m-0 text-ink-3">{cannot}</dd>
      </div>
    </dl>
  );
}

function Gauge({ data }: { data: RatesPayload }) {
  const head = data.headline.easing_pressure_index;
  const missing = head.missing_layers ?? [];
  const value = head.value;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle>인하 압력 지수</CardTitle>
          <p className="mt-1 text-4xl font-bold tabular-nums text-ink">
            {formatMetric(value, "index")}
            <span className="ml-1 text-base font-normal text-gray-500">/ 100</span>
          </p>
          <p className="mt-1.5 text-[12px] text-muted">
            {head.band ? BAND_LABEL[head.band] ?? head.band : "산출되지 않음"} · 높을수록 인하
            논거가 강한 쪽입니다
          </p>
        </div>

        <div className="text-right text-[11.5px] text-ink-3">
          <p>기준일 {data.meta.asof}</p>
          <p>생성 {seoulDay(data.meta.generated_at)}</p>
          {missing.length > 0 && (
            <p className="mt-1 text-gold-500">
              ⚠ 부분 산출 — {missing.join(", ")} 레이어가 빠졌습니다
            </p>
          )}
        </div>
      </div>

      {/* ⚠ 지수 하나로 결론 내지 않게, 반대 논거를 같은 카드에 붙인다. */}
      {data.headline.conflicting_signals.length > 0 && (
        <div className="mt-4 rounded-xl border border-gold-600/30 px-3 py-2.5">
          <p className="text-[12px] font-medium text-gold-500">
            상충 신호 {data.headline.conflicting_signals.length}건
          </p>
          <ul className="mt-1 space-y-0.5">
            {data.headline.conflicting_signals.map((signal) => (
              <li key={signal.key} className="text-[11.5px] leading-relaxed text-muted">
                {signal.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {Object.entries(head.components).map(([layer, score]) => (
          <div key={layer} className="rounded-xl border border-border px-2.5 py-2">
            <p className="text-[10.5px] text-muted">{LAYER_LABEL[layer] ?? layer}</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
              {formatMetric(score, "index")}
            </p>
            {score === null && <p className="text-[10px] text-gold-500">산출 안 함</p>}
          </div>
        ))}
      </div>

      <ReadingNote
        how="다섯 축(물가·노동·정책 제약도·신용·대외)에 인하 논거가 얼마나 쌓였는지를 0~100으로 셉니다."
        cannot="연준이 무엇을 할지는 말하지 않습니다. 각 성분의 기준점은 우리가 고른 값이고, 지표별 근거는 아래 표에서 원계열로 되짚을 수 있습니다."
      />
    </Card>
  );
}

export default async function RatesPage() {
  const data = await loadRates();

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-xl font-semibold text-ink">금리·거시</h1>
        <Card className="mt-5">
          <p className="text-[13px] leading-relaxed text-muted">
            아직 자료가 없습니다. <code>pms rates fetch → compute → export</code> 를 돌리면 이
            화면이 채워집니다.
          </p>
          <p className="mt-2 text-[11.5px] text-ink-3">
            ⚠ 빈 화면을 그리는 대신 왜 비었는지를 적습니다 — 없는 값을 0으로 채우지 않습니다.
          </p>
        </Card>
      </main>
    );
  }

  const today = seoulDay(new Date().toISOString());
  const staleDays = staleness(data.meta, today);
  const metric = (key: string) => data.metrics[key];
  const series = (id: string) => data.series[id];
  const obs = (id: string, months = 120) => tail(series(id)?.observations ?? [], months);

  const realPolicy = metric("real_policy_rate");
  const headline = metric("real_policy_rate_headline");
  const passive6 = metric("passive_tightening_6m");
  const spread = metric("two_speed_spread");
  const adjUnrate = metric("participation_adjusted_unrate");
  const gap = metric("participation_gap");
  const cooling = metric("labor_cooling");
  const policyGap = metric("kr_us_policy_gap");
  const tenGap = metric("kr_us_10y_gap");
  const corr = metric("kr_us_gap_fx_corr");

  const components = Object.entries(data.metrics).filter(([key]) =>
    key.startsWith("two_speed_component_"),
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">금리·거시</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          정책금리가 실제로 얼마나 조이고 있는지, 그 압력이 어디에 닿고 어디에 닿지 않는지를
          봅니다. 모든 숫자는 아래 원계열에서 되짚을 수 있습니다.
        </p>

        {/* ⚠ 낡았으면 낡았다고 먼저 말한다(명세 §7). */}
        {(data.meta.stale || staleDays > 3) && (
          <p role="alert" className="mt-3 rounded-xl border border-gold-600/40 px-3 py-2 text-[12px] text-gold-500">
            ⚠ 이 자료는 {data.meta.asof} 기준입니다({staleDays}일 전). 마지막 갱신이 실패했을 수
            있어 최신값이 아닐 수 있습니다.
          </p>
        )}
        {data.meta.missing_series.length > 0 && (
          <p className="mt-2 text-[11.5px] text-ink-3">
            아직 값이 없는 계열 {data.meta.missing_series.length}개 —{" "}
            <code>{data.meta.missing_series.join(", ")}</code>
          </p>
        )}
      </header>

      <Gauge data={data} />

      {/* 2. 실질 정책금리 */}
      <Card className="mb-6">
        <CardTitle>실질 정책금리</CardTitle>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-ink">
            절사평균 기준 <strong className="tabular-nums">{formatMetric(realPolicy?.value, "percent")}</strong>
          </span>
          <span className="text-muted">
            헤드라인 기준 <strong className="tabular-nums">{formatMetric(headline?.value, "percent")}</strong>
          </span>
          <span className="text-muted">
            수동적 긴축(6개월){" "}
            <strong className="tabular-nums">{formatMetric(passive6?.value, "percent")}</strong>
          </span>
        </div>

        <RatesChart
          lines={[
            { label: "명목 정책금리 (DFF)", observations: obs("DFF", 120) },
            { label: "절사평균 PCE", observations: obs("PCETRIM12M159SFRBDAL", 120) },
          ]}
          guides={[{ value: 2, label: "물가목표 2%" }]}
          format={pct}
          ariaLabel="명목 정책금리와 절사평균 물가상승률 추이"
        />

        <ReadingNote
          how="명목금리가 그대로여도 물가가 내려가면 실질금리는 오릅니다 — 조이지 않았는데 조여집니다. 두 기준의 차이가 공급 요인이 만든 착시의 크기입니다."
          cannot="이 값 하나로 정책이 제약적인지는 판정되지 않습니다. 중립금리(r*)와 견줘야 하는데 그건 추정치이고 기관마다 다릅니다."
        />
      </Card>

      {/* 3. 두 속도 경제 */}
      <Card className="mb-6">
        <CardTitle>두 속도 경제</CardTitle>
        <p className="mb-3 text-[12px] text-muted">
          합성 스프레드 <strong className="tabular-nums text-ink">{formatMetric(spread?.value, "percent")}</strong>
          {spread?.value !== null && spread?.value !== undefined && "p"} — 클수록 금리 전달경로가
          선택적으로만 작동한다는 뜻입니다.
        </p>

        {/* ⚠ 합성값만 보면 어느 부문이 움직였는지 사라진다. 구성 항목을 막대로 함께 보여준다. */}
        <ul className="space-y-2">
          {components.map(([key, item]) => {
            const id = key.replace("two_speed_component_", "").toUpperCase();
            const name = series(id)?.name_ko ?? id;
            const width = item.value === null ? 0 : Math.min(100, Math.abs(item.value) * 4);
            const isSensitive = item.band === "rate_sensitive";
            return (
              <li key={key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[12px] text-ink">{name}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      background: isSensitive ? "var(--w-series-2)" : "var(--w-series-1)",
                    }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-muted">
                  {formatMetric(item.value, "percent")}
                </span>
                <Badge tone="neutral">{BAND_LABEL[item.band ?? ""] ?? "—"}</Badge>
              </li>
            );
          })}
        </ul>

        <ReadingNote
          how="어두운 막대(금리 민감)는 눌리는데 밝은 막대(현금 조달)가 버티면, 금리는 경제의 일부에만 닿고 있는 것입니다."
          cannot="설비투자 실질 계열이 확정되기 전까지 현금 조달 쪽은 기업대출 하나로 계산됩니다 — 부분 산출입니다."
        />
      </Card>

      {/* 4. 노동시장 */}
      <Card className="mb-6">
        <CardTitle>노동시장</CardTitle>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-ink">
            공식 실업률{" "}
            <strong className="tabular-nums">
              {formatMetric(latestObservation(series("UNRATE"))?.[1] ?? null, "percent")}
            </strong>
          </span>
          <span className="text-muted">
            참가율 조정{" "}
            <strong className="tabular-nums">{formatMetric(adjUnrate?.value, "percent")}</strong>
          </span>
          <span className="text-muted">
            격차 <strong className="tabular-nums">{formatMetric(gap?.value, "percent")}</strong>p
          </span>
          <span className="text-muted">
            냉각도 <strong className="tabular-nums">{formatMetric(cooling?.value, "index")}</strong>
            {cooling?.band && <Badge tone="warn">{BAND_LABEL[cooling.band] ?? cooling.band}</Badge>}
          </span>
        </div>

        <RatesChart
          lines={[
            { label: "실업률", observations: obs("UNRATE", 120) },
            { label: "경제활동참가율", observations: obs("CIVPART", 120) },
          ]}
          format={pct}
          ariaLabel="실업률과 경제활동참가율 추이"
        />

        <p className="mt-2 text-[11.5px] text-ink-3">
          ⚠ 참가율 조정 실업률은{" "}
          <strong>{String((adjUnrate?.inputs as { base_month?: string })?.base_month ?? "?")}</strong>{" "}
          참가율로 고정해 계산했습니다 — 기준을 바꾸면 값이 크게 달라집니다.
        </p>

        <ReadingNote
          how="해고가 없어도 채용이 멈추면 노동시장은 식습니다. 「저채용·저해고」가 그 상태입니다."
          cannot="참가율이 왜 떨어졌는지(은퇴·이민·돌봄)는 이 숫자가 구분하지 못합니다."
        />
      </Card>

      {/* 5. 한·미 */}
      <Card className="mb-6">
        <CardTitle>한·미</CardTitle>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-ink">
            정책금리차 <strong className="tabular-nums">{formatMetric(policyGap?.value, "percent")}</strong>p
          </span>
          <span className="text-muted">
            10년 금리차 <strong className="tabular-nums">{formatMetric(tenGap?.value, "percent")}</strong>p
          </span>
          <span className="text-muted">
            환율과 함께 움직인 정도{" "}
            <strong className="tabular-nums">{formatMetric(corr?.value, "correlation")}</strong>
          </span>
        </div>

        <RatesChart
          lines={[
            { label: "미 국채 10년", observations: obs("DGS10", 60) },
            { label: "한국 국고채 10년", observations: obs("ECOS:817Y002:010210000", 60) },
          ]}
          format={pct}
          ariaLabel="미 국채 10년과 한국 국고채 10년 추이"
        />

        <ReadingNote
          how="양수는 미국 금리가 더 높다는 뜻입니다. 차이가 벌어지면 원화에 압력이 됩니다."
          cannot="함께 움직인 정도일 뿐 인과가 아닙니다. 환율은 금리차 말고도 여러 힘을 함께 받습니다."
        />
      </Card>

      {/* 6. 원계열 */}
      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>원계열 ({Object.keys(data.series).length}개)</CardTitle>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-left text-[12px]">
            <thead className="text-[11px] text-muted">
              <tr>
                <th className="py-1.5 pr-3">계열</th>
                <th className="py-1.5 pr-3">이름</th>
                <th className="py-1.5 pr-3 text-right">최신값</th>
                <th className="py-1.5 pr-3">관측일</th>
                <th className="py-1.5">묶음</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.series).map(([id, item]) => {
                const last = latestObservation(item);
                return (
                  <tr key={id} className="border-t border-border/70 align-top">
                    <td className="py-1.5 pr-3">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
                        title={item.definition_ko}
                      >
                        {id}
                      </a>
                    </td>
                    <td className="py-1.5 pr-3 text-ink" title={item.definition_ko}>
                      {item.name_ko}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-ink">
                      {last ? formatMetric(last[1], item.unit) : "미발표"}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-ink-3">
                      {last ? last[0] : "—"}
                    </td>
                    <td className="py-1.5 text-[11px] text-ink-3">
                      {LAYER_LABEL[item.layer ?? ""] ?? item.layer ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-5 text-[11.5px] leading-relaxed text-ink-3">
        지표의 정의와 계산식은 <code>docs/금리섹션_지표해설.md</code>가 단일 출처입니다. 값은{" "}
        <Link href="/macro" className="underline underline-offset-2 hover:text-ink">
          거시 지표
        </Link>{" "}
        화면과 같은 원자료(FRED·한국은행)에서 옵니다.
      </p>
    </main>
  );
}
