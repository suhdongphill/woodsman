import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { loadBlogEntries, loadRecentBlogSyncs } from "@/features/blog/repository";
import { setBlogHiddenAction, setBlogSummaryAction, syncBlogNowAction } from "@/features/blog/actions";
import { displaySummary, splitCategory } from "@/lib/blog/tistory";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "블로그 글 목록" };
export const dynamic = "force-dynamic";

/**
 * 블로그 글 목록 관리 — 티스토리 글을 매일 06:00에 자동으로 모은다(`features/blog/sync.ts`).
 * 운영자가 하는 일은 셋뿐이다: **지금 수집** · **숨기기**(글이 아닌 페이지 등) · **요약 고쳐 쓰기**.
 *
 * ⚠ 맨 위는 **수집 기록**이다 — 「안 돌았다」와 「돌았는데 새 글이 없었다」가 여기서 갈린다(조용한 실패 금지).
 */
export default async function AdminBlogPage() {
  await requireAdmin("/admin/blog");
  const [entries, syncs] = await Promise.all([loadBlogEntries(), loadRecentBlogSyncs(5)]);
  const last = syncs[0];

  return (
    <AdminShell>
      <AdminPageHeader
        title="블로그 글 목록"
        description="티스토리 글을 매일 아침 6시에 자동으로 모아 홈 「블로그」와 /blog에 보입니다. 요약은 티스토리가 본문 앞을 자른 것이라, 어색하면 여기서 고쳐 쓰세요."
        action={
          <Link href="/blog" className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 hover:border-gold-600/40 hover:text-ink">
            /blog에서 보기
          </Link>
        }
      />

      <Card className="mb-6">
        <CardTitle
          action={
            <form action={syncBlogNowAction}>
              <button type="submit" className="rounded-lg bg-gold-500 px-3 py-1.5 text-[12px] font-semibold text-onAccent hover:bg-gold-400">
                지금 수집
              </button>
            </form>
          }
        >
          수집 기록
        </CardTitle>
        {!last ? (
          <p className="text-[12.5px] text-amber-300">⚠ 아직 한 번도 수집하지 않았습니다 — 「지금 수집」을 누르거나 다음 06:00 예약 수집을 기다리세요.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-[12.5px]">
            {syncs.map((s) => (
              <li key={s.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Badge tone={s.error ? "danger" : s.failCount ? "warn" : "emerald"}>{s.error ? "실패" : s.failCount ? "일부 실패" : "성공"}</Badge>
                  <span className="text-ink-3">{formatDateTime(s.startedAt)}</span>
                  <span className="text-ink-3">{s.trigger === "CRON" ? "예약" : "수동"}</span>
                  <span className="text-ink">
                    글 {s.found}편 발견 · 새 글 {s.added} · 다시 읽음 {s.refreshed} · 공감 {s.likesRead}편 읽음
                    {s.failCount ? ` · 실패 ${s.failCount}` : ""}
                  </span>
                </div>
                {s.error && <p className="mt-1 text-red-300">{s.error}</p>}
                {s.failures.slice(0, 3).map((f) => (
                  <p key={f.url} className="mt-1 break-all text-[11.5px] text-amber-300">
                    {f.reason} — {f.url}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>글 {entries.length}편 · 공개 {entries.filter((e) => !e.hidden).length}편</CardTitle>
        <ul className="divide-y divide-border/60">
          {entries.map((e) => {
            const [top, sub] = splitCategory(e.category);
            return (
              <li key={e.entryId} className="py-3 text-[12.5px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Badge tone={e.hidden ? "neutral" : "emerald"}>{e.hidden ? "숨김" : "공개"}</Badge>
                  <span className="tabular-nums text-ink-3">{formatDate(e.publishedAt)}</span>
                  <span className="text-ink-3">{sub ? `${top} · ${sub}` : top}</span>
                  <span className="tabular-nums text-ink-3">
                    공감 {e.likes ?? "못 읽음"}
                  </span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-ink hover:text-gold-500">
                    {e.title}
                  </a>
                  <form action={setBlogHiddenAction}>
                    <input type="hidden" name="entryId" value={e.entryId} />
                    <input type="hidden" name="hidden" value={e.hidden ? "0" : "1"} />
                    <button type="submit" className="text-[12px] text-gold-500 hover:text-gold-400">
                      {e.hidden ? "다시 보이기" : "숨기기"}
                    </button>
                  </form>
                </div>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[12px] text-muted">
                    요약 {e.summaryOverride ? "(직접 씀)" : "(티스토리 자동)"} — {(displaySummary(e) ?? "없음").slice(0, 60)}…
                  </summary>
                  <form action={setBlogSummaryAction} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="entryId" value={e.entryId} />
                    <textarea
                      name="summary"
                      defaultValue={e.summaryOverride ?? ""}
                      maxLength={200}
                      rows={2}
                      placeholder={`비우면 티스토리 자동 요약을 씁니다: ${(e.summary ?? "").slice(0, 80)}…`}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[12.5px] text-ink"
                    />
                    <div>
                      <button type="submit" className="rounded-lg border border-border px-3 py-1 text-[12px] text-ink hover:border-gold-600/40">
                        요약 저장 (200자까지 · 비우면 자동 요약)
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
    </AdminShell>
  );
}
