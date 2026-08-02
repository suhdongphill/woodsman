import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, FUNCTION_COLOR, FUNCTION_LABEL, FunctionBadge } from "@/components/ui/Badge";
import { StatTile, StatBar } from "@/components/ui/StatBar";
import { CanslimScore } from "@/components/ui/CanslimScore";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  UploadIcon,
  DownloadIcon,
  BarChartIcon,
} from "@/components/icons";
import { cx, formatCompact, formatDate, formatNumber, formatPct, profitColor } from "@/lib/format";
import { functionAllocation, modelHoldings, rebalances } from "@/lib/mock";
import type { FunctionType } from "@/lib/types";

export const metadata: Metadata = { title: "대표 포트폴리오" };

const FUNCTIONS: FunctionType[] = ["GROWTH", "INCOME", "DEFENSE"];
const SORTS = ["목표비중순", "평가액순", "CANSLIM순", "등록순"];

export default function AdminModelPortfolioPage() {
  const alloc = functionAllocation();
  const segments = FUNCTIONS.map((f) => ({
    label: FUNCTION_LABEL[f],
    value: alloc[f],
    color: FUNCTION_COLOR[f],
  }));

  // 요약(기존 index.html SummaryPanel 로직 이식: 통화별 원가/평가액 합산)
  let krwCost = 0,
    krwVal = 0,
    usdCost = 0,
    usdVal = 0;
  const scores: number[] = [];
  for (const h of modelHoldings) {
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
    if (h.canslim != null) scores.push(h.canslim);
  }
  const krwPct = krwCost > 0 ? ((krwVal - krwCost) / krwCost) * 100 : 0;
  const usdPct = usdCost > 0 ? ((usdVal - usdCost) / usdCost) * 100 : 0;
  const avgCanslim = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  return (
    <AdminShell>
      <AdminPageHeader
        title="대표 포트폴리오 관리"
        description="기존 종목관리 기능(카드·요약·필터·정렬·상세·가져오기/내보내기)에 공개여부·기능분류·thesis·목표비중을 더했습니다."
        action={
          <>
            <Button variant="ghost" size="sm">
              <UploadIcon size={14} />
              가져오기
            </Button>
            <Button variant="ghost" size="sm">
              <DownloadIcon size={14} />
              내보내기
            </Button>
            <Button variant="gold" size="sm">
              <PlusIcon size={14} />
              종목 추가
            </Button>
          </>
        }
      />

      {/* 요약 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="원화 평가액"
          value={formatCompact(krwVal, "KRW")}
          sub={`원가 ${formatCompact(krwCost, "KRW")}`}
          tone={krwPct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="원화 수익률"
          value={formatPct(krwPct)}
          tone={krwPct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="달러 평가액"
          value={formatCompact(usdVal, "USD")}
          sub={`수익률 ${formatPct(usdPct)}`}
          tone={usdPct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="평균 CANSLIM"
          value={avgCanslim != null ? avgCanslim.toFixed(1) : "-"}
          sub={`${scores.length}개 종목 분석됨`}
          tone="gold"
        />
      </div>

      <Card className="mb-5">
        <CardTitle action={<Badge tone="neutral">목표비중 합계 {alloc.GROWTH + alloc.INCOME + alloc.DEFENSE}%</Badge>}>
          기능별 배분
        </CardTitle>
        <StatBar segments={segments} height="h-3" />
      </Card>

      {/* 필터바 (기존 FilterBar 이식) */}
      <div className="flex flex-col lg:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <SearchIcon
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
          <input
            type="search"
            placeholder="종목명·티커 검색"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-600 transition-colors"
          />
        </div>
        <select className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-gold-600">
          <option>기능 전체</option>
          {FUNCTIONS.map((f) => (
            <option key={f}>{FUNCTION_LABEL[f]}</option>
          ))}
        </select>
        <select className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-gold-600">
          <option>공개 전체</option>
          <option>공개</option>
          <option>비공개</option>
        </select>
        <select className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-gold-600">
          {SORTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* 종목 카드 */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modelHoldings.map((h) => {
          const cur = h.currency ?? "KRW";
          const profitPct =
            h.price != null && h.avgCost ? ((h.price - h.avgCost) / h.avgCost) * 100 : null;
          return (
            <div
              key={h.id}
              className="bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FunctionBadge type={h.functionType} />
                    {h.ticker && (
                      <span className="text-[11px] font-mono text-gray-500">{h.ticker}</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold text-white truncate">{h.name}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {h.market ?? "—"} · 수정 {formatDate(h.updatedAt)}
                  </p>
                </div>
                <Toggle defaultOn={h.published} size="sm" />
              </div>

              {h.thesis && (
                <p className="mt-3 text-[12.5px] text-muted leading-relaxed line-clamp-2">
                  {h.thesis}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#12141c] rounded-lg py-2">
                  <dt className="text-[10px] text-gray-500">목표비중</dt>
                  <dd className="text-[13px] font-bold text-gold-400 tabular-nums mt-0.5">
                    {h.targetWeight ?? "—"}%
                  </dd>
                </div>
                <div className="bg-[#12141c] rounded-lg py-2">
                  <dt className="text-[10px] text-gray-500">현재가</dt>
                  <dd className="text-[13px] font-bold text-white tabular-nums mt-0.5">
                    {h.price != null ? formatNumber(h.price, cur) : "—"}
                  </dd>
                </div>
                <div className="bg-[#12141c] rounded-lg py-2">
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
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                    aria-label="상세·차트"
                  >
                    <BarChartIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                    aria-label="편집"
                  >
                    <EditIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-cardHover transition-colors"
                    aria-label="삭제"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 리밸런싱 */}
      <div className="mt-8">
        <Card padding="p-0">
          <div className="px-5 pt-5">
            <CardTitle
              action={
                <Button variant="ghost" size="sm">
                  <PlusIcon size={14} />
                  기록 추가
                </Button>
              }
            >
              리밸런싱 이력
            </CardTitle>
          </div>
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
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-white transition-colors"
                    aria-label="편집"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                    aria-label="삭제"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-gray-600 leading-relaxed">
        ※ Phase 3에서 기존 index.html의 종목 상세(차트·캔들패턴·CANSLIM·뉴스)와 가져오기/내보내기
        로직이 이 화면에 그대로 이식됩니다.
      </p>
    </AdminShell>
  );
}
