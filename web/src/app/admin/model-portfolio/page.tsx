import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, FunctionBadge } from "@/components/ui/Badge";
import { StatTile, StatBar } from "@/components/ui/StatBar";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { EditIcon, TrashIcon } from "@/components/icons";
import { cx, formatCompact, formatDate, formatNumber, formatPct, profitColor } from "@/lib/format";
import {
  fillProgressPct,
  holdingValueKrw,
  sumTargetWeights,
  summarizeAllocation,
  targetSumWarning,
} from "@/lib/allocation";
import { summarizeManualPrices } from "@/lib/manual-price";
import { getSiteBasics } from "@/lib/site-settings";
import { requireAdmin } from "@/lib/session";
import { loadAllHoldings, loadRebalances } from "@/features/portfolio/repository";
import { deleteHoldingAction, deleteRebalanceAction } from "@/features/portfolio/actions";
import { HoldingForm } from "@/features/portfolio/ui/HoldingForm";
import { BucketManager } from "@/features/portfolio/ui/BucketManager";
import { loadBuckets } from "@/features/portfolio/buckets-repo";
import { loadUsdKrwRate } from "@/features/macro/fx-service";
import { loadReportLinkEntries } from "@/features/reports/repository";
import { adminReportLink, buildReportIndex } from "@/lib/report/link";
import {
  bucketBreakdownWarning,
  bucketName,
  breakdownBuckets,
  cashTargetPct,
  isBucketTargetSet,
  orphanHoldings,
} from "@/lib/bucket-target";
import { RebalanceForm } from "@/features/portfolio/ui/RebalanceForm";

export const metadata: Metadata = { title: "대표 포트폴리오" };

/** ⚠ 정적 생성 금지 — 종목을 고쳐도 화면이 안 바뀌는 사고가 난다. */
export const dynamic = "force-dynamic";

/**
 * 대표 포트폴리오 관리.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`를 읽어서 **목표 비중을 고칠 방법이 없었다**
 * (버튼은 있었지만 아무 데도 연결돼 있지 않았다). 지금은 D1을 읽고 쓴다.
 * 여기서 넣은 종목이 곧 공개 `/portfolio`와 홈의 배분 막대가 된다.
 */
