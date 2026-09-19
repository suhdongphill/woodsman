/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { gcrmIndicator } from "@/features/gcrm/service";

export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const asOf = new URL(request.url).searchParams.get("as_of") ?? undefined;
  try {
    const data = await gcrmIndicator(code, asOf);
    return NextResponse.json(data, { status: data.ok ? 200 : 404 });
  } catch (error) {
    console.error("[gcrm] indicator 실패", error);
    return NextResponse.json({ ok: false, reason: "읽지 못했다" }, { status: 500 });
  }
}
