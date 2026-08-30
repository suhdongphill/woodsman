import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/format";
import { LEADER_POSITION, rankByStrength, type SectorStrength } from "@/lib/sector-strength";

/** ⚠ 보이는 문자열은 위쪽에 모은다 — 나중에 다국어를 넣을 때 여기만 본다. */
const TEXT = {
  heading: "주도주 섹터",
  question: "지금 돈은 어느 섹터로 흐르고 있나",
  empty: "아직 섹터 시세를 가져오지 않았습니다. 관리자 화면의 「자료 가져오기」를 먼저 돌리세요.",
  colSector: "섹터",
  colPosition: "52주 위치",
  colRelative: "시장 대비",
  colChange: "1년 수익률",
  leaderMark: "주도",
  /** ⚠ 이름을 정확히 붙인다 — 아래 주석 참고 */
  disclaimer:
    "⚠ 이 표는 자금 유입 통계가 아닙니다. 설정주식수·AUM 자료가 아니라 **가격이 만든 결과**(52주 고가 대비 위치와 시장 대비 초과 수익)입니다. 특정 종목의 매수·매도를 권하지 않습니다.",
  toPortfolio: "그래서 내 배분은 →",
};

/**
 * 주도주 섹터 프레임.
 *
 * ## 이 프레임이 주는 것 — **가져갈 한 문장**
 * "지금 돈은 어느 섹터로 흐르고 있나." 바람과 조류(거시)를 읽었다면,
 * **파도가 어디서 일고 있는지**가 여기 있다.
 *
 * ## ⚠ 이름을 정확히 붙인다
 * **자금 유입이라고 부르지 않는다.** 진짜 자금유입은 설정주식수·AUM 변화인데 무료로
 * 신뢰성 있게 얻을 길이 없다. 여기서 재는 것은 **가격이 만든 결과**다.
 * 이 사이트는 「모의 투자」·「기준일」·「수집 전」을 다 밝히는 곳이고,
 * 없는 데이터에 있는 이름을 붙이는 순간 그 원칙이 무너진다.
 *
 * ## ⚠ 매거진은 포트폴리오로 이어진다
 * 표만 보여주고 끝내지 않는다. 마지막 줄이 **"그래서 내 배분은"** 으로 잇는다 —
 * 다만 **권유가 아니라 연결**이다(운영지침 §5 · `/disclaimer`).
 */
export function SectorLeaders({ items }: { items: SectorStrength[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-muted">{TEXT.empty}</p>
      </Card>
    );
  }

  const ranked = rankByStrength(items);
  const asOf = ranked[0]?.asOf;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{TEXT.heading}</h2>
        {/* ⚠ 기준일을 항상 함께 낸다. 날짜 없는 숫자는 실시간으로 읽힌다 */}
        {asOf && <span className="text-[11px] text-ink-3">{asOf} 기준</span>}
      </div>
      <p className="mb-4 text-[13px] text-muted">{TEXT.question}</p>

      <Card padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-[11px] text-muted">
                <th className="px-4 py-2.5 text-left font-medium">{TEXT.colSector}</th>
                <th className="px-4 py-2.5 text-right font-medium">{TEXT.colPosition}</th>
                <th className="px-4 py-2.5 text-right font-medium">{TEXT.colRelative}</th>
                <th className="px-4 py-2.5 text-right font-medium">{TEXT.colChange}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => (
                <tr key={s.key} className="border-t border-border/70">
                  <td className="px-4 py-2.5 text-ink">
                    <span className="flex items-center gap-2">
                      {s.name}
                      {s.leading && (
                        <span className="rounded-full bg-series-1/10 px-2 py-0.5 text-[10px] text-series-1">
                          {TEXT.leaderMark}
                        </span>
                      )}
                    </span>
                  </td>
                  {/* 52주 위치 — 막대로도 보여 준다(숫자만 있으면 비교가 느리다) */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className={cx(
                            "block h-full rounded-full",
                            s.position >= LEADER_POSITION ? "bg-series-1" : "bg-ink-3",
                          )}
                          style={{ width: `${Math.max(2, Math.min(100, s.position))}%` }}
                        />
                      </span>
                      {s.position.toFixed(0)}
                    </span>
                  </td>
                  {/*
                    ⚠ 등락색을 쓰지 않는다. 이건 종목의 등락이 아니라 **상대 위치**다 —
                       한국식 등락색(상승 적)과 섞이면 "빨간데 왜 앞섰다는 거지"가 된다.
                       부호(+/−)로 방향을 말한다.
                  */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                    {s.relative === undefined
                      ? "—"
                      : `${s.relative >= 0 ? "+" : ""}${s.relative.toFixed(1)}%p`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {`${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{TEXT.disclaimer}</p>

      <Link
        href="/portfolio"
        className="mt-3 inline-block text-[12.5px] text-gold-500 hover:text-gold-400"
      >
        {TEXT.toPortfolio}
      </Link>
    </section>
  );
}
