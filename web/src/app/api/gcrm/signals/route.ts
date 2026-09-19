/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠ 아직 신호를 쌓지 않는다.
 *
 * 승격 판정(`lib/gcrm/signals.ts`)은 P5에서 만들었지만, 그 **입력**(채널별 일자별 움직임)을
 * 아직 저장하지 않는다. 빈 배열을 돌려주면 「신호가 없다」로 읽히므로, **없다는 사실을 말한다**
 * (CLAUDE.md §3 — 「값이 없음」과 「읽지 못함」이 같은 화면이 되지 않게 한다).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      reason: "아직 신호를 쌓지 않는다 — 승격 판정의 입력(일자별 채널 움직임) 저장은 P9에서 붙인다",
      rows: null,
    },
    { status: 501 },
  );
}
