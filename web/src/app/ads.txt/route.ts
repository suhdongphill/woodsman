/**
 * ads.txt — 광고 인벤토리 판매 권한 선언(IAB 표준).
 *
 * Google AdSense는 이 파일이 없으면 "판매자 정보 없음"으로 보고 수익을 제한한다.
 * 퍼블리셔 ID는 계정마다 다르므로 **환경변수로만** 받는다.
 * 값이 없으면 파일 자체를 내보내지 않는다 — 잘못된 ID가 적힌 ads.txt는
 * 없느니만 못하고, 자리표시자를 커밋해 두면 그대로 배포될 위험이 있다.
 *
 * ⚠ 2026-08-30: 값이 **환경변수에서 관리자 화면(/admin/ads)** 으로 옮겨졌다.
 *    재배포 없이 고칠 수 있어야 하기 때문이다.
 * ⚠ 광고 노출 스위치가 꺼져 있어도 **ads.txt는 낸다** — 심사 중에도 이 파일은 있어야 한다.
 */
import { adsTxtBody } from "@/lib/ads";
import { getAdsSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = adsTxtBody(await getAdsSettings());

  // ⚠ ID가 없거나 형식이 아니면 파일 자체를 안 내보낸다.
  //    잘못된 ID가 적힌 ads.txt는 없느니만 못하다.
  if (!body) return new Response("Not Found", { status: 404 });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
