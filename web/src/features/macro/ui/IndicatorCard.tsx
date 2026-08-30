/**
 * 지표 하나를 설명까지 붙여 보여주는 카드(그룹 상세용).
 *
 * ## 읽는 순서를 강제한다
 * 처음 온 사람은 숫자를 봐도 뭘 해야 할지 모른다. 그래서 카드 안의 순서를 고정했다.
 *   ① 이름과 지금 값(제일 큼)  ② 상태 배지  ③ 그림  ④ 이게 뭔가 / 왜 보나 / 어떻게 읽나
 *   ⑤ 어디서 온 숫자인가(출처 링크)
 * 설명을 접어 두지 않는다 — 초보자에게 접힌 설명은 없는 설명이고, 펼친 텍스트는
 * 검색엔진이 읽는 본문이 된다.
 */
import { Card } from "@/components/ui/Card";
import { Emphasis } from "@/components/ui/Emphasis";
import { cx } from "@/lib/format";
import { chartBaseline, formatIndicatorValue } from "@/lib/macro/series";
import type { IndicatorView } from "../service";
import { SeriesChart } from "./SeriesChart";
import { SignalPill } from "./SignalPill";
import { FreshnessBadge, LayerChip, StateDependencyNote } from "./Freshness";

function ChangeNote({ view }: { view: IndicatorView }) {
  if (view.change === undefined) return null;
  const up = view.change > 0;
  const flat = view.change === 0;

  return (
    <span
      className={cx(
        "text-[12px] tabular-nums",
        flat ? "text-gray-500" : up ? "text-up" : "text-down",
      )}
    >
      {/* 화살표는 방향, 글자는 값 — 색이 없어도 읽힌다 */}
      <span aria-hidden="true">{flat ? "→" : up ? "▲" : "▼"}</span> 직전 대비{" "}
      {view.changeDisplay}
    </span>
  );
}

export function IndicatorCard({ view }: { view: IndicatorView }) {
  const { indicator } = view;
  const baseline = chartBaseline(indicator);
  const format = (v: number) => formatIndicatorValue(indicator, v);

  return (
    <Card className="scroll-mt-24" padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* h3: 그룹 상세의 h1(그룹명) 아래 단계 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <LayerChip layer={indicator.layer} />
            <h3 id={indicator.key} className="text-[15px] font-semibold text-ink">
              {indicator.name}
            </h3>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
            <span className={cx(view.freshness.stale && "text-amber-300/80")}>
              {view.asOf ? `${view.asOf} 기준` : "아직 수집되지 않음"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{indicator.sourceLabel}</span>
            <FreshnessBadge freshness={view.freshness} />
          </p>
        </div>
        {indicator.signal ? (
          <SignalPill status={view.status} />
        ) : (
          <span className="text-[11px] text-gray-600">참고 지표</span>
        )}
      </div>

      {/*
        ⚠ 낡은 값을 **지우지 않고 흐리게** 낸다. 숨기면 "값이 없다"와 구분이 안 되고,
          그대로 진하게 두면 오늘 값처럼 읽힌다. 회색이 그 사이를 말한다.
      */}
      <div
        className={cx(
          "mt-3 flex flex-wrap items-baseline gap-3",
          (view.freshness.stale || view.freshness.stalled) && "opacity-55",
        )}
      >
        <strong className="text-3xl font-bold tabular-nums text-ink">{view.display}</strong>
        <ChangeNote view={view} />
      </div>

      {indicator.stateDependency && <StateDependencyNote text={indicator.stateDependency} />}

      {indicator.signal && (
        <p className="mt-2 text-[12px] text-gray-400">
          <span className="text-gray-500">판정 기준</span> · {indicator.signal.rule}
        </p>
      )}

      <div className="mt-4">
        <SeriesChart
          points={view.points}
          label={indicator.name}
          format={format}
          baseline={baseline?.value}
          baselineLabel={baseline?.label}
        />
      </div>

      <dl className="mt-5 space-y-3 border-t border-border/70 pt-4 text-[13px] leading-relaxed">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gold-400">
            이게 뭔가요
          </dt>
          <dd className="mt-1 text-gray-300">
            <Emphasis text={indicator.what} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gold-400">
            왜 보나요
          </dt>
          <dd className="mt-1 text-gray-300">
            <Emphasis text={indicator.why} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gold-400">
            어떻게 읽나요
          </dt>
          <dd className="mt-1 text-gray-300">
            <Emphasis text={indicator.read} />
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-[11px] text-gray-600">
        <a
          href={indicator.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline hover:text-gold-400"
        >
          {indicator.name} 원본 데이터 확인하기
        </a>
      </p>
    </Card>
  );
}

/**
 * 목록·요약에서 쓰는 작은 줄 — 이름·값·상태만.
 *
 * ⚠ 아직 수집되지 않은 지표를 **`—` 한 글자로 내지 않는다**(2026-08-22 점검).
 *   그 대시는 "값이 0에 가깝다"로도, "화면이 고장났다"로도 읽혔다. 상세 카드는 이미
 *   "아직 수집되지 않음"이라고 말하고 있었는데 목록만 말하지 않고 있었다
 *   — CLAUDE.md §3의 "'값이 없음'과 '읽지 못함'이 같은 화면이 되지 않게"와 같은 규칙이다.
 */
export function IndicatorRow({ view }: { view: IndicatorView }) {
  const collected = view.value !== undefined;
  // 판정 지표는 배지가 이미 '○ 미수집'이라고 말한다 — 같은 말을 두 번 쓰지 않는다.
  const hasPill = !!view.indicator.signal;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-[12.5px] text-gray-400">{view.indicator.name}</span>
      <span className="flex shrink-0 items-center gap-2">
        <FreshnessBadge freshness={view.freshness} />
        {collected ? (
          <span
            className={cx(
              "text-[13px] font-semibold tabular-nums text-ink",
              (view.freshness.stale || view.freshness.stalled) && "opacity-55",
            )}
          >
            {view.display}
          </span>
        ) : hasPill ? null : (
          <span className="text-[11.5px] text-gray-600">아직 수집 안 됨</span>
        )}
        {hasPill && <SignalPill status={view.status} />}
      </span>
    </div>
  );
}
