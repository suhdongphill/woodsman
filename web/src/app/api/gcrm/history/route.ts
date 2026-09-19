/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { gcrmHistory } from "@/features/gcrm/service";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  try {
    return NextResponse.json({ ok: true, rows: await gcrmHistory(q.get("from") ?? undefined, q.get("to") ?? undefined) });
  } catch (error) {
    console.error("[gcrm] history 실패", error);
    return NextResponse.json({ ok: false, reason: "읽지 못했다" }, { status: 500 });
  }
}
