import Script from "next/script";
import { adsenseClientId } from "@/lib/ads";
import { getAdsSettings } from "@/lib/site-settings";

/**
 * Google AdSense 스크립트 슬롯.
 *
 * ⚠ 관리자 화면에서 **켜져 있고** 퍼블리셔 ID가 형식에 맞을 때만 넣는다.
 * 둘 중 하나라도 없으면 아무것도 넣지 않아, 개발 화면이 광고 요청으로 지저분해지지 않는다.
 *
 * 퍼블리셔 ID는 비밀이 아니다(페이지 소스에 그대로 노출되는 값). 그래서 DB에 두고
 * 관리자 화면에서 고친다 — **재배포 없이 즉시 내릴 수 있어야** 하기 때문이다.
 *
 * 광고 자리(ins 태그)는 `AdSlot` 컴포넌트가 그린다 — 배치 의도와 정책은
 * `src/lib/ads.ts` 주석 참고. 슬롯 ID가 없으면 자리도 그리지 않는다.
 */
export async function AdSense() {
  const settings = await getAdsSettings();
  // ⚠ 스위치가 꺼져 있으면 ID가 있어도 스크립트를 넣지 않는다.
  if (!settings.enabled) return null;
  const clientId = adsenseClientId(settings);
  if (!clientId) return null;

  return (
    <Script
      id="google-adsense"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
    />
  );
}
