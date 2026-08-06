import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AlertIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { decideUserDelete, deleteSideEffects } from "@/lib/user-delete";
import { countAdmins, loadUsers } from "@/features/users/repository";
import { DeleteUserButton } from "@/features/users/ui/DeleteUserButton";

export const metadata: Metadata = { title: "사용자" };

/** ⚠ 정적 생성 금지 — 지워도 목록이 그대로 남는다. */
export const dynamic = "force-dynamic";

/**
 * 사용자 · 권한.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`를 읽어 **삭제 버튼이 아무 일도 하지 않았다.**
 *    지금은 D1을 읽고 실제로 지운다. 다만 두 가지는 막는다(`lib/user-delete.ts`):
 *    자기 자신과 마지막 관리자 — 지우면 아무도 로그인할 수 없는 사이트가 된다.
 */
export default async function AdminUsersPage() {
  const me = await requireAdmin("/admin/users");
  const [users, adminCount] = await Promise.all([loadUsers(), countAdmins()]);

  const members = users.filter((u) => u.role !== "ADMIN");

  return (
    <AdminShell>
      <AdminPageHeader
        title="사용자 · 권한"
        description="가입 계정을 확인하고 삭제합니다. 콘텐츠 작성은 ADMIN만 가능합니다."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Badge tone="gold">관리자 {adminCount}</Badge>
        <Badge tone="neutral">회원 {members.length}</Badge>
      </div>

      <Card className="mb-6 flex items-start gap-3">
        <AlertIcon size={16} className="mt-0.5 shrink-0 text-yellow-500" />
        <div className="text-[12.5px] leading-relaxed text-muted">
          <p>
            삭제는 <strong className="text-white">되돌릴 수 없습니다.</strong> 로그인 수단과 개인
            포트폴리오가 함께 지워지고, 작성한 댓글은 남되 작성자 표시만 사라집니다.
          </p>
          <p className="mt-2">
            ⚠ <strong className="text-white">자기 자신</strong>과{" "}
            <strong className="text-white">마지막 관리자</strong>는 지울 수 없습니다. 지우는 순간
            관리 화면을 다시 열 방법이 없어지기 때문입니다. 관리자 계정은 서버{" "}
            <code className="text-gold-400">.env</code>의 값으로 시드 시 다시 만들어집니다.
          </p>
        </div>
      </Card>

      <Card padding="p-0">
        <Table>
          <caption className="sr-only">가입 계정 목록</caption>
          <thead>
            <Tr>
              <Th>계정</Th>
              <Th className="w-24">권한</Th>
              <Th className="w-24 text-right">댓글</Th>
              <Th className="w-28">가입</Th>
              <Th className="w-64 text-right">관리</Th>
            </Tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const decision = decideUserDelete({
                target: { id: user.id, role: user.role, email: user.email },
                currentUserId: me.id,
                adminCount,
              });

              return (
                <Tr key={user.id}>
                  <Td className="text-white">
                    <span className="block truncate">{user.name ?? "(이름 없음)"}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-600">{user.email}</span>
                  </Td>
                  <Td>
                    {user.role === "ADMIN" ? (
                      <Badge tone="gold">ADMIN</Badge>
                    ) : (
                      <Badge tone="neutral">USER</Badge>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-muted">{user.commentCount}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted">
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <DeleteUserButton
                        id={user.id}
                        email={user.email}
                        sideEffects={deleteSideEffects(user.commentCount)}
                        disabledReason={decision.allowed ? undefined : decision.reason}
                      />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>

        {users.length === 0 && (
          <p className="px-5 pb-5 text-[13px] text-muted">계정이 없습니다.</p>
        )}
      </Card>
    </AdminShell>
  );
}
