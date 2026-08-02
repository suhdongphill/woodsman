import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, Chip } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SearchIcon, TrashIcon, AlertIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { users } from "@/lib/mock";

export const metadata: Metadata = { title: "사용자" };

const TABS = ["전체", "ADMIN", "USER"];

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="사용자 · 권한"
        description="가입 회원의 역할을 변경합니다. 콘텐츠 작성은 ADMIN만 가능합니다."
      />

      <Card className="mb-6 flex items-start gap-3">
        <AlertIcon size={16} className="text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-muted leading-relaxed">
          관리자 계정은 서버 <code className="text-gold-400">.env</code>의{" "}
          <code className="text-gold-400">ADMIN_EMAIL</code> /{" "}
          <code className="text-gold-400">ADMIN_PASSWORD</code>로 시드 시 upsert 됩니다. 비밀번호를
          잊었다면 env 값을 바꿔 재배포하면 갱신됩니다(이메일 복구 없음).
        </p>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex flex-wrap gap-2 flex-1">
          {TABS.map((t, i) => (
            <Chip key={t} active={i === 0}>
              {t}
            </Chip>
          ))}
        </div>
        <div className="relative sm:w-60">
          <SearchIcon
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
          <input
            type="search"
            placeholder="이메일·닉네임 검색"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-600 transition-colors"
          />
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>사용자</Th>
            <Th className="w-32">역할</Th>
            <Th className="w-28">가입일</Th>
            <Th className="w-24 text-right">댓글</Th>
            <Th className="w-20 text-right">작업</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Tr key={u.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-emerald-900 text-emerald-200 text-[12px] flex items-center justify-center font-semibold shrink-0">
                    {(u.name ?? u.email).slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-[13px]">{u.name}</p>
                    <p className="text-[11px] text-gray-600">{u.email}</p>
                  </div>
                </div>
              </Td>
              <Td>
                {u.role === "ADMIN" ? (
                  <Badge tone="gold">ADMIN</Badge>
                ) : (
                  <select
                    defaultValue={u.role}
                    className="bg-[#12141c] border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-ink"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                )}
              </Td>
              <Td className="text-[11px] text-gray-500 tabular-nums">
                {formatDate(u.createdAt)}
              </Td>
              <Td className="text-right tabular-nums text-gray-400">{u.commentCount}</Td>
              <Td>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={u.role === "ADMIN"}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-cardHover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="삭제"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </AdminShell>
  );
}
