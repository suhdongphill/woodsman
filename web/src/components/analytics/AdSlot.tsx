import { AD_MIN_HEIGHT, adSlotId, adsenseClientId, type AdPlacement } from "@/lib/ads";
import { getAdsSettings } from "@/lib/site-settings";
import { AdUnit } from "./AdUnit";

/**
 * 광고 자리.
 *
 * 서버에서 설정 여부를 판단해, 켜져 있을 때만 실제 광고 유닛을 그린다.
 * 꺼져 있으면 **아무것도 렌더하지 않는다** — 심사 전에 빈 상자를 깔아두면
 * 레이아웃만 비고 사용자는 뭔가 깨졌다고 느낀다.
 *
 * 배치 의도와 정책은 `src/lib/ads.ts` 주석 참고.
 */
export async function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const settings = await getAdsSettings();
  const client = adsenseClientId(settings);
  // ⚠ 스위치·퍼블리셔 ID·슬롯 ID가 **셋 다** 있어야 그린다. 하나라도 없으면 자리도 안 만든다.
  const slot = adSlotId(placement, settings);
  if (!client || !slot) return null;

  return (
    <aside
      className={`my-8 ${className ?? ""}`}
      // 스크린리더에게 본문이 아님을 알린다.
      aria-label="광고"
    >
      {/* 광고임을 표시한다 — 콘텐츠로 오인되면 정책 위반이다. */}
      <p className="mb-1.5 text-[10px] tracking-[0.14em] text-gray-600">광고</p>
      <div
        className="overflow-hidden rounded-xl border border-border/60 bg-card/40"
        // 로드 전에 자리를 잡아 콘텐츠가 밀리지 않게 한다(CLS 방지).
        style={{ minHeight: AD_MIN_HEIGHT[placement] }}
      >
        <AdUnit client={client} slot={slot} />
      </div>
    </aside>
  );
}
