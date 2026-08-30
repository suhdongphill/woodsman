/**
 * 그룹 카드 — 허브에서 상세로 들어가는 입구.
 *
 * ## 왜 '질문'을 제목 밑에 두나
 * "금리"라는 단어만으로는 눌러야 할 이유가 생기지 않는다. **"돈을 빌리는 값이 얼마인가?"**
 * 처럼 자기 질문으로 읽히면 그때 들어간다. 카드 안에 대표 지표 값을 미리 두는 것도 같은
 * 이유다 — 눌러 봐야 뭐가 있는지 아는 구조를 피한다.
 *
 * 카드 전체가 링크다. 작은 화면에서 화살표만 누르게 만들면 잘 안 눌린다(터치 표적 크기).
 */
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import type { MacroGroup } from "@/lib/macro/groups";
import type { IndicatorView } from "../service";
import { IndicatorRow } from "./IndicatorCard";

export function GroupCard({ group, items }: { group: MacroGroup; items: IndicatorView[] }) {
  return (
    <Link
      href={`/macro/${group.key}`}
      className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-gold-600/40 hover:bg-cardHover"
      aria-label={`${group.name} 지표 자세히 보기 — ${group.question}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">
            <span aria-hidden="true" className="mr-1.5">
              {group.emoji}
            </span>
            {group.name}
          </h3>
          <p className="mt-1 text-[12.5px] text-muted">{group.question}</p>
        </div>
        <ChevronRightIcon
          size={16}
          className="mt-1 shrink-0 text-gray-600 transition-colors group-hover:text-gold-400"
        />
      </div>

      <div className="mt-3 divide-y divide-border/60 border-t border-border/60 pt-1">
        {items.map((item) => (
          <IndicatorRow key={item.indicator.key} view={item} />
        ))}
      </div>
    </Link>
  );
}
