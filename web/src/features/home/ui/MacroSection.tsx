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
 */
export function MacroSection({ macro }: { macro: MacroOverview }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <SectionHeader
        title="지금 경제는 어떤 상태인가"
        subtitle="침체 신호 다섯 가지를 종합하고, 지표마다 읽는 법을 붙였습니다."
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

      {macro.headlines.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {macro.headlines.map((h) => (
            <Link
              key={h.indicator.key}
              href={`/macro/${h.indicator.group}`}
              className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-gold-600/40 hover:bg-cardHover"
            >
              <p className="text-[11px] text-muted">{h.indicator.name}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-white">{h.display}</p>
              <p className="mt-1 text-[11px] text-gray-600">
                {h.asOf ? `${h.asOf} 기준` : "수집 전"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
