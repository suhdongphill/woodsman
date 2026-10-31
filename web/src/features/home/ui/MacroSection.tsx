import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { RecessionBoard } from "@/features/macro/ui/RecessionBoard";
import type { MacroOverview } from "@/features/macro/service";

/**
 * 지금 경제는 어떤 상태인가.
 *
 * 계좌(내 기록) 다음에 시장(바깥 환경)을 둔다. 초보자는 "내 돈이 놓인 판이 지금
 * 어떤가"를 먼저 궁금해하고, 그 답이 여기 있다. 깊이 들어가는 건 `/macro`가 맡는다.
 *
 * ⚠ Step 3에서 이 블록이 **첫 화면 바로 아래**로 올라간다. 지금은 자리를 그대로 둔다.
 *
 * ⚠ 2026-10-31: 대표 지표 5칸(10년물·순유동성·CPI·실업률·환율)을 **뺐다** — 히어로 바로 아래
 *    「지금 부는 바람」 띠와 같은 지표가 두 번 나왔다(운영자 「중복」). 원칙 ④ 「대표 지표는 앞줄로」대로
 *    위 띠를 남기고 여기서 뺀다. 이 블록은 침체 신호 종합만 맡는다.
 */
export function MacroSection({ macro }: { macro: MacroOverview }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <SectionHeader
        title="지금 경제는 어떤 상태인가"
        subtitle={`침체 신호 다섯 가지를 종합하고, ${macro.groups.length}개 묶음 ${macro.indicatorCount}개 지표마다 읽는 법을 붙였습니다.`}
        action={
          <Link
            href="/macro"
            className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
          >
            지표 전체 보기
            <ChevronRightIcon size={13} />
          </Link>
        }
      />

      <RecessionBoard
        summary={macro.summary}
        signals={macro.signals}
        asOf={macro.asOf}
        compact
      />

    </section>
  );
}
