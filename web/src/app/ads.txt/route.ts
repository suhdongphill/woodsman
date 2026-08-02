/**
 * ads.txt — 광고 인벤토리 판매 권한 선언(IAB 표준).
 *
 * Google AdSense는 이 파일이 없으면 "판매자 정보 없음"으로 보고 수익을 제한한다.
 * 퍼블리셔 ID는 계정마다 다르므로 **환경변수로만** 받는다.
 * 값이 없으면 파일 자체를 내보내지 않는다 — 잘못된 ID가 적힌 ads.txt는
 * 없느니만 못하고, 자리표시자를 커밋해 두면 그대로 배포될 위험이 있다.
 *
 * 설정: Cloudflare 대시보드 → Worker → Settings → Variables and Secrets
 *       ADSENSE_CLIENT_ID = ca-pub-XXXXXXXXXXXXXXXX
 */
export const dynamic = "force-dynamic";

export function GET() {
  const clientId = process.env.ADSENSE_CLIENT_ID?.trim();

  if (!clientId || !/^ca-pub-\d{10,}$/.test(clientId)) {
    return new Response("Not Found", { status: 404 });
  }

  // ca-pub- 접두사를 뗀 숫자만 쓰는 것이 ads.txt 규격이다.
  const publisherId = clientId.replace(/^ca-pub-/, "");
  const body = `google.com, pub-${publisherId}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
