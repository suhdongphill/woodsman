import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdSlot } from "@/components/analytics/AdSlot";
import { seoulDay, seoulTime } from "@/lib/kst";
import {
  countryLabel,
  eventStatus,
  groupByDay,
  kindLabel,
  needsReview,
  upcoming,
} from "@/lib/macro-calendar";
import { loadEvents } from "@/features/calendar/repository";

/** ⚠ 보이는 문자열은 위쪽에 모은다 — 나중에 다국어를 넣을 때 여기만 본다. */
const TEXT = {
  eyebrow: "CALENDAR",
  title: "경제 캘린더",
  description:
    "시장을 움직이는 일정입니다. 실적 발표·지표 발표·중앙은행 회의를 모아 두고, 지나간 일정에는 그때 무엇이 바뀌었는지 평가를 답니다.",
  subscribe: "구글 캘린더에 구독하기",
  subscribeHint:
    "구글 캘린더 → 다른 캘린더 추가 → URL로 추가 에 아래 주소를 넣으면 일정이 그대로 들어갑니다.",
  upcoming: "다가오는 일정",
  empty: "아직 등록된 일정이 없습니다.",
  reviewPending: "아직 평가 없음",
  readReview: "평가 읽기",
};

export const metadata: Metadata = {
  title: TEXT.title,
  description:
    "FOMC·금통위, CPI·고용 등 지표 발표, 주요 기업 실적 발표 일정을 모았습니다. 지나간 일정에는 무엇이 바뀌었는지 평가를 답니다.",
};

/** ⚠ 정적 생성 금지 — 오늘이 언제인지에 따라 화면이 달라진다. */
export const dynamic = "force-dynamic";

export default async function MacroCalendarPage() {
  const events = await loadEvents(300);
  const today = seoulDay(new Date().toISOString());
  const next = upcoming(events, today, 5);
  const pending = needsReview(events, today, 3);
  const days = groupByDay(events);

  return (
    <>
      <PageHeader eyebrow={TEXT.eyebrow} title={TEXT.title} description={TEXT.description} />

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        {/* 구독 — ⚠ 회원 가입 없이 되는 길이다 */}
        <Card>
          <p className="text-[13px] font-semibold text-ink">{TEXT.subscribe}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{TEXT.subscribeHint}</p>
          <p className="mt-2.5 overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink">
            https://portfolio-solutions.net/calendar.ics
          </p>
        </Card>

        {events.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">{TEXT.empty}</p>
          </Card>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-ink">{TEXT.upcoming}</h2>
              <div className="space-y-2.5">
                {next.map((e) => (
                  <Card key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-[12px] tabular-nums text-ink-3">
                      {seoulDay(e.at)} {seoulTime(e.at)}
                    </span>
                    <span className="text-[13.5px] font-medium text-ink">{e.title}</span>
                    <Badge tone="neutral">{kindLabel(e.kind)}</Badge>
                    <span className="text-[11px] text-ink-3">{countryLabel(e.country)}</span>
                    {e.note && (
                      <span className="w-full text-[12.5px] leading-relaxed text-muted">
                        {e.note}
                      </span>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {/* ⚠ 평가가 밀린 것을 감추지 않는다 — 읽는 사람에게도 "다음에 올 글"이 보인다 */}
            {pending.length > 0 && (
              <section>
                <h2 className="mb-3 text-[15px] font-semibold text-ink">평가를 준비 중인 일정</h2>
                <div className="space-y-2.5">
                  {pending.map((e) => (
                    <Card key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-[12px] tabular-nums text-ink-3">
                        {seoulDay(e.at)}
                      </span>
                      <span className="text-[13.5px] text-ink">{e.title}</span>
                      <span className="text-[11px] text-gold-500">{TEXT.reviewPending}</span>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-ink">전체 일정</h2>
              <div className="space-y-5">
                {days.map(({ day, items }) => (
                  <div key={day}>
                    <p className="mb-1.5 font-mono text-[11.5px] text-ink-3">{day}</p>
                    <ul className="space-y-1.5">
                      {items.map((e) => {
                        const status = eventStatus(e, today);
                        return (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]"
                          >
                            <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
                              {seoulTime(e.at)}
                            </span>
                            <span className="text-ink">{e.title}</span>
                            <span className="text-[11px] text-ink-3">{kindLabel(e.kind)}</span>
                            {status.kind === "reviewed" ? (
                              <Link
                                href={`/insights/${status.slug}`}
                                className="text-[11.5px] text-gold-500 hover:text-gold-400"
                              >
                                {TEXT.readReview} →
                              </Link>
                            ) : (
                              <span className="text-[11px] text-ink-3">{status.label}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <AdSlot placement="content-bottom" />
      </div>
    </>
  );
}
