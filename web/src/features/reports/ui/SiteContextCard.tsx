/**
 * 공개 화면의 "작성 시점 사이트 자료" 카드.
 *
 * ## ⚠ 얼려 둔 값을 보여준다. 오늘 값이 아니다
 * 보고서 본문의 논지는 **주입 시점의 숫자**를 근거로 쓰였다. 카드가 오늘 값을 띄우면
 * 같은 화면에서 본문과 숫자가 어긋난다. 그래서 스냅숏 그대로를 보여주고,
 * **기준일을 크게 적고**, 지금 값은 `/macro`·`/macro/bubble`에서 보라고 링크를 준다.
 * (그 링크는 사이트 안을 도는 동선이기도 하다.)
 *
 * ⚠ 대표 포트폴리오는 여기 넣지 않는다 — 옆 카드가 **지금 편입 상태**를 보여준다.
 *    같은 화면에 얼린 값과 지금 값을 나란히 두면 어느 쪽이 사실인지 알 수 없다.
 */
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { findBubbleTrigger } from "@/lib/bubble/catalog";
import { recessionCounts, type ReportContextSnapshot } from "@/lib/report/context";

const row = "flex flex-wrap items-baseline justify-between gap-2 py-1.5 border-b border-border/60";
const key = "text-[11.5px] text-muted";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function SiteContextCard({ snapshot }: { snapshot: ReportContextSnapshot }) {
  const { macro, bubble } = snapshot;

  return (
    <Card>
      <CardTitle
        action={
          <Link
            href="/macro"
            className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
          >
            지금 값 보기
            <ChevronRightIcon size={12} />
          </Link>
        }
      >
        작성 시점 사이트 자료
      </CardTitle>

      <p className="mb-3 text-[11.5px] text-gray-600">
        이 보고서를 쓸 때(<span className="tabular-nums text-gray-400">{snapshot.capturedAt}</span>)
        사이트가 갖고 있던 값입니다. 이후 값이 달라졌을 수 있어 갱신하지 않고 그대로 둡니다.
      </p>

      <div>
        <div className={row}>
          <span className={key}>침체 신호 종합</span>
          <span className="text-[12.5px] text-gray-200">
            {macro.level === "unknown" ? (
              <span className="text-gray-500">— 미수집</span>
            ) : (
              <>
                {macro.label} · {recessionCounts(macro)}
                {macro.asOf && (
                  <span className="ml-2 text-[11px] text-gray-600 tabular-nums">{macro.asOf}</span>
                )}
              </>
            )}
          </span>
        </div>

        <div className={row}>
          <span className={key}>연준 방향</span>
          <span className="text-[12.5px] text-gray-200">
            {macro.fed ? (
              <>
                {macro.fed.biasLabel} · 인상 {pct(macro.fed.hike)}
                {macro.fed.asOf && (
                  <span className="ml-2 text-[11px] text-gray-600 tabular-nums">
                    {macro.fed.asOf}
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-500">— 미산출</span>
            )}
          </span>
        </div>

        <div className={row}>
          <span className={key}>
            <Link href="/macro/bubble" className="hover:text-gold-400">
              AI·반도체 버블
            </Link>
          </span>
          <span className="text-[12.5px] text-gray-200">
            {bubble.score === undefined ? (
              <span className="text-gray-500">— 미채점</span>
            ) : (
              <>
                {bubble.score}점 · {bubble.regime}
                <span className="ml-2 text-[11px] text-gray-600">
                  {bubble.total}개 중 {bubble.scored}개
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {bubble.firedTriggerKeys.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[11.5px] text-amber-300">
            작성 시점에 발화해 있던 하드 트리거
            {bubble.priorityFired && " · ⚠ 우선 경보 3종 동시 발화"}
          </p>
          <ul className="mt-1.5 space-y-1">
            {bubble.firedTriggerKeys.map((k) => (
              <li key={k} className="text-[12px] leading-relaxed text-gray-300">
                {findBubbleTrigger(k)?.text ?? k}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
