import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { RecessionBoard } from "@/features/macro/ui/RecessionBoard";
import { FedHikeCard } from "@/features/macro/ui/FedHikeCard";
import { GroupCard } from "@/features/macro/ui/GroupCard";
import { HealthNotice } from "@/features/macro/ui/Freshness";
import { loadMacroOverview } from "@/features/macro/service";
import { loadSectionPosts } from "@/features/posts/repository";
import { SectionFrame } from "@/features/posts/ui/SectionFrame";
import { MACRO_INDICATORS } from "@/lib/macro/catalog";
import { ALL_BUBBLE_INDICATORS, BUBBLE_TRIGGERS } from "@/lib/bubble/catalog";
import { breadcrumbJsonLd, datasetJsonLd } from "@/lib/seo";
import { getSiteBasics } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "거시 지표 — 지금 경제는 어떤 상태인가",
  description:
    "금리·물가·고용·환율·원자재·소비·생산·부동산·반도체 지표를 한 화면에서 봅니다. 침체 신호 5가지를 종합해 지금 상태를 먼저 알려주고, 지표마다 '이게 뭔가·왜 보나·어떻게 읽나'를 붙였습니다. 투자를 막 시작한 분도 읽을 수 있게 만들었습니다.",
  alternates: { canonical: "/macro" },
  openGraph: {
    type: "website",
    title: "거시 지표 — 지금 경제는 어떤 상태인가",
    description:
      "침체 신호 5가지와 9개 묶음 40여 지표를, 초보자도 읽을 수 있게 설명과 함께 공개합니다.",
    url: "/macro",
  },
};

/** ⚠ 정적 생성 금지 — 자료를 가져와도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 거시 지표 허브.
 *
 * ## 화면 순서를 이렇게 잡은 이유
 * ① 지금 상태(결론) → ② 처음 오신 분 안내 → ③ 9개 묶음(각각 질문) → ④ 데이터 출처.
 * 초보자에게 필요한 건 "무엇부터 볼지"이고, 그 판단을 화면이 대신 해 준다.
 */
