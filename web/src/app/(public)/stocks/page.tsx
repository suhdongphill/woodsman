import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Badge";
import { StockCard } from "@/features/stocks/ui/StockCard";
import { EmptyState } from "@/components/ui/Card";
import { SearchIcon, BarChartIcon } from "@/components/icons";
import { stocks } from "@/lib/mock";

export const metadata: Metadata = {
  title: "종목분석",
  description: "차트·CANSLIM·뉴스를 한 화면에서 확인합니다.",
};

const INDUSTRIES = [
  "전체",
  "반도체·IT부품",
  "소프트웨어·플랫폼",
  "바이오·헬스케어",
  "금융·핀테크",
  "기타",
];

const SORTS = ["CANSLIM 높은순", "등락률순", "이름순"];

export default function StocksPage() {
  return (
    <>
      <PageHeader
        eyebrow="STOCKS"
        title="종목분석"
        description="대표 포트폴리오 편입 종목과 관찰 종목을 함께 봅니다. 상세에서 차트·CANSLIM·뉴스를 확인하세요."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-7">
          <div className="flex flex-wrap gap-2 flex-1">
            {INDUSTRIES.map((c, i) => (
              <Chip key={c} active={i === 0}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 lg:w-56">
              <SearchIcon
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
              />
              <input
                type="search"
                placeholder="종목명·티커"
                className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-600 transition-colors"
              />
            </div>
            <select
              defaultValue={SORTS[0]}
              className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-gold-600 transition-colors"
            >
              {SORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {stocks.length === 0 ? (
          <EmptyState icon={<BarChartIcon size={30} />} title="표시할 종목이 없습니다" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stocks.map((s) => (
              <StockCard key={s.ticker} stock={s} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
