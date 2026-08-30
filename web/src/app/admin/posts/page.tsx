import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { EditIcon, TrashIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { loadAllPosts } from "@/features/posts/repository";
import { deletePostAction } from "@/features/posts/actions";
import { SECTION_LABEL } from "@/lib/sections";

export const metadata: Metadata = { title: "콘텐츠" };

/** ⚠ 정적 생성 금지 — 글을 저장해도 화면이 안 바뀌는 사고가 난다. */
export const dynamic = "force-dynamic";

/**
 * 콘텐츠 관리 — **목록만 있는 화면**.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`를 읽고 "새 글" 버튼이 **아무 데도 연결돼 있지 않았다.**
 *    투자일지·대표 포트폴리오와 같은 사고였다. 지금은 D1에 쓰고, 여기서 발행한 글이
 *    각 섹션 프레임에 쌓인다.
 *
 * ⚠ 2026-08-30 사고: 여기에 **편집기가 같이 얹혀 있었다.** 그래서 목록만 보려는 사람도
 *    편집기의 미리보기 변환기(`markdown` + `sanitize-html`)를 클라이언트로 다 받아야 했고,
 *    그 JS가 붙기 전에 누른 「편집」이 **삼켜져 아무 일도 일어나지 않았다.**
 *    운영자는 "편집이 안 된다"고 판단해 같은 글을 새로 써서 저장했다(중복 글의 원인).
 *    ⚠ **이 화면에 편집기를 다시 얹지 않는다.** 목록은 가벼워야 클릭이 즉시 먹는다.
 */
export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin("/admin/posts");

  const { edit } = await searchParams;
  // 옛 주소(`/admin/posts?edit=…`)로 들어온 북마크·링크를 끊지 않는다.
  if (edit) redirect(`/admin/posts/edit?id=${encodeURIComponent(edit)}`);

  const posts = await loadAllPosts();
  const published = posts.filter((p) => p.published);
  const drafts = posts.filter((p) => !p.published);

  return (
    <AdminShell>
      <AdminPageHeader
        title="콘텐츠 관리"
        description="여기서 발행한 글이 홈·거시 지표·포트폴리오·투자일지·인사이트의 각 프레임에 쌓입니다. 제목을 누르면 그 글의 수정 화면으로 갑니다."
        action={
          <Link
            href="/admin/posts/new"
            className="rounded-xl bg-gold-600/90 px-3 py-2 text-[12.5px] font-medium text-black transition-colors hover:bg-gold-600"
          >
            + 새 글 쓰기
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2 text-[12px] text-gray-400">
        <Badge tone="emerald">발행 {published.length}</Badge>
        <Badge tone="neutral">작성중 {drafts.length}</Badge>
      </div>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>글 목록 ({posts.length}편)</CardTitle>
        </div>
        {posts.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 글이 없습니다.{" "}
            <Link href="/admin/posts/new" className="text-gold-400 hover:text-gold-500">
              첫 글을 써 보세요
            </Link>
            .
          </p>
        ) : (
          <Table>
            <caption className="sr-only">작성한 글 목록</caption>
            <thead>
              <Tr>
                <Th>제목</Th>
                <Th className="w-24">유형</Th>
                <Th className="w-28">쌓이는 자리</Th>
                <Th className="w-20">형식</Th>
                <Th className="w-24">상태</Th>
                <Th className="w-28">수정</Th>
                <Th className="w-24 text-right">관리</Th>
              </Tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const editHref = `/admin/posts/edit?id=${encodeURIComponent(p.id)}`;
                return (
                  <Tr key={p.id}>
                    <Td className="text-white">
                      {/* 제목 전체가 편집 링크다 — 14px 연필 아이콘만 과녁으로 두면 빗나간다. */}
                      <Link href={editHref} className="block truncate hover:text-gold-400">
                        {p.title}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[11px] text-gray-600">
                        /{p.slug}
                        {p.source === "TISTORY" && p.externalUrl && (
                          <a
                            href={p.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 inline-flex items-center gap-0.5 text-gold-500 hover:text-gold-400"
                          >
                            원문
                            <ExternalIcon size={10} />
                          </a>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <PostTypeBadge type={p.type} />
                    </Td>
                    <Td className="text-muted">{SECTION_LABEL[p.section]}</Td>
                    <Td className="text-gray-500">
                      {p.format === "HTML" ? "HTML" : "마크다운"}
                    </Td>
                    <Td>
                      {p.published ? (
                        <Badge tone="emerald">발행</Badge>
                      ) : (
                        <Badge tone="neutral">작성중</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums text-muted">
                      {p.updatedAt ? formatDate(p.updatedAt) : "—"}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={editHref}
                          aria-label={`${p.title} 편집`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover hover:text-white"
                        >
                          <EditIcon size={14} />
                        </Link>
                        <form action={deletePostAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            aria-label={`${p.title} 삭제`}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover hover:text-red-400"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </form>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </AdminShell>
  );
}
