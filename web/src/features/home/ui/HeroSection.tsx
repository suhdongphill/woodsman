import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatBar } from "@/components/ui/StatBar";
import { ArrowRightIcon, ChevronRightIcon } from "@/components/icons";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/performance";
import type { PortfolioBucket } from "@/lib/bucket-target";
import { cashTargetPct, isBucketTargetSet } from "@/lib/bucket-target";
import type { Rebalance } from "@/lib/types";

/**
 * 첫 화면 — 문구 + 계좌 요약.
 *
 * ⚠ 2026-08-30 Step 1: 홈 라우트에서 **그대로** 옮겨 왔다. 겉모습은 한 줄도 바뀌지 않았다.
 *    계좌를 얇은 띠로 내리는 것은 Step 2다(`docs/설계_홈_콘텐츠중심_재편.md`).
 */
export function HeroSection({
  heroTitle,
  heroSubtitle,
  perf,
  buckets,
  rebalances,
  journalCount,
}: {
  heroTitle: string;
  heroSubtitle: string;
  perf: PerformanceSummary | null;
  buckets: PortfolioBucket[];
  rebalances: Rebalance[];
  journalCount: number;
}) {
  /**
   * ⚠ **목표 구성비 막대다. 현재 배분이 아니다.**
   *    2026-08-17 점검에서 지적받은 자리 — 라벨 없이 그려서 현재 비중처럼 읽혔다.
   *    이제 막대 위에 "목표"라고 적고, 남는 몫도 현금으로 그린다.
   * ⚠ 목표는 관리자가 정한 값(`PortfolioBucket`)이다. 종목 합계에서 파생시키지 않는다.
   */
  const cashPct = cashTargetPct(buckets);
  const targetSet = isBucketTargetSet(buckets);
  const segments = [
    ...buckets.map((b) => ({ label: b.name, value: b.targetPct, color: b.color })),
    ...(cashPct > 0 ? [{ label: "현금·미배정", value: cashPct, color: "#3a3f4b" }] : []),
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
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
          <div className="fade-up">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-[11px] text-gold-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-glow" />
              CULTIVATING WEALTH LIKE A FOREST
            </span>
            <h1 className="mt-5 text-3xl sm:text-4xl lg:text-[42px] font-bold text-white leading-[1.25] tracking-tight">
              {heroTitle}
            </h1>
            <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">{heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/portfolio" variant="gold" size="lg">
                계좌 성과 보기
                <ArrowRightIcon size={16} />
              </LinkButton>
              <LinkButton href="/journal" variant="outline" size="lg">
                투자일지 읽기
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

          {/* 계좌 요약 — 숫자를 첫 화면에 그대로 둔다 */}
          <Card className="fade-up bg-card/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">운용 계좌</p>
                <p className="text-base font-semibold text-white mt-0.5">
                  {perf ? formatDate(perf.asOf) : "—"} 기준
                </p>
              </div>
              <Link
                href="/portfolio"
                className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
              >
                상세
                <ChevronRightIcon size={12} />
              </Link>
            </div>

            {perf && (
              <>
                <p className="mt-5 text-[28px] font-bold tabular-nums text-white leading-none">
                  {formatNumber(perf.value)}
                </p>
                <p className="mt-2 text-[12px] text-muted">
                  납입원금 {formatNumber(perf.principal)} ·{" "}
                  <span className={perf.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatPct(perf.returnPct)}
                  </span>
                </p>
              </>
            )}

            {/* ⚠ 목표임을 반드시 적는다. 안 적으면 현재 배분으로 읽힌다(2026-08-17 점검). */}
            {targetSet && (
              <div className="mt-5">
                <p className="mb-1.5 flex items-baseline justify-between text-[11px] text-gray-500">
                  <span>목표 구성비</span>
                  <span className="text-gray-600">현재 배분은 /portfolio에서</span>
                </p>
                <StatBar segments={segments} height="h-3" />
              </div>
            )}

            {rebalances.length > 0 && (
              <p className="mt-5 pt-4 border-t border-border/70 text-[11px] text-gray-500 leading-relaxed">
                최근 리밸런싱 · {rebalances[0].memo}
              </p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
