/**
 * 조회 집계 비콘.
 *
 * 브라우저가 화면을 그린 뒤 이 경로로 한 번 알린다. **서버 렌더링을 막지 않는다** —
 * 페이지를 그리면서 DB에 쓰면 모든 요청이 그만큼 느려지고, RSC 프리페치까지 세어
 * 숫자가 부풀려진다.
 *
 * ⚠ 저장하는 것은 **(경로, 날짜, 합계)뿐**이다. UA는 봇 판정에만 쓰고 버린다.
 *    IP·리퍼러·쿠키는 읽지도 저장하지도 않는다.
 * ⚠ 실패해도 **화면에 영향을 주지 않는다.** 집계는 부수적인 일이고, 여기서 에러를 던지면
 *    콘솔이 빨개진다. 다만 서버 로그에는 남긴다(조용한 실패 금지).
 */
import { NextResponse } from "next/server";
import { isBotUserAgent, normalizePath, postSlugFromPath, viewDateKey } from "@/lib/analytics";
import { recordPageView } from "@/features/analytics/repository";

export const runtime = "nodejs";
/** ⚠ 정적 생성 금지 — 매 요청마다 실행돼야 한다. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 봇은 세지 않는다. UA는 여기서 판정에만 쓰고 저장하지 않는다.
    if (isBotUserAgent(request.headers.get("user-agent"))) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const body = (await request.json().catch(() => null)) as { path?: string } | null;
    const path = normalizePath(body?.path ?? "");
    if (!path) return NextResponse.json({ ok: true, counted: false });

    // 글이면 글 자체의 조회수도 함께 올라간다(규칙은 repository가 안다).
    await recordPageView(path, viewDateKey(new Date()), postSlugFromPath(path));

    return NextResponse.json({ ok: true, counted: true });
  } catch (error) {
    console.error("[analytics] 조회 기록 실패", error);
    // 화면은 그대로 두고 200으로 답한다 — 집계 실패가 방문자 경험을 망치지 않게.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
