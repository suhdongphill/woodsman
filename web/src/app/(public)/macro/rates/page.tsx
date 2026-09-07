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

/** 고용 발표본 한 달치. ⚠ `revised`가 false면 「수정 0」이 아니라 **아직 기회가 없었던 것**이다. */
type RevisionMonth = {
  month: string;
  first_vintage: string;
  first_change: number | null;
  latest_vintage: string;
  latest_change: number | null;
  revision: number | null;
  revised: boolean;
};

/** 천 명 단위 증감. 부호를 반드시 붙인다 — 「+21」과 「21」은 다른 말이다. */
const thousands = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("ko-KR")}천`;

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
  /** 내보낸 기간. ⚠ 화면이 임의로 정하지 않는다 — `rates.json`이 담은 만큼만 그린다. */
  const span = data.meta.history_months ?? 84;
  const obs = (id: string, months = span) => tail(series(id)?.observations ?? [], months);
  /** 범례 이름에 붙는 원출처. 7년보다 긴 흐름은 여기로 넘긴다. */
  const src = (id: string) => series(id)?.source_url;

  const realPolicy = metric("real_policy_rate");
  const headline = metric("real_policy_rate_headline");
  const passive6 = metric("passive_tightening_6m");
  const spread = metric("two_speed_spread");
  const adjUnrate = metric("participation_adjusted_unrate");
  const gap = metric("participation_gap");
  const cooling = metric("labor_cooling");
  const wage = metric("wage_yoy");
  const payems3m = metric("payems_change_3m_avg");
  const revisions = metric("payems_revisions");
  const revisionMonths =
    ((revisions?.inputs as { months?: RevisionMonth[] })?.months ?? []).filter((m) => m.revised);
  const priceGap = metric("headline_trimmed_gap");
  const netLiq = metric("net_liquidity");
  const spread30 = metric("spread_30y_10y");
  const tenors = [
    { key: "ust_3m", label: "3개월", id: "dgs3mo" },
    { key: "ust_2y", label: "2년", id: "dgs2" },
    { key: "ust_10y", label: "10년", id: "dgs10" },
    { key: "ust_30y", label: "30년", id: "dgs30" },
  ].map((t) => ({ ...t, m: metric(t.key) }));
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

      {/* 2. 국채 만기별 — 커브의 모양 */}
      <Card id="curve" className="mb-6">
        <CardTitle>국채 만기별</CardTitle>
        <p className="mb-3 text-[12px] text-muted">
          ⚠ <strong>어느 만기가 움직였는지</strong>가 원인을 가릅니다. 짧은 쪽이 오르면 연준
          이야기고, 긴 쪽이 오르면 재정·기간프리미엄 이야기입니다.
        </p>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tenors.map((t) => {
            const change = (t.m?.inputs as { change_bp?: number | null })?.change_bp ?? null;
            return (
              <li
                key={t.key}
                id={t.id}
                className="rounded-xl border border-border px-3 py-2.5"
              >
                <p className="text-[11px] text-muted">{t.label}</p>
                <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">
                  {formatMetric(t.m?.value, "percent")}
                </p>
                {/* ⚠ 「전일」이 아니라 직전 관측일 대비다 — 휴장일이 있다. */}
                <p className="text-[11px] tabular-nums text-ink-3">
                  {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}bp`}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-muted">
            30년−10년{" "}
            <strong className="tabular-nums text-ink">
              {formatMetric(spread30?.value, "percent")}
            </strong>
            p
          </span>
          <span className="text-muted">
            10년−2년{" "}
            <strong className="tabular-nums text-ink">
              {formatMetric(latestObservation(series("T10Y2Y"))?.[1] ?? null, "percent")}
            </strong>
            p
          </span>
        </div>

        <ReadingNote
          how="같은 10년 금리라도 짧은 쪽이 함께 올랐으면 정책 기대가, 긴 쪽만 올랐으면 재정·수급이 움직인 것입니다. 30년−10년은 커브의 긴 쪽 기울기입니다."
          cannot="bp 변화는 직전 관측일 대비라 휴장이 끼면 하루가 아닙니다. 그리고 무엇이 원인인지는 이 표가 아니라 그날의 사건이 말합니다."
        />
      </Card>

      {/* 3. 물가 — 세 값의 거리 */}
      <Card id="inflation-gap" className="mb-6">
        <CardTitle>물가 — 헤드라인과 절사평균의 거리</CardTitle>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-ink">
            헤드라인 PCE{" "}
            <strong className="tabular-nums">
              {formatMetric(
                (priceGap?.inputs as { headline_yoy?: number })?.headline_yoy ?? null,
                "percent",
              )}
            </strong>
          </span>
          <span className="text-muted">
            근원{" "}
            <strong className="tabular-nums">
              {formatMetric((priceGap?.inputs as { core_yoy?: number })?.core_yoy ?? null, "percent")}
            </strong>
          </span>
          <span className="text-muted">
            절사평균{" "}
            <strong className="tabular-nums">
              {formatMetric((priceGap?.inputs as { trimmed?: number })?.trimmed ?? null, "percent")}
            </strong>
          </span>
        </div>

        {/* ⚠ 이 카드의 주인공은 세 값이 아니라 그 사이 거리다 — 격차 자체가 증거다. */}
        <div className="rounded-xl border border-gold-600/30 px-3 py-2.5">
          <p className="text-[12px] text-muted">헤드라인 − 절사평균</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink">
            {formatMetric(priceGap?.value, "percent")}
            <span className="ml-1 text-sm font-normal text-gray-500">p</span>
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-gold-500">
            {priceGap?.value === null || priceGap?.value === undefined
              ? "아직 산출되지 않았습니다"
              : priceGap.value >= 1
                ? "격차가 큽니다 — 높은 물가의 상당 부분이 공급 요인 쪽입니다"
                : priceGap.value <= 0.3
                  ? "격차가 좁습니다 — 기저 물가 자체의 문제로 읽습니다"
                  : "격차가 중간입니다 — 공급과 기저가 섞여 있습니다"}
          </p>
        </div>

        <ReadingNote
          how="절사평균만 보면 물가는 거의 잡혔고, 헤드라인만 보면 아직 멉니다. 둘 다 맞는 말이라 나란히 놓습니다 — 그 사이 거리가 공급 요인의 크기입니다."
          cannot="어떤 공급 요인인지(에너지·식품·관세)는 이 격차가 구분하지 못합니다. 절사평균은 양 끝을 잘라낸 값이라, 그 끝에 무엇이 있었는지도 말하지 않습니다."
        />
      </Card>

      {/* 4. 순유동성 — 수준이 아니라 방향 */}
      <Card id="net-liquidity" className="mb-6">
        <CardTitle>순유동성</CardTitle>
        <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-1">
          <span className="text-2xl font-bold tabular-nums text-ink">
            {formatMetric(netLiq?.value, "trillions_usd")}
          </span>
          {/* ⚠ 수준만으로는 「민간이 연준을 상쇄하는가」에 답할 수 없다. 방향이 답이다. */}
          {[4, 13].map((weeks) => {
            const change = metric(`net_liquidity_change_${weeks}w`);
            const v = change?.value;
            return (
              <span key={weeks} className="text-[13px] text-muted">
                {weeks}주{" "}
                <strong className="tabular-nums text-ink">
                  {v === null || v === undefined
                    ? "—"
                    : `${v > 0 ? "▲ +" : v < 0 ? "▼ " : ""}${v.toFixed(2)}조`}
                </strong>
                {change?.band && (
                  <span className="ml-1 text-[11px] text-ink-3">
                    {BAND_LABEL[change.band] ?? change.band}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* ⚠ 구성 항목을 다 보인다 — 독자가 계산을 되짚을 수 있어야 한다. */}
        <ul className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "연준 총자산", key: "walcl_tn", sign: "" },
            { label: "재무부 일반계정", key: "tga_tn", sign: "−" },
            { label: "역레포", key: "rrp_tn", sign: "−" },
          ].map((part) => (
            <li key={part.key} className="rounded-xl border border-border px-2.5 py-2">
              <p className="text-[10.5px] text-muted">
                {part.sign} {part.label}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
                {formatMetric(
                  (netLiq?.inputs as Record<string, number | undefined>)?.[part.key] ?? null,
                  "trillions_usd",
                )}
              </p>
            </li>
          ))}
        </ul>

        <ReadingNote
          how="연준 총자산에서 재무부 계정과 역레포를 뺀 값이 시장에 실제로 남아 있는 돈입니다. 늘고 있으면 민간 자금이 긴축을 상쇄하는 쪽이고, 줄고 있으면 상쇄하지 못하는 쪽입니다."
          cannot="이 돈이 어디로 갔는지는 말하지 않습니다. 그리고 주간 계열이라 4주 변화도 관측 네 점의 차이일 뿐입니다."
        />
      </Card>

      {/* 5. 실질 정책금리 */}
      <Card id="real-policy-rate" className="mb-6">
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
            { label: "명목 정책금리 (DFF)", observations: obs("DFF"), sourceUrl: src("DFF") },
            {
              label: "절사평균 PCE",
              observations: obs("PCETRIM12M159SFRBDAL"),
              sourceUrl: src("PCETRIM12M159SFRBDAL"),
            },
          ]}
          guides={[{ value: 2, label: "물가목표 2%" }]}
          format={pct}
          spanMonths={span}
          ariaLabel="명목 정책금리와 절사평균 물가상승률 추이"
        />

        <ReadingNote
          how="명목금리가 그대로여도 물가가 내려가면 실질금리는 오릅니다 — 조이지 않았는데 조여집니다. 두 기준의 차이가 공급 요인이 만든 착시의 크기입니다."
          cannot="이 값 하나로 정책이 제약적인지는 판정되지 않습니다. 중립금리(r*)와 견줘야 하는데 그건 추정치이고 기관마다 다릅니다."
        />
      </Card>

      {/* 6. 두 속도 경제 */}
      <Card id="two-speed" className="mb-6">
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

      {/* 7. 노동시장 */}
      <Card id="labor" className="mb-6">
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

        {/*
          ⚠ 한 달 값은 노이즈이고, 게다가 **나중에 수정된다.** 그래서 고용은 3개월 평균으로,
             임금은 전년비로 본다 — 수준(달러)은 그대로 읽을 값이 아니다.
        */}
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border px-3 py-2.5">
            <p className="text-[11px] text-muted">비농업 고용 · 월 증감 3개월 평균</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">
              {payems3m?.value === null || payems3m?.value === undefined
                ? "—"
                : `${payems3m.value > 0 ? "+" : ""}${Math.round(payems3m.value).toLocaleString("ko-KR")}천 명`}
            </p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5">
            <p className="text-[11px] text-muted">시간당 평균임금 (전년비)</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">
              {formatMetric(wage?.value, "percent")}
            </p>
          </div>
        </div>

        <RatesChart
          lines={[
            { label: "실업률", observations: obs("UNRATE"), sourceUrl: src("UNRATE") },
            { label: "경제활동참가율", observations: obs("CIVPART"), sourceUrl: src("CIVPART") },
          ]}
          format={pct}
          spanMonths={span}
          ariaLabel="실업률과 경제활동참가율 추이"
        />

        {/*
          ⚠ **이 사이트가 계속 하는 말이 「숫자는 개정된다」인데, 화면은 개정된 뒤의 값만
             보여 주고 있었다.** 발표 당시와 지금을 나란히 놓는 것이 그 말의 증거다.
          ⚠ 개정된 값이 「틀린 값」이 아니다 — 둘 다 그때의 최선이었다. 문구를 그렇게 쓴다.
          ⚠ 아직 한 번만 발표된 달은 **싣지 않는다.** 「수정 0」으로 보이면 개정될 기회가
             없었던 것과 개정이 없었던 것이 같아 보인다.
        */}
        {revisionMonths.length > 0 && (
          <div className="mt-3 rounded-xl border border-border px-3 py-2.5">
            <p className="text-[12px] font-medium text-ink">발표 당시와 지금</p>
            <ul className="mt-1.5 space-y-1">
              {revisionMonths.map((m) => (
                <li key={m.month} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-mono tabular-nums text-ink-3">{m.month.slice(0, 7)}</span>
                  <span className="tabular-nums text-muted">{thousands(m.first_change)}</span>
                  <span aria-hidden className="text-ink-3">→</span>
                  <span className="tabular-nums font-semibold text-ink">
                    {thousands(m.latest_change)}
                  </span>
                  <span className="tabular-nums text-gold-500">
                    (수정 {thousands(m.revision)})
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              ⚠ 개정된 값이 틀린 값이 아닙니다 — 둘 다 그때의 최선입니다. 첫 발표는 표본이
              덜 걷힌 상태에서 나옵니다.
            </p>
          </div>
        )}

        <p className="mt-2 text-[11.5px] text-ink-3">
          ⚠ 참가율 조정 실업률은{" "}
          <strong>{String((adjUnrate?.inputs as { base_month?: string })?.base_month ?? "?")}</strong>{" "}
          참가율로 고정해 계산했습니다 — 기준을 바꾸면 값이 크게 달라집니다.
        </p>

        <ReadingNote
          how="해고가 없어도 채용이 멈추면 노동시장은 식습니다. 「저채용·저해고」가 그 상태입니다. 임금 전년비를 물가와 견주면 실질 임금이 오르는지 내리는지가 보입니다."
          cannot="참가율이 왜 떨어졌는지(은퇴·이민·돌봄)는 이 숫자가 구분하지 못합니다. ⚠ 위의 3개월 평균은 **이미 수정된 값**으로 계산한 것입니다 — 발표 당시가 궁금하면 「발표 당시와 지금」을 보세요."
        />
      </Card>

      {/* 8. 한·미 */}
      <Card id="kr-us" className="mb-6">
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
            { label: "미 국채 10년", observations: obs("DGS10", 60), sourceUrl: src("DGS10") },
            {
              label: "한국 국고채 10년",
              observations: obs("ECOS:817Y002:010210000", 60),
              sourceUrl: src("ECOS:817Y002:010210000"),
            },
          ]}
          format={pct}
          spanMonths={60}
          ariaLabel="미 국채 10년과 한국 국고채 10년 추이"
        />

        <ReadingNote
          how="양수는 미국 금리가 더 높다는 뜻입니다. 차이가 벌어지면 원화에 압력이 됩니다."
          cannot="함께 움직인 정도일 뿐 인과가 아닙니다. 환율은 금리차 말고도 여러 힘을 함께 받습니다."
        />
      </Card>

      {/* 9. 원계열 */}
      <Card id="series" padding="p-0">
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

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        이 화면은 최근 {Math.round(span / 12)}년치를 그립니다. 그보다 긴 역사는 계열 ID를 누르면
        원출처(FRED·한국은행 ECOS)에서 전체 기간으로 볼 수 있습니다 — 긴 역사는 원출처가 우리보다
        잘 보여줍니다.
      </p>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        지표의 정의와 계산식은 <code>docs/금리섹션_지표해설.md</code>가 단일 출처입니다. 값은{" "}
        <Link href="/macro" className="underline underline-offset-2 hover:text-ink">
          거시 지표
        </Link>{" "}
        화면과 같은 원자료(FRED·한국은행)에서 옵니다.
      </p>
    </main>
  );
}
