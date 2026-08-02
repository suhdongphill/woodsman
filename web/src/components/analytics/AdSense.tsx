import Script from "next/script";
import { adsenseClientId } from "@/lib/ads";

/**
 * Google AdSense 스크립트 슬롯.
 *
 * `ADSENSE_CLIENT_ID`가 설정된 경우에만 삽입한다. 심사 전이거나 로컬에서는
 * 아무것도 넣지 않아 개발 화면이 광고 요청으로 지저분해지지 않는다.
 *
 * 퍼블리셔 ID는 비밀이 아니다(페이지 소스에 그대로 노출되는 값). 그래도 코드에
 * 박지 않고 환경변수로 두는 이유는, 계정이 바뀌거나 심사 중 잠시 내려야 할 때
 * 재배포 없이 대시보드에서 끄고 켜기 위해서다.
 *
 * 광고 자리(ins 태그)는 `AdSlot` 컴포넌트가 그린다 — 배치 의도와 정책은
 * `src/lib/ads.ts` 주석 참고. 슬롯 ID가 없으면 자리도 그리지 않는다.
 */
export function AdSense() {
  const clientId = adsenseClientId();
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
