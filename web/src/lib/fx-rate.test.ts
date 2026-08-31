/**
 * 환율은 **기준일이 있는 값**을 쓴다 — 수기 설정값으로 조용히 떨어지지 않는다.
 */
import { describe, expect, it } from "vitest";
import { resolveUsdKrw } from "./fx-rate";

const NOW = new Date("2026-08-31T00:00:00Z");
const base = { setting: 1350, freq: "d" as const, now: NOW };

describe("resolveUsdKrw", () => {
  it("수집값이 있으면 그것을 쓰고 기준일을 함께 낸다", () => {
    const r = resolveUsdKrw({ ...base, collected: { value: 1368.46, asOf: "2026-08-31" } });
    expect(r.rate).toBe(1368.46);
    expect(r.origin).toBe("COLLECTED");
    expect(r.stale).toBe(false);
    // ⚠ 날짜 없는 숫자를 만들지 않는다.
    expect(r.caption).toContain("2026-08-31 기준");
    expect(r.caption).toContain("1,368.5원");
  });

  it("⚠ 수집값이 낡아도 **수집값을 쓴다** — 날짜 없는 설정값으로 바꿔치기하지 않는다", () => {
    // 일별 발표 기본 기한은 7일. 8/21이면 8/31에 3일 밀렸다.
    const r = resolveUsdKrw({ ...base, collected: { value: 1385.01, asOf: "2026-08-21" } });
    expect(r.origin).toBe("COLLECTED");
    expect(r.rate).toBe(1385.01);
    expect(r.stale).toBe(true);
    // "최신이 아닐 수 있습니다"가 아니라 며칠인지 숫자로 말한다.
    expect(r.overdueDays).toBeGreaterThan(0);
    expect(r.caption).toContain(`${r.overdueDays}일 밀렸습니다`);
  });

  it("⚠ 수집값이 없으면 설정값을 쓰되 **그렇다고 밝힌다** — 조용히 떨어지지 않는다", () => {
    const r = resolveUsdKrw({ ...base, collected: null });
    expect(r.rate).toBe(1350);
    expect(r.origin).toBe("SETTING");
    // ⚠ 없는 날짜를 지어내지 않는다.
    expect(r.asOf).toBeNull();
    expect(r.caption).toContain("설정값");
  });

  it("카탈로그의 기한 예외를 그대로 따른다 — 여기서 기준을 새로 정하지 않는다", () => {
    const collected = { value: 1385.01, asOf: "2026-08-21" };
    expect(resolveUsdKrw({ ...base, collected }).stale).toBe(true);
    expect(resolveUsdKrw({ ...base, collected, staleDays: 30 }).stale).toBe(false);
  });
});
