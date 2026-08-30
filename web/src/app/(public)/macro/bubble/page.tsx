import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { ScoreGauge } from "@/features/bubble/ui/ScoreGauge";
import { loadReadings, loadTriggerStates } from "@/features/bubble/repository";
import { ALL_BUBBLE_INDICATORS, BUBBLE_TRIGGERS } from "@/lib/bubble/catalog";
import { scoreBubble } from "@/lib/bubble/score";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getSiteBasics } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "AI·반도체 버블 모니터 — 지금 어디쯤인가",
  description:
    `AI 설비투자·밸류에이션·실물 수요·신용·심리 다섯 층 ${ALL_BUBBLE_INDICATORS.length}개 지표를 0·1·2로 채점해 0~100으로 냅니다. 판이 바뀌는 사건 ${BUBBLE_TRIGGERS.length}가지(하드 트리거)도 함께 감시합니다. 점수보다 '무엇을 보고 그렇게 봤나'를 남기는 것이 목적입니다.`,
  alternates: { canonical: "/macro/bubble" },
  openGraph: {
    type: "article",
    title: "AI·반도체 버블 모니터 — 지금 어디쯤인가",
    description: `다섯 층 ${ALL_BUBBLE_INDICATORS.length}개 지표로 본 AI·반도체 사이클의 위치. 채점 근거를 그대로 공개합니다.`,
    url: "/macro/bubble",
  },
};

/** ⚠ 정적 생성 금지 — 채점을 고쳐도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

const POINT_LABEL = ["안정", "주의", "과열"];

/**
 * AI·반도체 버블 모니터.
 *
 * 볼트의 설계서(5레이어 점수 모델 + 하드 트리거)를 사이트로 옮긴 화면이다.
 * ⚠ 여기서 내는 것은 **국면 표시**까지다. 매매 지시로 넘어가지 않는다.
 */
export default async function BubbleMonitorPage() {
  const [readings, triggers, basics] = await Promise.all([
    loadReadings(),
    loadTriggerStates(),
    getSiteBasics(),
  ]);

  const score = scoreBubble(readings);
  const firedCount = BUBBLE_TRIGGERS.filter((t) => triggers.get(t.key)?.fired).length;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "거시 지표", path: "/macro" },
          { name: "버블 모니터", path: "/macro/bubble" },
        ])}
      />

      <PageHeader
        eyebrow="BUBBLE MONITOR"
        title="🫧 AI·반도체 버블 모니터"
        description={`다섯 층으로 나눈 ${ALL_BUBBLE_INDICATORS.length}개 지표를 0·1·2로 채점해 한 숫자로 냅니다. 숫자보다 중요한 것은 각 지표에 적어 둔 근거입니다.`}
      />

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        <nav aria-label="현재 위치" className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <Link href="/macro" className="hover:text-gold-400">
            거시 지표
          </Link>
          <ChevronRightIcon size={12} />
          <span className="text-gray-400">버블 모니터</span>
        </nav>

        <ScoreGauge score={score} />

        {/* 읽는 법 — 처음 온 사람에게 필요한 것 */}
        <Card className="border-gold-600/30 bg-gold-500/[0.04]">
          <h2 className="text-[15px] font-semibold text-ink">이 점수를 어떻게 읽나요</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-gray-300">
            <li>
              <strong className="text-gold-400">0·1·2 세 칸</strong>으로만 채점합니다. 지표 절반이
              숫자가 아니라 판단이라, 소수점을 붙이면 없는 정밀도가 생깁니다.
            </li>
            <li>
              <strong className="text-gold-400">결측은 분모에서 뺍니다.</strong> 아직 안 본 지표를
              0점으로 치면 &ldquo;안 본 것&rdquo;이 &ldquo;괜찮은 것&rdquo;이 되기 때문입니다.
            </li>
            <li>
              <strong className="text-gold-400">점수는 예측이 아닙니다.</strong> 지금 어느 국면에
              가까운지를 적어 두는 기록이고, 무엇을 할지는 사람이 정합니다.
            </li>
          </ul>
        </Card>

        {/* 레이어별 채점 */}
        <section aria-labelledby="layers-heading">
          <SectionHeader
            title={<span id="layers-heading">다섯 층</span>}
            subtitle="가중치가 큰 층일수록 총점을 크게 움직입니다."
          />

          <div className="space-y-4">
            {score.layers.map(({ layer, average, scored, total, readings: rs }) => (
              <Card key={layer.id} padding="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-ink">
                    <span className="mr-1.5 text-gray-500">{layer.id}</span>
                    {layer.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">가중치 {layer.weight}</Badge>
                    <Badge tone={average === undefined ? "neutral" : average >= 1.5 ? "danger" : average >= 1 ? "warn" : "emerald"}>
                      {average === undefined ? "미채점" : `평균 ${average.toFixed(1)} / 2`}
                    </Badge>
                    <span className="text-[11px] text-gray-600">
                      {scored}/{total}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[12px] text-muted">{layer.note}</p>

                <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
                  {layer.indicators.map((indicator, idx) => {
                    const reading = rs[idx];
                    return (
                      <li key={indicator.key} className="py-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[13px] text-gray-200">{indicator.label}</span>
                          <span
                            className={
                              reading === undefined
                                ? "text-[11px] text-gray-600"
                                : reading.points === 2
                                  ? "text-[12px] font-semibold text-red-400"
                                  : reading.points === 1
                                    ? "text-[12px] font-semibold text-yellow-400"
                                    : "text-[12px] font-semibold text-emerald-400"
                            }
                          >
                            {reading === undefined
                              ? "미채점"
                              : `${reading.points}점 · ${POINT_LABEL[reading.points]}`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-600">기준: {indicator.rule}</p>
                        {reading?.value && (
                          <p className="mt-1 text-[12px] leading-relaxed text-gray-400">
                            {reading.value}
                            {reading.asOf && (
                              <span className="ml-1 text-gray-600">({reading.asOf} 기준)</span>
                            )}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* 하드 트리거 */}
        <section aria-labelledby="triggers-heading">
          <SectionHeader
            title={<span id="triggers-heading">판이 바뀌는 사건</span>}
            subtitle={`점수와 별개로 지켜보는 ${BUBBLE_TRIGGERS.length}가지 — 현재 ${firedCount}건 발생`}
          />
          <ul className="space-y-2">
            {BUBBLE_TRIGGERS.map((trigger) => {
              const state = triggers.get(trigger.key);
              return (
                <li
                  key={trigger.key}
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-200">
                      {trigger.text}
                    </p>
                    <Badge
                      tone={state?.fired ? "danger" : state?.proximity === "near" ? "warn" : "neutral"}
                    >
                      {state?.fired ? "발생" : state?.proximity === "near" ? "근접" : "여유"}
                    </Badge>
                  </div>
                  {state?.now && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">{state.now}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <TistoryCta
          headline="이 모니터를 어떻게 쓰는지 블로그에 적었습니다"
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />

        <p className="text-[11px] leading-relaxed text-gray-600">
          ※ 정보 제공을 위한 기록이며 투자 권유가 아닙니다. 점수는 공개된 자료를 운영자가 채점한
          결과로, 판단이 섞여 있습니다.{" "}
          <Link href="/disclaimer" className="underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
        </p>
      </div>
    </>
  );
}
