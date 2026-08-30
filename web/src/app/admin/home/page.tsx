import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { getSiteBasics } from "@/lib/site-settings";
import { SiteBasicsForm } from "@/features/site/ui/SiteBasicsForm";
import { loadSectionPosts } from "@/features/posts/repository";

export const metadata: Metadata = { title: "홈 편집" };

/** ⚠ 정적 생성 금지 — 고쳐도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 홈 편집.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`의 값을 보여주기만 했다. 입력칸은 있는데 **저장이 없었다**
 *    (투자일지·포트폴리오·콘텐츠에서 반복된 그 사고다).
 *
 * 지금 홈에 나가는 것은 두 가지뿐이다.
 *   ① 첫 화면 문구(제목·부제) — `SiteConfig`에 저장된다. 아래 폼이 그것을 고친다.
 *   ② 홈 섹션에 쌓이는 글 — 콘텐츠에서 "쌓일 자리 = 홈"으로 발행한 글.
 * 나머지(계좌 숫자·거시 지표·포트폴리오 배분)는 **각자의 화면에서 관리한다.**
 * 여기서 또 고치게 만들면 같은 값을 두 곳에서 고치게 되고, 한쪽이 반드시 뒤처진다.
 */
export default async function AdminHomePage() {
  await requireAdmin("/admin/home");

  const [basics, homePosts] = await Promise.all([getSiteBasics(), loadSectionPosts("HOME", 10)]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="홈 편집"
        description="첫 화면 문구와, 홈에 쌓이는 글을 관리합니다."
        action={
          <Link
            href="/"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            홈 보기
          </Link>
        }
      />

      <Card className="mb-6">
        <CardTitle>첫 화면 문구와 사이트 기본값</CardTitle>
        <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
          여기서 고친 제목·부제가 홈 상단에 그대로 나갑니다. 같은 폼에서 계좌 성격(모의/실계좌),
          기준 환율, 티스토리 링크도 함께 고칩니다 — 홈에 나가는 값들이라 한 화면에 모았습니다.
        </p>
        <SiteBasicsForm basics={basics} />
      </Card>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle
            action={
              <Link href="/admin/posts" className="text-[12px] text-gold-400 hover:text-gold-500">
                + 홈에 글 쓰기
              </Link>
            }
          >
            홈에 쌓인 글 ({homePosts.length}편)
          </CardTitle>
          <p className="pb-4 text-[12px] leading-relaxed text-gray-500">
            콘텐츠에서 <strong>쌓일 자리</strong>를 &ldquo;홈&rdquo;으로 두고 발행하면 이 목록에
            더해지고, 홈 아래쪽 프레임이 그만큼 길어집니다.
          </p>
        </div>

        {homePosts.length === 0 ? (
          <p className="border-t border-border px-5 py-5 text-[13px] text-muted">
            홈에 쌓인 글이 없습니다. 글을 쓸 때 &ldquo;쌓일 자리&rdquo;를 홈으로 고르세요.
          </p>
        ) : (
          <ul>
            {homePosts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-ink">{post.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-600">
                    {post.publishedAt ? formatDate(post.publishedAt) : "발행일 없음"} · /
                    {post.slug}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="emerald">발행</Badge>
                  <Link
                    href={`/admin/posts/edit?id=${encodeURIComponent(post.id)}`}
                    className="text-[12px] text-gold-400 hover:text-gold-500"
                  >
                    수정
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-[11px] leading-relaxed text-gray-600">
        ※ 홈의 계좌 숫자는 <Link href="/admin/journal" className="underline hover:text-gold-400">투자일지 · 계좌</Link>,
        배분 막대는 <Link href="/admin/model-portfolio" className="underline hover:text-gold-400">대표 포트폴리오</Link>,
        경제 상태는 <Link href="/admin/macro" className="underline hover:text-gold-400">거시 지표</Link>에서
        관리합니다. 같은 값을 두 곳에서 고치지 않도록 일부러 나눠 두었습니다.
      </p>
    </AdminShell>
  );
}
