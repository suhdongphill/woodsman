import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { PostEditor } from "@/features/posts/ui/PostEditor";

export const metadata: Metadata = { title: "새 글" };

/** ⚠ 정적 생성 금지 — 관리자 화면이다. */
export const dynamic = "force-dynamic";

/**
 * 새 글 쓰기 — **편집기만 있는 화면**.
 *
 * ⚠ 2026-08-30 사고: 전에는 목록과 편집기가 **한 화면**에 있었다. 목록만 보려는 사람도
 *    편집기의 미리보기 변환기(`markdown` + `sanitize-html`)를 클라이언트로 전부 받아야 했고,
 *    그 JS가 붙기 전(hydration 전)에 누른 「편집」 클릭이 **삼켜져 아무 일도 일어나지 않았다.**
 *    화면이 이미 다 그려져 있으니 운영자는 당연히 누르고, 눌러도 안 되니 새로 써서 저장했다 —
 *    운영지침 §1이 이름 붙여 금지한 **「죽은 버튼」** 이다.
 *    화면을 나누면 목록이 가벼워져 그 시간창 자체가 사라진다.
 */
export default async function NewPostPage() {
  await requireAdmin("/admin/posts/new");

  return (
    <AdminShell>
      <AdminPageHeader
        title="새 글"
        description="쓰고 저장하면 수정 화면으로 넘어갑니다. 발행을 켜야 공개 화면에 나갑니다."
        action={
          <Link
            href="/admin/posts"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white"
          >
            글 목록
          </Link>
        }
      />
      <Card>
        <CardTitle>새 글</CardTitle>
        <PostEditor />
      </Card>
    </AdminShell>
  );
}
