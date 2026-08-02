import type { Metadata } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | Woodsman 관리자" },
  robots: { index: false, follow: false },
};

/**
 * 관리자 레이아웃.
 * 미들웨어가 1차로 막지만, matcher 실수 한 번에 전 구역이 열리므로 여기서 한 번 더 확인한다.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen lg:flex">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
