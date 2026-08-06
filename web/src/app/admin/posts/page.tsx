import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { EditIcon, TrashIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { loadAllPosts, findPost } from "@/features/posts/repository";
import { deletePostAction } from "@/features/posts/actions";
import { PostEditor } from "@/features/posts/ui/PostEditor";
import { SECTION_LABEL } from "@/lib/sections";

export const metadata: Metadata = { title: "콘텐츠" };

/** ⚠ 정적 생성 금지 — 글을 저장해도 화면이 안 바뀌는 사고가 난다. */
export const dynamic = "force-dynamic";

/**
 * 콘텐츠 관리.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`를 읽고 "새 글" 버튼이 **아무 데도 연결돼 있지 않았다.**
 *    투자일지·대표 포트폴리오와 같은 사고였다. 지금은 D1에 쓰고, 여기서 발행한 글이
 *    각 섹션 프레임에 쌓인다.
 */
export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin("/admin/posts");

  const [{ edit }, posts] = await Promise.all([searchParams, loadAllPosts()]);
  const editing = edit ? await findPost(edit) : null;

  const published = posts.filter((p) => p.published);
  const drafts = posts.filter((p) => !p.published);

  return (
    <AdminShell>
      <AdminPageHeader
        title="콘텐츠 관리"
        description="여기서 발행한 글이 홈·거시 지표·포트폴리오·투자일지·인사이트의 각 프레임에 쌓입니다. 기본은 보이는 화면 그대로 쓰고, 필요하면 마크다운이나 HTML로 내려가 고칠 수 있습니다."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-[12px] text-gray-400">
        <Badge tone="emerald">발행 {published.length}</Badge>
        <Badge tone="neutral">작성중 {drafts.length}</Badge>
      </div>

      <Card className="mb-6">
        <CardTitle
          action={
            editing ? (
              <Link
                href="/admin/posts"
                className="text-[12px] text-gold-400 hover:text-gold-500"
              >
                + 새 글 쓰기
              </Link>
            ) : undefined
          }
        >
          {editing ? `수정: ${editing.title}` : "새 글"}
        </CardTitle>
        {/* key: 다른 글을 편집할 때 편집기가 이전 본문을 붙들고 있지 않게 */}
        <PostEditor key={editing?.id ?? "new"} post={editing ?? undefined} />
      </Card>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>글 목록 ({posts.length}편)</CardTitle>
        </div>
        {posts.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 글이 없습니다. 위에서 첫 글을 써 보세요.
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
              {posts.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-white">
                    <span className="block truncate">{p.title}</span>
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
                        href={`/admin/posts?edit=${p.id}`}
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
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </AdminShell>
  );
}
