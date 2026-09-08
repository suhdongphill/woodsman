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
 * 행 수를 세는 SQL을 만든다. ⚠ 순수 함수로 뺀 이유는 **테스트가 모양을 붙들기 위해서**다
 *    (아래 `UNION ALL`로 돌아가면 안 되는 이유를 참고).
 *
 * ⚠ **`UNION ALL`로 세지 않는다** (2026-09-08에 바뀐 규칙).
 *    D1은 복합 SELECT의 항을 **5개까지만** 받는다(`D1_MAX_COMPOUND_SELECT`, 실측).
 *    표가 6개가 된 날부터 이 화면은 **한 번도 성공한 적이 없었다.** 그런데 조회가 실패해도
 *    화면은 「한도 문제일 수 있습니다」를 띄우고 있어서, 고장이 **정상적인 경고처럼** 보였다.
 *
 *    5개씩 끊어 두 번 부르는 길도 있었지만 택하지 않았다 — 표가 11개가 되는 날 또 걸리고,
 *    그때도 **조용히** 걸린다. 스칼라 서브쿼리는 **항 수 제한 자체가 없다.**
 *
 * ⚠ 쿼리는 여전히 **하나**다. 표마다 왕복하면 무료 등급의 「호출당 50개」를
 *    진단 화면이 먼저 잡아먹는다.
 */
export function buildRowCountSql(tables: readonly string[]): string {
  const columns = tables.map((t, i) => `(SELECT COUNT(*) FROM "${t}") AS c${i}`).join(", ");
  return `SELECT ${columns}`;
}

/** 사용량을 잰다. */
export async function probeUsage(): Promise<UsageProbe> {
  try {
    const sizeBytes = await probeD1SizeBytes();

    const [row] = await queryAll<Record<string, number>>(buildRowCountSql(COUNTED_TABLES));

    // ⚠ 한 행에 열로 온다. 열 이름이 아니라 **순서**로 표와 짝짓는다.
    const tables = COUNTED_TABLES.map((name, i) => ({
      name,
      rows: Number(row?.[`c${i}`]) || 0,
    })).sort((a, b) => b.rows - a.rows);

    return { sizeBytes, tables };
  } catch (error) {
    // ⚠ 진단 화면이 죽으면 안 된다 — 정작 무엇이 잘못됐는지 볼 곳이 없어진다.
    console.error("[diagnostics] 사용량 조회 실패", error);
    return { tables: [], failure: classifyQuotaError(error) };
  }
}