export default async function MacroHubPage() {
  const [overview, basics, sectionPosts] = await Promise.all([
    loadMacroOverview(),
    getSiteBasics(),
    loadSectionPosts("MACRO", 5),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "거시 지표", path: "/macro" },
        ])}
      />
      <JsonLd
        data={datasetJsonLd({
          name: "Woodsman 거시 지표 대시보드",
          description:
            "미국·한국의 금리, 물가, 고용, 환율, 원자재, 소비, 생산, 부동산, 반도체 지표를 정기적으로 수집해 공개합니다.",
          path: "/macro",
          dateModified: overview.asOf,
          variables: MACRO_INDICATORS.map((i) => i.name),
          sources: ["FRED (Federal Reserve Bank of St. Louis)", "Yahoo Finance", "ISM", "NAHB"],
        })}
      />

      <PageHeader
        eyebrow="MACRO DASHBOARD"
        title="지금 경제는 어떤 상태인가"
        description="숫자를 늘어놓지 않고, 무엇부터 봐야 하는지부터 알려드립니다. 침체 신호를 먼저 종합하고, 아홉 개 묶음으로 나눠 지표마다 읽는 법을 붙였습니다."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        {/* ① 결론 먼저 */}
        <section aria-labelledby="signals-heading" className="space-y-4">
          <h2 id="signals-heading" className="sr-only">
            침체 신호 종합
          </h2>
          {/* ⚠ 문제가 없으면 이 줄은 렌더되지 않는다 — 늘 떠 있는 경고는 무시된다 */}
          <HealthNotice health={overview.health} />
          <RecessionBoard
            summary={overview.summary}
            signals={overview.signals}
            asOf={overview.asOf}
          />
        </section>

        {/* ①-2 금리는 '지금 몇 %'보다 '어디로 가는가'가 먼저다 */}
        {overview.fedHike && (
          <section aria-labelledby="fedhike-heading">
            <h2 id="fedhike-heading" className="sr-only">
              연준 정책금리 방향
            </h2>
            <FedHikeCard result={overview.fedHike} asOf={overview.fedHikeAsOf} />
          </section>
        )}

        {/* ② 처음 오신 분 — 읽는 순서를 알려준다 */}
        <section aria-labelledby="guide-heading">
          <Card className="border-gold-600/30 bg-gold-500/[0.04]">
            <h2 id="guide-heading" className="text-[15px] font-semibold text-white">
              처음이신가요? 이 순서로 보세요
            </h2>
            <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-gray-300">
              <li>
                <strong className="text-gold-400">1. 금리</strong> — 모든 자산 가격의 기준점입니다.
                금리가 어디로 가는지가 나머지 전부를 흔듭니다.
              </li>
              <li>
                <strong className="text-gold-400">2. 물가</strong> — 금리를 결정하는 원인입니다.
                물가가 잡혀야 금리를 내릴 수 있습니다.
              </li>
              <li>
                <strong className="text-gold-400">3. 고용</strong> — 경기의 마지막 버팀목입니다.
                여기가 흔들리면 침체 이야기가 현실이 됩니다.
              </li>
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-gray-500">
              나머지 묶음(환율·원자재·소비·생산·부동산·반도체)은 위 셋이 실제로 어디에 닿고
              있는지를 보여줍니다. 용어는 각 지표 카드 안에서 풀어서 설명합니다.
            </p>
          </Card>
        </section>

        {/* ③ 아홉 개 묶음 */}
        <section aria-labelledby="groups-heading">
          <SectionHeader
            title={<span id="groups-heading">무엇이 궁금하세요?</span>}
            subtitle="묶음을 누르면 지표별 값·흐름·읽는 법이 나옵니다."
          />

          {overview.empty && (
            <Card className="mb-4 border-yellow-500/30 bg-yellow-500/[0.06]">
              <p className="text-[13px] leading-relaxed text-yellow-200">
                아직 지표를 한 번도 가져오지 않았습니다. 값이 채워지면 이 자리에 최신 숫자가
                표시됩니다.
              </p>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.groups.map(({ group, items }) => (
              <GroupCard key={group.key} group={group} items={items} />
            ))}
          </div>
        </section>

        {/* ③-2 따로 보면 안 보이는 것 — 겹쳐 보기 */}
        <Link
          href="/macro/compare"
          className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-gold-600/40 hover:bg-cardHover"
        >
          <h2 className="text-[15px] font-semibold text-white">📈 지표 겹쳐 보기</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            금리와 유동성, 물가와 기대, 실물과 주가를 <strong>같은 시간축 위에</strong> 세워
            어디서 벌어졌는지를 봅니다. 단위가 다르면 축을 두 개 그리는 대신 척도를 환산합니다 —
            축을 조정하는 것만으로 아무 결론이나 만들 수 있기 때문입니다.
          </p>
          <span className="mt-2 inline-flex items-center gap-0.5 text-[12px] text-gold-400">
            겹쳐 보기
            <ChevronRightIcon size={13} />
          </span>
        </Link>

        {/* ③-3 반도체 사이클은 따로 깊게 본다 */}
        <Link
          href="/macro/bubble"
          className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-gold-600/40 hover:bg-cardHover"
        >
          <h2 className="text-[15px] font-semibold text-white">🫧 AI·반도체 버블 모니터</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            설비투자·밸류에이션·실물 수요·신용·심리 다섯 층 {ALL_BUBBLE_INDICATORS.length}개 지표를
            채점해 지금 사이클이 어디쯤인지 한 숫자로 봅니다. 판이 바뀌는 사건{" "}
            {BUBBLE_TRIGGERS.length}가지도 함께 감시합니다.
          </p>
          <span className="mt-2 inline-flex items-center gap-0.5 text-[12px] text-gold-400">
            모니터 보기
            <ChevronRightIcon size={13} />
          </span>
        </Link>

        {/* ④ 이 화면에 대해 쓴 글 — 발행할 때마다 쌓인다 */}
        <SectionFrame section="MACRO" posts={sectionPosts} />

        {/* ⑤ 블로그로 — 이 사이트의 1순위 목적 */}
        <TistoryCta
          headline="지표를 어떻게 쓰는지 블로그에 더 자세히 적었습니다"
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />

        <section aria-labelledby="source-heading">
          <h2 id="source-heading" className="text-[13px] font-semibold text-gray-400">
            데이터 출처와 갱신
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-gray-600">
            미국 지표는 세인트루이스 연준의 FRED, 주가는 Yahoo Finance에서 받아 이 사이트의
            데이터베이스에 누적합니다. 공식 API가 없는 지표(ISM PMI, 컨퍼런스보드 소비자신뢰,
            NAHB 주택시장지수, 달러인덱스, 금, 한국 기준금리, 선행 PER)는 운영자가 원 발표
            자료를 보고 직접 입력하며, 각 카드에 <strong>수동 입력</strong>으로 표시됩니다.
            지표마다 기준일이 다르므로 카드에 적힌 날짜를 함께 보세요.
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-600">
            ※ 이 페이지는 정보 제공을 위한 기록이며 투자 권유가 아닙니다. 데이터는 원 출처의
            수정에 따라 사후에 바뀔 수 있습니다.{" "}
            <Link href="/disclaimer" className="underline hover:text-gold-400">
              투자 판단 책임 고지
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
