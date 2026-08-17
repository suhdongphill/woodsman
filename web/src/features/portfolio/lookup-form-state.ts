/**
 * 티커 조회 결과 타입.
 *
 * ⚠ `"use server"` 파일에서 타입·상수를 export하면 액션 호출이 500으로 죽는다.
 *    그래서 여기 둔다.
 */
import type { TickerProfile } from "@/lib/quote/lookup";

export type LookupResult =
  | {
      ok: true;
      /** 실제로 찾은 Yahoo 심볼 — 코스닥이면 .KQ로 바뀌어 온다 */
      symbol: string;
      profile: TickerProfile;
      /** ⚠ 국내 종목처럼 덜 믿을 값일 때의 한 문장 */
      caveat?: string;
    }
  | { ok: false; error: string };
