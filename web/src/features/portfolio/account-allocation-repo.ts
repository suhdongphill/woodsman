/** 계좌 전체 비율(`AccountAllocation`) 읽기. 규칙은 `lib/account-allocation.ts`. 싣는 곳은 볼트 export-portal-portfolio.py. */
import { queryOne } from "@/lib/d1";
import { validAccountAllocation, type AccountAllocation } from "@/lib/account-allocation";

/** 최신 한 줄. 없거나 못 읽거나 합이 어긋나면 `null` — ⚠ 이유를 로그에 남기고, 화면은 기준이 다르다고 밝힌다. */
export async function loadAccountAllocation(): Promise<AccountAllocation | null> {
  try {
    const row = await queryOne<AccountAllocation>(
      `SELECT asOf, growthPct, incomePct, defensePct, cashPct FROM AccountAllocation ORDER BY asOf DESC LIMIT 1`,
    );
    if (!row) return null;
    const valid = validAccountAllocation(row);
    if (!valid) console.error("[account-allocation] 비율 합이 어긋나 쓰지 않는다", row.asOf);
    return valid;
  } catch (error) {
    console.error("[account-allocation] 읽지 못했다", error);
    return null;
  }
}
