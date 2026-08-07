import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { StockCard } from "@/features/stocks/ui/StockCard";
import { EmptyState } from "@/components/ui/Card";
import { BarChartIcon } from "@/components/icons";
import { stocks } from "@/lib/mock";

export const metadata: Metadata = {
  title: "종목분석",
  description: "차트·CANSLIM·뉴스를 한 화면에서 확인합니다.",
};



export default function StocksPage() {
  return (
    <>
      <PageHeader
        eyebrow="STOCKS"
        title="종목분석"
        description="대표 포트폴리오 편입 종목과 관찰 종목을 함께 봅니다. 상세에서 차트와 CANSLIM 구성을 볼 수 있습니다."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* 업종 필터·검색·정렬은 제거했다(2026-08-07 점검).
            아무 데도 연결돼 있지 않아 눌러도 목록이 그대로였다 — 방문자는 "종목이 이것뿐"으로 읽는다.
            실데이터가 붙을 때 실제로 동작하는 형태로 다시 만든다. */}

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
