import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/icons";
import { seoulDay } from "@/lib/kst";
import {
  countryLabel,
  ddayLabel,
  eventTime,
  kindLabel,
  type CalendarEvent,
} from "@/lib/macro-calendar";

/**
 * 홈의 「이번 주에 무엇을 볼 것인가」 — 다가올 일정 최대 4건.
 *
 * ## ⚠ 무엇을 올리지 않는가
 * **「평가가 밀린 일정」은 홈에 올리지 않는다.** 같은 데이터가 화면에 따라 다른 뜻이 되는
 * 자리다 — 관리자 화면에서 빈 칸은 **다음에 쓸 것**이지만, 홈에서 같은 것은 **「이 사이트는
 * 밀린 게 많다」**로 읽힌다. 나중에 「밀린 것도 홈에 올리자」는 생각이 다시 올라올 텐데,
 * 그때 이 문단을 먼저 읽기 바란다(`docs/설계_홈_캘린더_노출.md` §2).
 *
 * ## ⚠ 비어 있으면 이 카드는 아예 그려지지 않는다
 * 「다가올 일정이 없습니다」를 홈에 띄우면 빈 사이트로 보인다. 그 판단은 화면이 아니라
 * `lib/home-layout.ts`가 한다 — 여기서는 빈 배열이 오지 않는다고 믿는다.
 *
 * ## ⚠ 지난 일정에 평가 글이 붙어 있으면 제목이 그 글로 간다
 * 캘린더가 콘텐츠로 이어지는 자리이고, 이게 사이트의 1순위 목적(글로 보내기)과 맞는다.
 * 다만 홈에 오는 것은 앞으로의 일정이라 대개 글이 아직 없다 — 있으면 잇는다.
 */
export function UpcomingCalendar({
  events,
  today,
  total,
}: {
  events: CalendarEvent[];
  today: string;
  /** 다가올 일정 전체 건수. 4건을 넘으면 「+N건 더」로 캘린더에 넘긴다. */
  total: number;
}) {
  if (events.length === 0) return null;

  const more = total - events.length;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <SectionHeader
        title="다가오는 일정"
        action={
          <Link
            href="/macro/calendar"
            className="flex shrink-0 items-center gap-0.5 text-xs text-gold-400 hover:text-gold-500"
          >
            {more > 0 ? `+${more}건 더` : "전체 일정"}
            <ChevronRightIcon size={13} />
          </Link>
        }
      />

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {events.map((event) => {
          const time = eventTime(event);
          const dday = ddayLabel(event, today);
          return (
            <li
              key={event.id}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl border border-border px-3.5 py-3"
            >
              <span className="font-mono text-[11.5px] tabular-nums text-ink-3">
                {seoulDay(event.at)}
                {/* ⚠ 시각은 아는 일정에만 적는다 — eventTime()이 그 판단을 이미 한다. */}
                {time && ` ${time}`}
              </span>
              <Badge tone={dday === "오늘" ? "gold" : "neutral"}>{dday}</Badge>
              <span className="w-full text-[13.5px] font-medium leading-snug text-ink">
                {event.postSlug ? (
                  <Link
                    href={`/insights/${event.postSlug}`}
                    className="underline-offset-2 hover:text-gold-500 hover:underline"
                  >
                    {event.title}
                  </Link>
                ) : (
                  event.title
                )}
              </span>
              <span className="text-[11px] text-ink-3">
                {kindLabel(event.kind)} · {countryLabel(event.country)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
