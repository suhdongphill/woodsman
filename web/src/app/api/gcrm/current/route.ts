/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { gcrmCurrent } from "@/features/gcrm/service";

export async function GET(request: Request) {
  const asOf = new URL(request.url).searchParams.get("as_of") ?? undefined;
  try {
    const data = await gcrmCurrent(asOf);
    return NextResponse.json(data, { status: data.ok ? 200 : 404 });
  } catch (error) {
    // ⚠ 조용히 빈 값으로 응답하지 않는다 — 「없음」과 「못 읽음」이 같아 보이면 안 된다
    console.error("[gcrm] current 실패", error);
    return NextResponse.json({ ok: false, reason: "읽지 못했다" }, { status: 500 });
  }
}
