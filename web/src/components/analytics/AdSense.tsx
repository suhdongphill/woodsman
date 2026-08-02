import Script from "next/script";

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
 * 광고 위치(ins 태그)는 심사 통과 후에 붙인다 — 승인 전에 빈 광고 슬롯을 깔아두면
 * 레이아웃만 망가지고 얻는 게 없다.
 */
export function AdSense() {
  const clientId = process.env.ADSENSE_CLIENT_ID?.trim();
  if (!clientId || !/^ca-pub-\d{10,}$/.test(clientId)) return null;

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
