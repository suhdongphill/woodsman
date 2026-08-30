import { LinkButton } from "@/components/ui/Button";
import { ArrowRightIcon, ExternalIcon } from "@/components/icons";
import { outboundHref } from "@/lib/outbound";
import type { PerformanceSummary } from "@/lib/performance";
import type { Rebalance } from "@/lib/types";

/**
 * 첫 화면 — 문구 + CTA + 기록의 두께.
 *
 * ## ⚠ 2026-08-30(Step 2): 계좌 카드를 내렸다
 * 여기 오른쪽에 **계좌 평가액 카드**가 있었다. 그런데 검색으로 들어온 사람은 남의 계좌
 * 숫자를 찾아온 게 아니고, 이 사이트의 1순위 목적은 **블로그로 넘기는 것**이다.
 * 계좌는 지우지 않고 **콘텐츠 뒤로 옮겼다**(`AccountStrip`) — 입구는 콘텐츠가 맡고,
 * 계좌는 그 흐름에 대한 **나의 답**으로 따라붙는다.
 *
 * ⚠ **숫자 셋(기록 개월·투자일지·리밸런싱)은 남긴다.** 이건 계좌 잔고가 아니라
 *    **기록이 얼마나 두꺼운가**이고, 처음 온 사람에게 이 사이트가 무엇인지 말해 준다.
 *    셋 다 0이어도 그대로 둔다 — 0은 "아직 없다"는 사실이고, 사실은 감추지 않는다.
 *
 * ## ⚠ 2026-08-30(Step 3): 첫 줄이 **오늘의 바람**이 됐다
 * "일기예보를 보고 우산을 챙기듯" 읽는 자리라면, 들어오자마자 **오늘의 하늘**이 보여야 한다.
 * 그 한 줄은 `lib/home-lede.ts`가 만들고, ⚠ **만들 수 없으면 null이다** — 없는 상태를
 * 그럴듯한 문장으로 덮지 않는다.
 *
 * ⚠ 「블로그에서 이어 읽기」는 **반드시 `/go/…` 경유**다. 주소를 직접 걸면 나가는 클릭이
 *    안 세지고, 그러면 이 사이트의 1순위 지표가 빈다(2026-08-25 결정).
 */
export function HeroSection({
  heroTitle,
  heroSubtitle,
  lede,
  perf,
  rebalances,
  journalCount,
  indicatorCount,
}: {
  heroTitle: string;
  heroSubtitle: string;
  /** 오늘의 바람 한 줄. ⚠ 값이 없으면 null이고, 그때는 줄 자체를 그리지 않는다 */
  lede: string | null;
  perf: PerformanceSummary | null;
  rebalances: Rebalance[];
  journalCount: number;
  /** 값이 실제로 쌓인 거시 지표 수 */
  indicatorCount: number;
}) {
  /**
   * ⚠ **기록 셋이 모두 0이면 다른 것을 보여 준다**(2026-08-30 독자 관점 점검).
   *
   * 처음 온 사람에게 「기록 개월 0 · 투자일지 0건 · 리밸런싱 0회」는
   * **"아무것도 없는 사이트"** 로 읽힌다. 0을 감추자는 게 아니라,
   * **실제로 있는 것**(추적 중인 거시 지표)을 대신 말하자는 것이다 —
   * 계좌 기록이 시작되면 원래 셋으로 돌아온다.
   */
  const hasRecord = (perf?.months ?? 0) > 0 || journalCount > 0 || rebalances.length > 0;
  const stats = hasRecord
    ? [
        { label: "기록 개월", value: String(perf?.months ?? 0) },
        { label: "투자일지", value: `${journalCount}건` },
        { label: "리밸런싱", value: `${rebalances.length}회` },
      ]
    : [
        { label: "추적 중인 지표", value: `${indicatorCount}개` },
        { label: "계좌 기록", value: "준비 중" },
        { label: "공개 방식", value: "모의 투자" },
      ];
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(700px 320px at 12% -10%, rgba(201,166,87,.16), transparent 60%), radial-gradient(600px 300px at 88% 0%, rgba(54,160,106,.14), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <div className="fade-up max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-[11px] text-gold-400">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-glow" />
            CULTIVATING WEALTH LIKE A FOREST
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink leading-[1.25] tracking-tight">
            {heroTitle}
          </h1>

          {/* 오늘의 바람 — 값이 없으면 이 줄은 아예 없다(지어내지 않는다). */}
          {lede && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 px-3.5 py-2 text-[12.5px] text-gray-300 backdrop-blur">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {lede}
            </p>
          )}
          <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">{heroSubtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/macro" variant="gold" size="lg">
              지금 시장 읽기
              <ArrowRightIcon size={16} />
            </LinkButton>
            {/* ⚠ 1순위 목적이 블로그 유입이다. 그 버튼이 첫 화면에 있어야 한다. */}
            <LinkButton href={outboundHref("tistory")} variant="outline" size="lg">
              블로그에서 이어 읽기
              <ExternalIcon size={14} />
            </LinkButton>
          </div>
          <dl className="mt-9 grid grid-cols-3 gap-4 max-w-md">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-[11px] text-gray-500">{s.label}</dt>
                <dd className="text-xl font-bold text-ink tabular-nums mt-0.5">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
