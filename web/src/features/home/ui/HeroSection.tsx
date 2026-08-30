import { LinkButton } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/icons";
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
 * ⚠ Step 3에서 여기에 **거시 한 줄 요약**과 「블로그에서 이어 읽기」가 붙는다.
 */
export function HeroSection({
  heroTitle,
  heroSubtitle,
  perf,
  rebalances,
  journalCount,
}: {
  heroTitle: string;
  heroSubtitle: string;
  perf: PerformanceSummary | null;
  rebalances: Rebalance[];
  journalCount: number;
}) {
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
          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-[42px] font-bold text-white leading-[1.25] tracking-tight">
            {heroTitle}
          </h1>
          <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">{heroSubtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/macro" variant="gold" size="lg">
              지금 시장 읽기
              <ArrowRightIcon size={16} />
            </LinkButton>
            <LinkButton href="/insights" variant="outline" size="lg">
              인사이트 보기
            </LinkButton>
          </div>
          <dl className="mt-9 grid grid-cols-3 gap-4 max-w-md">
            <div>
              <dt className="text-[11px] text-gray-500">기록 개월</dt>
              <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                {perf?.months ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-gray-500">투자일지</dt>
              <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                {journalCount}건
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-gray-500">리밸런싱</dt>
              <dd className="text-xl font-bold text-white tabular-nums mt-0.5">
                {rebalances.length}회
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
