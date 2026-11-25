/**
 * 질문별 섹션 + 맨 위 계기판(2026-11-25 · 물가 압력 탭 ⑥).
 *
 * ## 왜 진짜 탭이 아니라 바로가기인가 (운영자 결정 「권고대로」)
 * 이 화면은 섹션끼리 **비교하며** 읽는다(서비스 물가 ↔ 임금, 주유소 ↔ CPI 휘발유). 탭으로 가리면 동시에 못 보고,
 * 검색엔진도 숨은 탭 내용을 덜 읽는다. 모두 펼쳐 둔 채 칩으로 이동만 돕는다.
 *
 * ⚠ 섹션 구성은 섹터 파일(`group.sections`)이 정하고, 빠짐·겹침은 `validateSectors`가 막는다 — 여기서는 그리기만 한다.
 */
import Link from "next/link";
import type { IndicatorView } from "@/features/macro/service";
import { IndicatorCard } from "@/features/macro/ui/IndicatorCard";
import { OilPassThroughCard } from "@/features/macro/ui/OilPassThroughCard";
import { formatIndicatorValue, shortObsDate } from "@/lib/macro/series";
import type { MacroGroup } from "@/lib/macro/types";
import type { PassThrough } from "@/lib/macro/oil-passthrough";

function DashboardTile({ view, today }: { view: IndicatorView; today: string }) {
  const { indicator } = view;
  const date = shortObsDate(view.asOf, indicator.freq, today);
  return (
    <a
      href={`#${indicator.key}`}
      className="block rounded-xl border border-border bg-bg px-3 py-2.5 transition-colors hover:border-gold-600/40"
    >
      <span className="block truncate text-[11.5px] text-gray-500">{indicator.name}</span>
      <span className="mt-0.5 block text-[20px] font-bold tabular-nums text-ink">
        {view.value === undefined ? <span className="text-[14px] font-normal text-gray-500">수집 전</span> : view.display}
        {date && <span className="ml-1.5 text-[11px] font-normal text-gray-500">{date}</span>}
      </span>
      {/*
        ⚠ 날짜를 값마다 붙인다 — 전년비와 연율은 기준 달이 다를 수 있다(2025-10 셧다운 결측: CPI 전년비는 9월, 연율은 10월까지).
        한 줄에 날짜 하나만 두면 연율이 전년비 날짜로 읽힌다(11/25 배포 확인에서 잡았다).
      */}
      <span className="block text-[11px] tabular-nums text-gray-500">
        {view.annualized?.m3 !== undefined
          ? `3개월 연율 ${formatIndicatorValue(indicator, view.annualized.m3)} (${view.annualized.asOf.slice(0, 7)}까지)`
          : view.changeDisplay
            ? `직전 대비 ${view.changeDisplay}`
            : " "}
      </span>
    </a>
  );
}

export function GroupSections({
  group,
  items,
  passThrough,
  today,
}: {
  group: MacroGroup;
  items: IndicatorView[];
  passThrough?: PassThrough;
  today: string;
}) {
  const byKey = new Map(items.map((v) => [v.indicator.key, v]));
  const sections = group.sections ?? [];
  const tiles = (group.dashboard ?? []).flatMap((k) => (byKey.get(k) ? [byKey.get(k)!] : []));

  return (
    <>
      {tiles.length > 0 && (
        <section aria-labelledby="dashboard-heading">
          <h2 id="dashboard-heading" className="mb-2 text-[13px] font-semibold text-gray-400">
            한눈에 — 지금 수준 · 최근 속도 · 기대 · 유가
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map((v) => (
              <DashboardTile key={v.indicator.key} view={v} today={today} />
            ))}
          </div>
        </section>
      )}

      {/* 섹션 바로가기 — 머리글(sticky) 아래에 붙는다. 좁은 화면은 가로 스크롤 */}
      <nav
        aria-label="이 화면의 섹션"
        className="sticky top-16 z-10 -mx-4 overflow-x-auto border-y border-border bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <ul className="flex gap-2 whitespace-nowrap text-[12.5px]">
          {sections.map((s, i) => (
            <li key={s.key}>
              <a
                href={`#sec-${s.key}`}
                className="inline-block rounded-full border border-border px-3 py-1 text-gray-300 hover:border-gold-600/40 hover:text-gold-400"
              >
                {i + 1}. {s.chip}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((s, i) => (
        <section key={s.key} id={`sec-${s.key}`} aria-labelledby={`sec-${s.key}-h`} className="scroll-mt-32 space-y-5">
          <div>
            <h2 id={`sec-${s.key}-h`} className="text-[17px] font-bold text-ink">
              {i + 1}. {s.title}
            </h2>
            {s.note && <p className="mt-1 text-[13px] leading-relaxed text-gray-400">{s.note}</p>}
          </div>

          {s.extra === "oil-passthrough" && passThrough?.asOf && <OilPassThroughCard result={passThrough} />}

          {s.keys.map((k) => {
            const v = byKey.get(k);
            return v ? <IndicatorCard key={k} view={v} /> : null;
          })}

          {s.extra === "yield-decomp-link" && (
            <p className="text-[13px] text-gray-400">
              장기 기대인플레가 10년물 금리에서 차지하는 몫은{" "}
              <Link href="/macro#yielddecomp-heading" className="underline hover:text-gold-400">
                거시 지표 「10년물 분해」
              </Link>
              에서 실질금리와 나눠 볼 수 있습니다.
            </p>
          )}
        </section>
      ))}
    </>
  );
}
