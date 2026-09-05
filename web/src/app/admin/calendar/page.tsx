import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrashIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/session";
import { seoulDay } from "@/lib/kst";
import {
  countryLabel,
  eventStatus,
  eventTime,
  groupByDay,
  importanceLabel,
  kindLabel,
  needsReview,
} from "@/lib/macro-calendar";
import { loadEvents } from "@/features/calendar/repository";
import { deleteEventAction, linkPostAction } from "@/features/calendar/actions";
import { EventForm } from "@/features/calendar/ui/EventForm";
import { AiDraftPanel } from "@/features/calendar/ui/AiDraftPanel";

export const metadata: Metadata = { title: "경제 캘린더" };

/** ⚠ 정적 생성 금지 — 방금 넣은 일정이 안 보이면 캘린더가 아니다. */
export const dynamic = "force-dynamic";

/**
 * 경제 캘린더 관리.
 *
 * ## 이 화면이 하는 일 — **콘텐츠 파이프라인**
 * 일정이 다음에 쓸 글을 알려 주고, 쓴 글이 다음 일정에서 다시 읽힌다.
 * ⚠ 그래서 맨 위에 **「평가가 밀린 일정」**을 둔다. 지나갔는데 글이 없는 것이 곧 할 일이다.
 *
 * ## 일정은 어디서 오나 (2026-09-05)
 * 손으로 넣는 길과 **AI 초안**을 받는 길, 둘이다. 손으로만 넣으면 캘린더는 결국 빈다 —
 * 수집이 사람의 기억에 걸려 있어 환율이 열흘 늙었던 것과 같은 자리다(2026-09-01).
 * ⚠ 그래도 **AI가 직접 쓰지는 않는다.** 받아 온 것은 후보로만 뜨고 채택은 사람이 한다.
 *    날짜는 틀려도 화면이 멀쩡해 보이는 값이라, 마지막 한 걸음을 사람에게 남긴다.
 */
export default async function AdminCalendarPage() {
  await requireAdmin("/admin/calendar");

  const events = await loadEvents();
  const today = seoulDay(new Date().toISOString());
  const todo = needsReview(events, today);
  const days = groupByDay(events).reverse();

  return (
    <AdminShell>
      <AdminPageHeader
        title="경제 캘린더"
        description="실적 발표·지표 발표·중앙은행 일정을 관리합니다. 지나간 일정에 평가 글을 이으면 그 글이 다음 일정에서 다시 읽힙니다."
        action={
          <Link
            href="/macro/calendar"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            공개 화면 보기
          </Link>
        }
      />

      <Card className="mb-6">
        <CardTitle>일정 추가</CardTitle>
        <EventForm today={today} />
      </Card>

      {/* ⚠ 제안까지만 한다. 채택은 사람이 누른다 — `features/calendar/ai-actions.ts` 머리말 */}
      <Card className="mb-6">
        <CardTitle>AI 초안</CardTitle>
        <AiDraftPanel />
      </Card>

      {/* ⚠ 빈 칸을 감추지 않는다 — 지나갔는데 글이 없는 것이 다음에 쓸 것이다. */}
      <Card className="mb-6">
        <CardTitle>평가가 밀린 일정 ({todo.length}건)</CardTitle>
        {todo.length === 0 ? (
          <p className="text-[13px] text-muted">밀린 것이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {todo.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-[11px] text-ink-3">{seoulDay(e.at)}</span>
                <span className="text-[13px] text-ink">{e.title}</span>
                <Badge tone="neutral">{kindLabel(e.kind)}</Badge>
                <form action={linkPostAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={e.id} />
                  <input
                    name="postSlug"
                    placeholder="평가 글 주소"
                    className="w-40 rounded-lg border border-border bg-bg px-2 py-1 font-mono text-[11.5px] text-ink placeholder:text-ink-3"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-gold-600/40 hover:text-ink"
                  >
                    잇기
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {days.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            아직 일정이 없습니다. 다음 FOMC·CPI 발표일부터 넣어 보세요.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ day, items }) => (
            <Card key={day} padding="p-0">
              <div className="px-5 pt-5">
                <CardTitle>
                  {day} ({items.length}건)
                </CardTitle>
              </div>
              <ul className="space-y-3 px-5 pb-5">
                {items.map((e) => {
                  const status = eventStatus(e, today);
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
                        {eventTime(e)}
                      </span>
                      <span className="text-[13px] text-ink">{e.title}</span>
                      <Badge tone="neutral">{kindLabel(e.kind)}</Badge>
                      <span className="text-[11px] text-ink-3">
                        {countryLabel(e.country)} · {importanceLabel(e.importance)}
                      </span>
                      <span
                        className={
                          status.kind === "unreviewed"
                            ? "text-[11px] text-gold-500"
                            : "text-[11px] text-ink-3"
                        }
                      >
                        {status.label}
                      </span>
                      {e.note && (
                        <span className="w-full text-[12px] leading-relaxed text-muted">
                          {e.note}
                        </span>
                      )}
                      <form action={deleteEventAction} className="ml-auto">
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          aria-label={`${e.title} 삭제`}
                          className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-cardHover hover:text-danger"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
