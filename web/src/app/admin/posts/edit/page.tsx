import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { findPost } from "@/features/posts/repository";
import { PostEditor } from "@/features/posts/ui/PostEditor";

export const metadata: Metadata = { title: "글 수정" };

/** ⚠ 정적 생성 금지 — 고쳐도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 글 수정 — **편집기만 있는 화면**(이유는 `../new/page.tsx` 주석 참고).
 *
 * ⚠ 글 id를 **경로가 아니라 질의(`?id=`)로 받는다.** id에 `:`와 `.`이 들어 있어
 *    (`po_2026-08-24T14:52:40.852Z_…`) 경로 세그먼트에 넣으면 정적 자산 요청으로
 *    오인될 여지가 있다. 주소 모양보다 **확실히 열리는 것**이 중요하다.
 */
export default async function EditPostPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; slugAdjusted?: string }>;
}) {
  await requireAdmin("/admin/posts");

  const { id, slugAdjusted } = await searchParams;
  const post = id ? await findPost(id) : null;

  return (
    <AdminShell>
      <AdminPageHeader
        title={post ? "글 수정" : "글을 찾지 못했습니다"}
        description={
          post
            ? "고친 내용은 저장을 눌러야 반영됩니다."
            : "주소의 글 번호에 해당하는 글이 없습니다."
        }
        action={
          <Link
            href="/admin/posts"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            글 목록
          </Link>
        }
      />

      {/* ⚠ 새 글을 저장하며 주소를 비켰으면, 넘어온 화면에서 그 사실을 말한다. */}
      {post && slugAdjusted && (
        <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-yellow-200">
          같은 주소를 쓰는 글이 있어 주소를 비켜 저장했습니다 —{" "}
          <span className="font-mono">/{post.slug}</span>. 그대로 두셔도 되고, 아래에서 고쳐도
          됩니다.
        </p>
      )}
      {post ? (
        <Card>
          <CardTitle>수정: {post.title}</CardTitle>
          <PostEditor post={post} />
        </Card>
      ) : (
        /* ⚠ 조용히 새 글 폼으로 떨어뜨리지 않는다. "없는 것"과 "새로 쓰는 것"은 다르다
           — 새 글 폼으로 보이면 운영자가 그대로 다시 써서 중복 글이 생긴다. */
        <Card>
          <p className="text-[13px] leading-relaxed text-muted">
            지웠거나 주소가 잘못된 글입니다. 목록에서 다시 골라 주세요.
          </p>
          <Link
            href="/admin/posts"
            className="mt-4 inline-block text-[13px] text-gold-400 hover:text-gold-500"
          >
            글 목록으로 →
          </Link>
        </Card>
      )}
    </AdminShell>
  );
}
