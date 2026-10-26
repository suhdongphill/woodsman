import { describe, expect, it } from "vitest";
import { NOT_SYNCED, SYNC_KEYS, planBubbleSync, plainValue, type VaultIndicator } from "./sync";
import { findBubbleIndicator } from "./catalog";

const TODAY = "2026-10-26";

function vault(over: Partial<VaultIndicator> & { key: string }): VaultIndicator {
  return { points: 1, value: "<b>340bp</b> (3.40%)", date: "2026-10-22", fetched_at: "2026-10-26T06:00:00", op: "gt", t1: 3, t2: 4, src: "FRED", ...over };
}
const only = (key: string, d: ReturnType<typeof planBubbleSync>) => d.find((x) => x.key === key)!;

describe("planBubbleSync — 볼트 자동값 → 사이트 판정", () => {
  it("동기화 키는 모두 사이트 카탈로그에 있고 눈금(scale)이 있다 — 없으면 대조할 수 없다", () => {
    for (const key of Object.keys(SYNC_KEYS)) {
      expect(findBubbleIndicator(key), key).toBeDefined();
      expect(findBubbleIndicator(key)!.indicator.scale, key).toBeDefined();
    }
  });

  it("⚠ 정의가 다른 move는 넘기지 않는다(볼트는 Yahoo ^MOVE)", () => {
    expect(Object.keys(SYNC_KEYS)).not.toContain("move");
    expect(NOT_SYNCED.move).toBeDefined();
    const d = planBubbleSync([vault({ key: "move", op: "gt", t1: 100, t2: 140 })], [], TODAY);
    expect(only("move", d)).toMatchObject({ action: "skip" });
  });

  it("더 새 값이면 쓴다 — HTML 태그를 벗기고 기준일은 볼트 date", () => {
    const d = planBubbleSync([vault({ key: "hy_oas" })], [{ indicatorKey: "hy_oas", points: 0, value: "270bp", asOf: "2026-09-10" }], TODAY);
    expect(only("hy_oas", d)).toMatchObject({ action: "write", points: 1, value: "340bp (3.40%)", asOf: "2026-10-22" });
  });

  it("⚠ 사이트가 더 새것이면 되돌리지 않는다(10/26 TSMC 사례)", () => {
    const d = planBubbleSync(
      [vault({ key: "tsmc_rev_yoy", points: 0, date: "2026-08-31", op: "lt", t1: 30, t2: 10 })],
      [{ indicatorKey: "tsmc_rev_yoy", points: 0, value: "9월 +54.6%", asOf: "2026-09-30" }],
      TODAY,
    );
    expect(only("tsmc_rev_yoy", d)).toMatchObject({ action: "skip" });
    expect(only("tsmc_rev_yoy", d).reason).toContain("더 새것");
  });

  it("⚠ 수집이 끊겼거나 오류면 넘기지 않는다 — 끊김을 새 값처럼 넣지 않는다", () => {
    expect(only("hy_oas", planBubbleSync([vault({ key: "hy_oas", fetched_at: "2026-10-01" })], [], TODAY)).action).toBe("skip");
    expect(only("hy_oas", planBubbleSync([vault({ key: "hy_oas", fetch_err: "2026-10-26 403" })], [], TODAY)).action).toBe("skip");
    expect(only("hy_oas", planBubbleSync([vault({ key: "hy_oas", fetched_at: undefined })], [], TODAY)).action).toBe("skip");
  });

  it("⚠ 임계값이 사이트 카탈로그와 다르면 넘기지 않는다 — 점수는 볼트가 매긴다", () => {
    const d = planBubbleSync([vault({ key: "hy_oas", t1: 3.5 })], [], TODAY);
    expect(only("hy_oas", d)).toMatchObject({ action: "skip" });
    expect(only("hy_oas", d).reason).toContain("임계값 불일치");
  });

  it("점수가 0·1·2가 아니면(결측) 넘기지 않는다", () => {
    expect(only("hy_oas", planBubbleSync([vault({ key: "hy_oas", points: null })], [], TODAY)).action).toBe("skip");
  });

  it("시세로 매기는 비율은 수집일이 기준일이고, 매출 분기를 값에 적는다", () => {
    const d = planBubbleSync(
      [vault({ key: "semi_ps", points: 2, value: "14.4배", date: "2026-06-27", op: "gt", t1: 8, t2: 14 })],
      [],
      TODAY,
    );
    expect(only("semi_ps", d)).toMatchObject({ action: "write", asOf: "2026-10-26" });
    expect((only("semi_ps", d) as { value: string }).value).toContain("매출 TTM은 2026-06-27 분기까지");
  });

  it("같으면 쓰지 않는다(멱등)", () => {
    const d = planBubbleSync([vault({ key: "hy_oas" })], [{ indicatorKey: "hy_oas", points: 1, value: "340bp (3.40%)", asOf: "2026-10-22" }], TODAY);
    expect(only("hy_oas", d)).toMatchObject({ action: "skip", reason: "같음" });
  });

  it("볼트에 없는 키는 이유와 함께 건너뛴다", () => {
    expect(only("vix", planBubbleSync([], [], TODAY))).toMatchObject({ action: "skip", reason: "볼트에 없음" });
  });

  it("plainValue — 태그·공백 정리와 길이 제한", () => {
    expect(plainValue("<b>a</b>\n  b")).toBe("a b");
    expect(plainValue("x".repeat(600)).length).toBe(500);
  });
});
