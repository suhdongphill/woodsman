import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { adsStatus } from "@/lib/ads";
import { getAdsSettings } from "@/lib/site-settings";
import { AdsForm } from "@/features/ads/ui/AdsForm";

export const metadata: Metadata = { title: "광고" };

/** ⚠ 정적 생성 금지 — 껐는데 계속 켜져 보이면 안 된다. */
export const dynamic = "force-dynamic";

/**
 * 광고(AdSense) 설정.
 *
 * ## ⚠ 등록과 노출은 다른 결정이다
 * ID를 넣어 두는 것과 광고를 켜는 것을 **한 스위치로 묶지 않는다.** 실제 운영 순서가
 * "값을 먼저 받아 두고, 콘텐츠가 자리 잡은 뒤에 켠다"이기 때문이다(2026-08-30 사용자 결정).
 *
 * ## ⚠ 티스토리 CTA가 광고보다 위다
 * 운영지침 §4. 자리 경쟁이 붙으면 광고를 내린다 — 1순위 지표는 광고 수익이 아니라
 * 「티스토리로 넘어간 클릭」이다. 광고를 켠 뒤에 그 클릭이 줄면, 광고가 아니라 자리를 의심한다.
 */
export default async function AdminAdsPage() {
  await requireAdmin("/admin/ads");

  const settings = await getAdsSettings();
  const status = adsStatus(settings);

  return (
    <AdminShell>
      <AdminPageHeader
        title="광고"
        description="애드센스 퍼블리셔·슬롯 ID를 등록합니다. 등록해 두고 나중에 켤 수 있습니다."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-[12px]">
        {status.live ? (
          <Badge tone="emerald">지금 광고가 나가고 있습니다</Badge>
        ) : (
          <Badge tone="neutral">지금은 광고가 나가지 않습니다</Badge>
        )}
        <Badge tone="neutral">
          퍼블리셔 {status.clientConfigured ? "등록됨" : "없음"}
        </Badge>
        {status.placements.map((p) => (
          <Badge key={p.placement} tone="neutral">
            {p.label} {p.configured ? "등록됨" : "없음"}
          </Badge>
        ))}
      </div>

      <Card className="mb-6">
        <CardTitle>ID 등록</CardTitle>
        <AdsForm settings={settings} />
      </Card>

      <Card>
        <CardTitle>켜기 전에 알아 둘 것</CardTitle>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-muted">
          <li>
            · ⚠ <strong className="text-ink">티스토리 CTA가 광고보다 위입니다.</strong> 자리 경쟁이
            붙으면 광고를 내립니다 — 1순위 지표는 광고 수익이 아니라 「티스토리로 넘어간
            클릭」입니다.
          </li>
          <li>
            · ⚠ <strong className="text-ink">켜기 전에 `/privacy`를 고쳐야 합니다.</strong> 지금은
            “향후 게재할 수 있습니다”로 적혀 있어, 실제로 켜는 순간 사실과 달라집니다.{" "}
            <Link href="/privacy" className="text-gold-500 underline">
              개인정보 처리방침 보기
            </Link>
          </li>
          <li>
            · 광고 자리는 <strong className="text-ink">글 본문 끝 · 목록 끝 · 페이지 하단</strong>{" "}
            세 곳뿐입니다. 첫 화면에는 넣지 않습니다.
          </li>
          <li>
            · ⚠ <strong className="text-ink">슬롯 ID가 없는 자리는 그리지 않습니다.</strong> 빈 상자를
            깔아 두면 레이아웃만 비고 얻는 게 없습니다.
          </li>
          <li>
            · <code className="font-mono text-ink-3">/ads.txt</code>는 퍼블리셔 ID만 있으면 나갑니다
            — 광고를 끈 상태에서도 심사에 필요합니다.
          </li>
        </ul>
      </Card>
    </AdminShell>
  );
}
