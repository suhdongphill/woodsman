import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatBar";
import { loadLeadersView } from "@/features/leaders/service";
import { LayerFlow } from "@/features/leaders/ui/LayerFlow";
import { LeaderChanges } from "@/features/leaders/ui/LeaderChanges";
import { LayerMembers } from "@/features/leaders/ui/LayerMembers";
import { LeaderFit } from "@/features/leaders/ui/LeaderFit";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { cx } from "@/lib/format";

export const metadata: Metadata = {
  alternates: { canonical: "/leaders" },
  title: "주도주",
  description:
    "AI 투자 흐름을 전력·반도체·연결·데이터센터·모델·피지컬 AI·한국 축 일곱 칸으로 나눠, 돈이 어느 칸으로 옮겨 갔는지와 실적·가격이 함께 강한 주도주를 매주 판정합니다.",
};

/** ⚠ 정적 생성 금지 — 볼트가 새 판정을 실어도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 주도주 — 볼트 「주도주 모니터」를 포털로 옮긴 화면(2026-09-25). **조립만 한다.**
 * 판단은 `lib/leaders/view.ts`, 읽기는 `features/leaders/service.ts`.
 *
 * 순서(UI 권고): 모르는 것 → 한 문장·숫자 → **달라진 것** → 흐름 → 레이어별 종목 → 과거에 맞았나 → 방법.
 * 「달라진 것」을 앞에 둔 이유: 판정표는 매주 같은 모양이라, 다시 올 이유는 변화다.
 */
export default async function LeadersPage() {
  const today = new Date().toISOString().slice(0, 10);
  const result = await loadLeadersView(today);

  return (
    <>
      <PageHeader
        eyebrow="LEADERS"
        title="주도주"
        description="돈이 어느 칸으로 옮겨 갔는가 — 레이어별 자금 흐름 · 실적 가속 · 상대강도 · 수급. 실적과 가격이 함께 강한 종목만 주도주로 부릅니다."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        {result.state !== "ok" ? (
          <Card>
            <p className="text-[13px] text-muted">
              {result.state === "empty"
                ? "아직 실린 판정이 없습니다. 첫 판정이 올라오면 이 자리에 레이어별 흐름과 주도주가 나옵니다."
                : "판정을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요."}
            </p>
          </Card>
        ) : (
          (() => {
            const v = result.view;
            return (
              <>
                <div className="space-y-3">
                  <p
                    className={cx(
                      "rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed",
                      v.stale ? "border-gold-600/40 bg-gold-500/10 text-gold-300" : "border-border bg-card text-gray-500",
                    )}
                  >
                    판정 {v.collectedAt} 기준
                    {v.stale && ` · ${v.daysOld}일 지난 판정입니다(매주 갱신 — 이번 주 판정이 아직 올라오지 않았습니다)`}
                    {" · "}벤치마크 미국 S&amp;P 500 · 한국 KOSPI · 상대강도는 벤치마크 대비(거래일 기준)
                  </p>
                  <p className="rounded-xl border border-border bg-card px-4 py-3 text-[12.5px] leading-relaxed text-gray-500">
                    <strong className="text-ink">이 화면이 모르는 것:</strong> 수급은 한국 종목만 실측(KIS 외국인·기관
                    순매수)이고, 나머지 레이어는 ETF 거래대금 프록시입니다 — 실제 순유입(AUM 변화)이 아닙니다.
                  </p>
                  {v.problems.length > 0 && (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[12px] text-red-400">
                      일부 자료를 읽지 못해 비워 두었습니다: {v.problems.join(" · ")}
                    </p>
                  )}
                </div>

                <section className="space-y-4">
                  <Card>
                    <p className="text-[11px] font-semibold tracking-wide text-gray-500">지금 읽히는 것</p>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">{v.headline}</p>
                  </Card>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile label="주도주" value={`${v.counts.leader}곳`} sub="성장·가격 모두 강함" tone="up" />
                    <StatTile label="후발 후보" value={`${v.counts.candidate}곳`} sub="성장은 강한데 가격이 아직" />
                    <StatTile label="추격 주의" value={`${v.counts.watch}곳`} sub="가격만 강함" tone="gold" />
                    <StatTile label="관찰 대상" value={`${v.total}곳`} sub={`${v.groups.length}개 칸`} />
                  </div>
                </section>

                <LeaderChanges changes={v.changes} prevRunId={v.prevRunId} />

                <LayerFlow groups={v.groups} />

                <div className="space-y-10">
                  {v.groups.map((g) => (
                    <LayerMembers key={g.groupId} group={g} />
                  ))}
                </div>

                {v.fit && <LeaderFit fit={v.fit} />}
              </>
            );
          })()
        )}

        <section className="rounded-2xl border border-border bg-card p-5 text-[12.5px] leading-relaxed text-muted">
          <h2 className="text-[14px] font-semibold text-ink">이 화면이 판정하는 방법</h2>
          <p className="mt-2">
            ① 이익이 성장하는가(매출 YoY 15% 이상이고 가속이 꺾이지 않았거나, 가속이 5%p 넘게 붙었다) ② 가격이 벤치마크를
            앞서는가(3·6개월 상대강도 평균이 0보다 크다). 둘 다면 <strong className="text-ink">주도주</strong>, 성장만이면
            후발 후보, 가격만이면 추격 주의, 둘 다 아니면 제외입니다. 주도주 중 가속이 붙은 곳은 ★, 그중 52주 고점 2% 안쪽이면
            ★★입니다. ETF이거나 재무가 없으면 판정하지 않습니다.
          </p>
          <p className="mt-2">
            데이터 — 주가 Yahoo(일봉) · 미국 재무 SEC 공시(분기) · 한국 재무 DART · EPS 추정치 FMP · 수급은 한국 종목만
            KIS 투자자별 순매수(실측), 나머지는 ETF 거래대금 프록시. 매주 갱신합니다.
          </p>
          <p className="mt-2">
            판정은 종목을 사거나 팔라는 뜻이 아닙니다 — 지금 돈과 실적이 어느 칸에서 같은 방향인지를 적어 두는 기록입니다.{" "}
            <Link href="/disclaimer" className="underline hover:text-gold-400">
              투자 판단 책임 고지
            </Link>
            {" · "}
            <Link href="/portfolio" className="underline hover:text-gold-400">
              그래서 운영 포트폴리오는 어디에 있나 →
            </Link>
          </p>
        </section>

        <TistoryCta variant="compact" headline="레이어별 흐름을 글로 풀어 쓴 블로그" />
      </div>
    </>
  );
}
