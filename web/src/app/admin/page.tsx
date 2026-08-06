import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatBar";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon, AlertIcon } from "@/components/icons";
import { OutboundStats } from "@/features/site/ui/OutboundStats";
import { cx, formatDateTime, formatPct } from "@/lib/format";
import { adminStats, comments, aiProviders } from "@/lib/mock";
import { loadAllPosts } from "@/features/posts/repository";

const QUICK = [
  { href: "/admin/posts", label: "새 글 작성", desc: "인사이트·분석·공지" },
  { href: "/admin/model-portfolio", label: "포트폴리오 편집", desc: "종목·목표비중·thesis" },
  { href: "/admin/comments", label: "댓글 모더레이션", desc: "승인·숨김·신고" },
  { href: "/admin/feeds", label: "RSS 가져오기", desc: "티스토리 큐레이션" },
];

/** 티스토리 유입 집계를 DB에서 읽으므로 정적 생성하지 않는다. */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const posts = await loadAllPosts(20);
  const pending = comments.filter((c) => c.status === "PENDING" || c.reported);
  const maxVisitor = Math.max(...adminStats.weeklyVisitors);
  const tokenPct = (adminStats.aiTokensUsed / adminStats.aiTokenCap) * 100;

  return (
    <AdminShell>
      <AdminPageHeader
        title="대시보드"
        description="사이트 활동 요약입니다. (방문·댓글·AI는 Phase 0 목업, 티스토리 유입은 실데이터)"
      />

      {/* 1순위 지표를 맨 위에 둔다 — 이 사이트의 목적이 블로그 트래픽 유도다. */}
      <div className="mb-7">
        <OutboundStats />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatTile
          label="오늘 방문자"
          value={adminStats.visitorsToday.toLocaleString("ko-KR")}
          sub={`전주 대비 ${formatPct(adminStats.visitorsDelta)}`}
          tone="up"
        />
        <StatTile
          label="새 댓글"
          value={`${adminStats.newComments}건`}
          sub={`승인 대기 ${adminStats.pendingComments} · 신고 ${adminStats.reportedComments}`}
          tone={adminStats.pendingComments > 0 ? "gold" : "default"}
        />
        <StatTile
          label="발행 글"
          value={`${adminStats.publishedPosts}개`}
          sub={`작성중 ${adminStats.draftPosts}`}
        />
        <StatTile label="회원" value={`${adminStats.members}명`} sub="관리자 제외" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* 방문자 추이 */}
        <Card>
          <CardTitle>최근 7일 방문자</CardTitle>
          <div className="flex items-end gap-2 h-40">
            {adminStats.weeklyVisitors.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] text-gray-500 tabular-nums">{v}</span>
                <div
                  className={cx(
                    "w-full rounded-t-md transition-colors",
                    i === adminStats.weeklyVisitors.length - 1
                      ? "bg-gold-500"
                      : "bg-emerald-600/70",
                  )}
                  style={{ height: `${(v / maxVisitor) * 100}%` }}
                />
                <span className="text-[10px] text-gray-600">
                  {["월", "화", "수", "목", "금", "토", "일"][i]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* AI 사용량 */}
        <Card>
          <CardTitle
            action={
              <Link
                href="/admin/ai"
                className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
              >
                설정
                <ChevronRightIcon size={12} />
              </Link>
            }
          >
            AI 월 토큰 사용량
          </CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">
              {(adminStats.aiTokensUsed / 1000).toFixed(0)}K
            </span>
            <span className="text-xs text-muted">
              / {(adminStats.aiTokenCap / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#12141c] overflow-hidden">
            <div
              className={cx(
                "h-full rounded-full",
                tokenPct > 80 ? "bg-red-400" : tokenPct > 50 ? "bg-yellow-400" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, tokenPct)}%` }}
            />
          </div>
          <div className="mt-5 space-y-2.5">
            {aiProviders
              .filter((p) => p.enabled)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span
                    className={cx(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      p.connected ? "bg-emerald-400" : "bg-gray-600",
                    )}
                  />
                  <span className="text-[12px] text-gray-300 flex-1 truncate">{p.name}</span>
                  {p.free && <Badge tone="emerald">무료</Badge>}
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {(p.tokensUsedThisMonth / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* 처리 대기 */}
      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <Card padding="p-0">
          <div className="px-5 pt-5">
            <CardTitle
              action={
                <Link
                  href="/admin/comments"
                  className="text-[11px] text-gold-400 hover:text-gold-500 flex items-center gap-0.5"
                >
                  전체
                  <ChevronRightIcon size={12} />
                </Link>
              }
            >
              <span className="flex items-center gap-2">
                <AlertIcon size={15} className="text-yellow-400" />
                처리 대기 댓글
              </span>
            </CardTitle>
          </div>
          {pending.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-muted">처리할 항목이 없습니다.</p>
          ) : (
            <ul>
              {pending.map((c) => (
                <li key={c.id} className="px-5 py-3.5 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Badge tone={c.status === "PENDING" ? "warn" : "danger"}>
                      {c.status === "PENDING" ? "승인대기" : "신고됨"}
                    </Badge>
                    <span className="text-[12px] text-white">{c.authorName}</span>
                    <span className="text-[11px] text-gray-600 ml-auto">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] text-gray-400 line-clamp-1">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>빠른 작업</CardTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="block px-4 py-3.5 rounded-xl border border-border hover:border-gold-600/40 hover:bg-cardHover transition-colors"
              >
                <p className="text-[13px] font-medium text-white">{q.label}</p>
                <p className="text-[11px] text-muted mt-1">{q.desc}</p>
              </Link>
            ))}
          </div>
          {posts.length > 0 && (
            <p className="mt-5 pt-4 border-t border-border/70 text-[11px] text-gray-600">
              최근 글 · {posts[0].title}
            </p>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
