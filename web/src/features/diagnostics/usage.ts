/**
 * 무료 등급 사용량 조회.
 *
 * ⚠ 판단은 하지 않는다 — 계기 값만 읽어 온다. 비율·경고 수준은 `lib/quota.ts`가 정한다.
 *
 * ## ⚠ 한도에 닿은 뒤에 알면 늦다
 * 무료 등급에서 D1이 차면 **쓰기만 조용히 실패**한다. 읽기는 되므로 화면은 멀쩡해 보이고
 * 저장만 안 된다 — 코드 버그와 구분이 안 된다. 그래서 **차기 전에 보이게** 계기를 둔다.
 */
import { probeD1SizeBytes, queryAll } from "@/lib/d1";
import { classifyQuotaError, type QuotaVerdict } from "@/lib/quota";

export type TableUsage = { name: string; rows: number };

export type UsageProbe = {
  /** D1 실제 크기(바이트). 재지 못했으면 undefined */
  sizeBytes?: number;
  /** 행이 많은 표부터 — 무엇이 자리를 먹는지 */
  tables: TableUsage[];
  /** 조회 자체가 실패했을 때의 분류 결과 */
  failure?: QuotaVerdict;
};

/**
 * 행 수를 셀 표. ⚠ 표 이름을 SQL에 문자열로 넣어야 하므로(바인딩이 안 되는 자리다)
 * **여기 적힌 이름만** 쓴다. 사용자 입력이 절대 닿지 않는다.
 */
const COUNTED_TABLES = [
  "PageView",
  "PageEngagement",
  "OutboundSource",
  "OutboundClick",
  "MacroPoint",
  "Post",
  "Comment",
  "StockReportBlock",
  "StockReport",
] as const;

/**
 * 사용량을 잰다.
 *
 * ⚠ 쿼리 수를 아낀다 — 표마다 왕복하면 무료 등급의 "호출당 50개"를 **진단 화면이 먼저**
 *    잡아먹는다. `UNION ALL` 하나로 전부 센다.
 */
export async function probeUsage(): Promise<UsageProbe> {
  try {
    const sizeBytes = await probeD1SizeBytes();

    const sql = COUNTED_TABLES.map(
      (t) => `SELECT '${t}' AS name, COUNT(*) AS rows FROM "${t}"`,
    ).join(" UNION ALL ");

    const rows = await queryAll<{ name: string; rows: number }>(`${sql} ORDER BY rows DESC`);

    return {
      sizeBytes,
      tables: rows.map((r) => ({ name: r.name, rows: Number(r.rows) || 0 })),
    };
  } catch (error) {
    // ⚠ 진단 화면이 죽으면 안 된다 — 정작 무엇이 잘못됐는지 볼 곳이 없어진다.
    console.error("[diagnostics] 사용량 조회 실패", error);
    return { tables: [], failure: classifyQuotaError(error) };
  }
}
