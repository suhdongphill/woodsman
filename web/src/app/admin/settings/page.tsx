import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { SiteBasicsForm } from "@/features/site/ui/SiteBasicsForm";
import { getSiteBasics } from "@/lib/site-settings";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "사이트 기본값" };

/** ⚠ 정적 생성 금지 — 저장해도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 사이트 기본값.
 *
 * 처음 개발할 때 코드에 박아 둔 값(문의 메일·티스토리 주소·홈 문구)을 여기서 고친다.
 * 전에는 이 값들이 다섯 파일에 흩어져 있어 바꿀 때마다 개발자가 필요했고,
 * 실제로 메일 주소 하나를 바꿀 때 두 곳이 옛 주소로 남았다.
 */
export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const basics = await getSiteBasics();

  return (
    <AdminShell>
      <AdminPageHeader
        title="사이트 기본값"
        description="처음 개발할 때 정해 둔 값들을 여기서 고칩니다. 빈 칸으로 두면 코드의 기본값으로 되돌아갑니다."
      />

      <Card>
        <SiteBasicsForm basics={basics} />
      </Card>

      <p className="mt-5 text-[11px] leading-relaxed text-gray-600">
        가입·커뮤니티·댓글 스위치는{" "}
        <a href="/admin/comments" className="text-gold-500 hover:underline">
          댓글 · 정책
        </a>
        에 있습니다. AI 키는{" "}
        <a href="/admin/ai" className="text-gold-500 hover:underline">
          AI 제공자
        </a>
        에서 등록합니다.
      </p>
    </AdminShell>
  );
}