export default async function AdminModelPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin("/admin/model-portfolio");

  const [{ edit }, holdings, rebalances, basics, buckets, reportEntries] = await Promise.all([
    searchParams,
    loadAllHoldings(),
    loadRebalances(),
    getSiteBasics(),
    loadBuckets(),
    loadReportLinkEntries(),
  ]);

  const editing = edit ? holdings.find((h) => h.id === edit) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const published = holdings.filter((h) => h.published);

  // ⚠ 환율은 **수집값**이다(2026-08-31). 설정값은 수집 전·실패 때의 안전망일 뿐이다.
  const usdKrw = await loadUsdKrwRate(basics.usdKrwRate);

  // ⚠ 비중은 반드시 원화로 환산한 뒤 계산한다 — 통화를 섞으면 통째로 틀린다.
  const rows = summarizeAllocation(
    published.map((h) => ({
      functionType: h.functionType,
      targetWeight: h.targetWeight,
      marketValue: holdingValueKrw(h, usdKrw.rate),
    })),
    buckets,
  );
  const targetSum = sumTargetWeights(published);
  const sumWarning = targetSumWarning(targetSum);
  const prices = summarizeManualPrices(published, today);

  // ⚠ 버킷 목표는 이제 종목에서 파생되지 않는다. 관리자가 정한 값을 그대로 그린다.
  const breakdown = breakdownBuckets(buckets, published);
  const bucketWarning = bucketBreakdownWarning(breakdown);
  const targetSet = isBucketTargetSet(buckets);
  const cashPct = cashTargetPct(buckets);
  // ⚠ 어느 버킷에도 속하지 않는 종목 — 비중 계산에서 조용히 빠지므로 반드시 말한다.
  const orphans = orphanHoldings(buckets, published);

  // ⚠ 두 화면이 서로를 모르면 관리자가 매번 보고서 목록을 뒤져야 한다. 여기서 이어 준다.
  //    공개 화면과 달리 **초안에도** 링크를 건다 — 쓰다 만 보고서로 돌아갈 길이 필요하다.
  const reportIndex = buildReportIndex(reportEntries);

  const segments = [
    ...breakdown.map((r) => ({
      label: r.bucket.name,
      value: r.targetPct,
      color: r.bucket.color,
    })),
    // 남는 몫을 회색으로 그린다 — 100%를 채운 것처럼 보이지 않게.
    ...(cashPct > 0 ? [{ label: "현금·미배정", value: cashPct, color: "var(--w-flat)" }] : []),
  ];

  // 통화별 원가·평가액 — 환율로 뭉개지 않고 통화 그대로 본다(원가는 통화별로만 의미가 있다).
  let krwCost = 0,
    krwVal = 0,
    usdCost = 0,
    usdVal = 0;
  for (const h of holdings) {
    if (h.avgCost == null || h.shares == null) continue;
    const cost = h.avgCost * h.shares;
    const val = (h.price ?? h.avgCost) * h.shares;
    if ((h.currency ?? "KRW") === "KRW") {
      krwCost += cost;
      krwVal += val;
    } else {
      usdCost += cost;
      usdVal += val;
    }
  }
  const krwPct = krwCost > 0 ? ((krwVal - krwCost) / krwCost) * 100 : 0;
  const usdPct = usdCost > 0 ? ((usdVal - usdCost) / usdCost) * 100 : 0;

  return (
    <AdminShell>
      <AdminPageHeader
        title="대표 포트폴리오 관리"
        description="여기에 넣은 종목이 그대로 공개 화면(/portfolio)과 홈의 배분 막대가 됩니다."
      />

      {/* 목표 합계 경고 — ⚠ 막지 않고 말해 주기만 한다(작성 중일 수 있다) */}
      {sumWarning && (
        <p className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gold-600/40 bg-gold-500/10 px-4 py-3 text-[12.5px] text-gold-300">
          <Badge tone="gold">목표 합계 {targetSum}%</Badge>
          <span>{sumWarning}</span>
        </p>
      )}

      {/* 수기 시세 상태 — 자동 갱신처럼 보이지 않게 관리자에게도 같은 문장을 보여준다 */}
      <p
        className={cx(
          "mb-5 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-[12.5px]",
          prices.stale
            ? "border-red-500/40 bg-red-500/10 text-red-300"
            : "border-border bg-card text-gray-400",
        )}
      >
        <Badge tone={prices.stale ? "danger" : "neutral"}>
          {prices.asOf ? `시세 ${prices.asOf} 기준` : "시세 기준일 없음"}
        </Badge>
        <span>{prices.note}</span>
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="원화 평가액"
          value={formatCompact(krwVal, "KRW")}
          sub={`원가 ${formatCompact(krwCost, "KRW")} · ${formatPct(krwPct)}`}
          tone={krwPct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="달러 평가액"
          value={formatCompact(usdVal, "USD")}
          sub={`원가 ${formatCompact(usdCost, "USD")} · ${formatPct(usdPct)}`}
          tone={usdPct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="공개 종목"
          value={`${published.length}개`}
          sub={`전체 ${holdings.length}개`}
        />
        <StatTile
          label="구성 완료"
          value={`${fillProgressPct(rows)}%`}
          sub={usdKrw.caption}
          tone="gold"
        />
      </div>

      <Card className="mb-5">
        <CardTitle
          action={<Badge tone={sumWarning ? "gold" : "emerald"}>종목 비중 합계 {targetSum}%</Badge>}
        >
          분류별 목표 배분
        </CardTitle>

        {/* ⚠ 목표를 안 정했으면 0%짜리 막대를 그리지 않는다 — 빈 막대는 "목표가 0"으로 읽힌다 */}
        {targetSet ? (
          <StatBar segments={segments} height="h-3" />
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-[12px] text-gray-500">
            아직 목표 구성비를 정하지 않았습니다. 아래 <strong className="text-gray-400">목표 구성비</strong>에서 정하세요.
          </p>
        )}

        <dl className="mt-4 grid gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <div key={r.functionType} className="rounded-lg bg-bg py-2.5">
              <dt className="text-[10px] text-gray-500">{bucketName(buckets, r.functionType)}</dt>
              <dd className="mt-0.5 text-[13px] font-bold tabular-nums text-ink">
                {r.currentPct}%
                <span className="ml-1 text-[11px] font-normal text-gray-500">
                  / 목표 {r.targetPct}%
                </span>
              </dd>
            </div>
          ))}
          {cashPct > 0 && (
            <div className="rounded-lg bg-bg py-2.5">
              <dt className="text-[10px] text-gray-500">현금·미배정</dt>
              <dd className="mt-0.5 text-[13px] font-bold tabular-nums text-gray-400">
                <span className="text-[11px] font-normal text-gray-500">목표 </span>
                {cashPct}%
              </dd>
            </div>
          )}
        </dl>

        {/* ⚠ 갈 곳 없는 분류의 종목 — 조용히 빠지게 두지 않는다 */}
        {orphans.length > 0 && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3 py-2.5 text-[12px] text-red-300">
            ⚠ 어느 분류에도 속하지 않는 종목이 {orphans.length}건 있습니다(
            {orphans.map((h) => h.name).join(" · ")}). 비중 계산에서 빠집니다 — 아래에서 분류를
            다시 지정하세요.
          </p>
        )}
      </Card>

      <BucketManager buckets={buckets} breakdown={breakdown} warning={bucketWarning} />

      <Card className="mb-6 mt-5">
        <CardTitle>{editing ? `수정: ${editing.name}` : "종목 추가"}</CardTitle>
        {/* key: 다른 종목을 편집할 때 폼이 이전 값을 붙들고 있지 않게 한다 */}
        <HoldingForm key={editing?.id ?? "new"} holding={editing} today={today} buckets={buckets} />
      </Card>

      {/* 종목 카드 */}
      {holdings.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            아직 종목이 없습니다. 위에서 첫 종목을 넣으면 공개 화면의 배분 차트가 그려집니다.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {holdings.map((h) => {
            const cur = h.currency ?? "KRW";
            const profitPct =
              h.price != null && h.avgCost ? ((h.price - h.avgCost) / h.avgCost) * 100 : null;
            return (
              <div
                key={h.id}
                className={cx(
                  "bg-card border rounded-2xl p-5 card-hover hover:border-gold-600/40",
                  editing?.id === h.id ? "border-gold-600/70" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FunctionBadge
                        type={h.functionType}
                        name={buckets.find((b) => b.key === h.functionType)?.name}
                        color={buckets.find((b) => b.key === h.functionType)?.color}
                      />
                      {h.ticker && (
                        <span className="text-[11px] font-mono text-gray-500">{h.ticker}</span>
                      )}
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-ink truncate">{h.name}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {h.market ?? "—"} · 수정 {formatDate(h.updatedAt)}
                    </p>

                    {/* ── 종목분석 보고서로 가는 길 ── */}
                    {(() => {
                      const link = adminReportLink(h, reportIndex);
                      if (link.kind === "none") {
                        return (
                          <p className="mt-1.5 text-[11px] text-gray-600">{link.reason}</p>
                        );
                      }
                      if (link.kind === "create") {
                        return (
                          <Link
                            href={link.href}
                            className="mt-1.5 inline-block text-[11px] text-gray-500 underline underline-offset-2 hover:text-gold-300"
                          >
                            분석 보고서 없음 — 만들기
                          </Link>
                        );
                      }
                      return (
                        <Link
                          href={link.href}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-gold-400 hover:text-gold-300"
                        >
                          분석 보고서 {link.status === "PUBLISHED" ? "(발행)" : "(초안)"} →
                        </Link>
                      );
                    })()}
                  </div>
                  {h.published ? (
                    <Badge tone="emerald">공개</Badge>
                  ) : (
                    <Badge tone="neutral">비공개</Badge>
                  )}
                </div>

                {h.thesis && (
                  <p className="mt-3 text-[12.5px] text-muted leading-relaxed line-clamp-2">
                    {h.thesis}
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-bg rounded-lg py-2">
                    <dt className="text-[10px] text-gray-500">목표비중</dt>
                    <dd className="text-[13px] font-bold text-gold-400 tabular-nums mt-0.5">
                      {h.targetWeight ?? "—"}%
                    </dd>
                  </div>
                  <div className="bg-bg rounded-lg py-2">
                    <dt className="text-[10px] text-gray-500">
                      현재가{h.priceAsOf ? ` (${h.priceAsOf.slice(5)})` : ""}
                    </dt>
                    <dd className="text-[13px] font-bold text-ink tabular-nums mt-0.5">
                      {h.price != null ? formatNumber(h.price, cur) : "—"}
                    </dd>
                  </div>
                  <div className="bg-bg rounded-lg py-2">
                    <dt className="text-[10px] text-gray-500">평가손익</dt>
                    <dd
                      className={cx(
                        "text-[13px] font-bold tabular-nums mt-0.5",
                        profitPct != null ? profitColor(profitPct) : "text-gray-500",
                      )}
                    >
                      {profitPct != null ? formatPct(profitPct) : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between">
                  <CanslimScore score={h.canslim} size="sm" />
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/model-portfolio?edit=${h.id}`}
                      aria-label={`${h.name} 편집`}
                      className="p-2 rounded-lg text-gray-500 hover:text-ink hover:bg-cardHover transition-colors"
                    >
                      <EditIcon size={15} />
                    </Link>
                    <form action={deleteHoldingAction}>
                      <input type="hidden" name="id" value={h.id} />
                      <button
                        type="submit"
                        aria-label={`${h.name} 삭제`}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-cardHover transition-colors"
                      >
                        <TrashIcon size={15} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 리밸런싱 */}
      <Card className="mt-8 mb-5">
        <CardTitle>리밸런싱 기록</CardTitle>
        <RebalanceForm today={today} />
      </Card>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>이력 ({rebalances.length}회)</CardTitle>
        </div>
        {rebalances.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 기록이 없습니다. 비중을 되돌린 날을 남기면 자금흐름 곡선에 표시됩니다.
          </p>
        ) : (
          <ul>
            {rebalances.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-4 px-5 py-3.5 border-t border-border hover:bg-cardHover transition-colors"
              >
                <span className="text-[11px] text-gold-400 tabular-nums w-20 shrink-0 mt-0.5">
                  {formatDate(r.date)}
                </span>
                <p className="text-[13px] text-gray-300 flex-1 leading-relaxed">{r.memo}</p>
                <form action={deleteRebalanceAction} className="shrink-0">
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    aria-label={`${r.date} 기록 삭제`}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon size={14} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}
