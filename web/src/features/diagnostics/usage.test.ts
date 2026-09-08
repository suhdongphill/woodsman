import { describe, expect, it } from "vitest";
import { D1_MAX_COMPOUND_SELECT } from "@/lib/quota";
import { buildRowCountSql } from "./usage";

/**
 * 2026-09-08 사고를 붙드는 테스트.
 *
 * ⚠ 사용량 카드가 표 9개를 `UNION ALL`로 세고 있었고, D1은 복합 SELECT를 5항까지만 받는다.
 *    표가 6개가 된 날부터 이 화면은 **한 번도 성공한 적이 없었다.**
 *    그런데 실패가 「한도 문제일 수 있습니다」로 보여서 고장이 정상적인 경고처럼 읽혔다.
 */
describe("행 수 세는 SQL", () => {
  it("⚠ 표가 아무리 늘어도 복합 SELECT를 쓰지 않는다", () => {
    const many = Array.from({ length: D1_MAX_COMPOUND_SELECT * 10 }, (_, i) => `T${i}`);
    const sql = buildRowCountSql(many);

    // ⚠ 여기가 핵심이다. UNION이 다시 들어오면 이 테스트가 먼저 깨져야 한다.
    expect(sql).not.toMatch(/\bunion\b/i);
  });

  it("쿼리는 하나다 — 표마다 왕복하지 않는다", () => {
    const sql = buildRowCountSql(["A", "B", "C"]);
    expect(sql.match(/\bSELECT\b/gi)).toHaveLength(4); // 바깥 1 + 서브쿼리 3
    expect(sql).not.toContain(";");
  });

  it("표 순서대로 c0·c1·… 열이 붙는다 — 결과를 순서로 짝짓기 때문이다", () => {
    expect(buildRowCountSql(["Post", "Comment"])).toBe(
      'SELECT (SELECT COUNT(*) FROM "Post") AS c0, (SELECT COUNT(*) FROM "Comment") AS c1',
    );
  });

  it("표 이름은 큰따옴표로 감싼다 — 예약어와 겹치는 이름이 있다", () => {
    expect(buildRowCountSql(["Order"])).toContain('FROM "Order"');
  });
});
