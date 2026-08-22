import { describe, expect, it } from "vitest";
import {
  COLLECTION_STALL_DAYS,
  STALE_RULE,
  defaultStaleDays,
  freshnessBadge,
  freshnessTone,
  healthNotice,
  judgeFreshness,
  staleAfter,
  summarizeHealth,
  type MacroFreshness,
  type ReleaseFreq,
} from "./freshness";

const NOW = new Date("2026-08-22T09:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const isoAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const judge = (over: Partial<Parameters<typeof judgeFreshness>[0]>) =>
  judgeFreshness({ freq: "m", manual: false, now: NOW, fetchedAt: isoAgo(1), ...over });

describe("기한표 (§1-7)", () => {
  it("⚠ 볼트 stale_rule과 같은 값이다 — 한쪽만 고치면 두 화면이 어긋난다", () => {
    expect(STALE_RULE).toEqual({ d: 7, w: 19, m: 75, q: 228 });
  });

  it("공식대로 나온다 — 주기를 두 번 더하고 여유를 붙인다", () => {
    for (const freq of ["d", "w", "m", "q"] as ReleaseFreq[]) {
      expect(defaultStaleDays(freq)).toBe(STALE_RULE[freq]);
    }
  });

  it("월간의 기한이 30일이 아니다 — as_of가 기간 시작일이라 그러면 조기 만료된다", () => {
    expect(STALE_RULE.m).toBeGreaterThan(60);
  });

  it("일간의 기한이 1일이 아니다 — 주간 릴리스(H.10)가 항상 며칠 뒤진다", () => {
    expect(STALE_RULE.d).toBeGreaterThan(5);
  });

  it("예외를 주면 그게 이긴다", () => {
    expect(staleAfter("2026-08-01", "d")).toBe("2026-08-08");
    expect(staleAfter("2026-08-01", "d", 14)).toBe("2026-08-15");
  });
});

describe("값이 낡았나 (stale)", () => {
  it("기한 안이면 조용하다", () => {
    const f = judge({ asOf: daysAgo(30) });
    expect(f.stale).toBe(false);
    expect(freshnessBadge(f)).toBeNull();
  });

  it("기한을 넘기면 며칠 넘겼는지 말한다", () => {
    const f = judge({ asOf: daysAgo(STALE_RULE.m + 10) });
    expect(f.stale).toBe(true);
    expect(f.overdueDays).toBe(10);
    expect(freshnessBadge(f)).toBe("기한초과 10일");
  });

  it("수동 지표는 대응이 다르므로 뱃지도 다르다", () => {
    const f = judge({ asOf: daysAgo(STALE_RULE.m + 3), manual: true, fetchedAt: undefined });
    expect(freshnessBadge(f)).toBe("수동·기한초과 3일");
  });

  it("⚠ 값이 없는 것은 낡음 판정이 성립하지 않는다", () => {
    const f = judge({ asOf: undefined });
    expect(f.missing).toBe(true);
    expect(f.stale).toBe(false);
    expect(freshnessBadge(f)).toBeNull();
  });
});

describe("수집이 끊겼나 (stalled) — §1-6", () => {
  it("⚠ 값은 최신인데 수집이 끊긴 상태를 잡아낸다", () => {
    const f = judge({ asOf: daysAgo(2), fetchedAt: isoAgo(COLLECTION_STALL_DAYS + 7) });
    expect(f.stale).toBe(false); // 값 자체는 기한 안이다
    expect(f.stalled).toBe(true);
    expect(freshnessBadge(f)).toBe("수집 끊김 21일");
  });

  it("⚠ 수집이 끊긴 것이 값이 낡은 것보다 먼저 나온다 — 고칠 대상이 다르다", () => {
    const f = judge({ asOf: daysAgo(STALE_RULE.m + 5), fetchedAt: isoAgo(30) });
    expect(f.stale).toBe(true);
    expect(freshnessBadge(f)).toMatch(/수집 끊김/);
    expect(freshnessTone(f)).toBe("stalled");
  });

  it("⚠ 수동 지표에 수집 기록이 없는 것은 정상이다 — 경고로 띄우지 않는다", () => {
    const f = judge({ asOf: daysAgo(3), manual: true, fetchedAt: undefined });
    expect(f.stalled).toBe(false);
    expect(f.neverFetched).toBe(false);
    expect(freshnessBadge(f)).toBeNull();
  });

  it("자동인데 수집 기록이 없으면 최신이라고 말할 근거가 없다", () => {
    const f = judge({ asOf: daysAgo(3), fetchedAt: undefined });
    expect(f.neverFetched).toBe(true);
    expect(freshnessBadge(f)).toBe("수집기록 없음");
  });
});

describe("건강도 요약", () => {
  const make = (over: Partial<MacroFreshness>): MacroFreshness => ({
    missing: false,
    stale: false,
    overdueDays: 0,
    stalled: false,
    stalledDays: 0,
    neverFetched: false,
    manual: false,
    ...over,
  });

  it("⚠ 전부 정상이면 아무 말도 하지 않는다 — 늘 떠드는 경고는 무시된다", () => {
    expect(healthNotice(summarizeHealth([make({}), make({})]))).toBeNull();
  });

  it("자동 낡음과 수동 낡음을 갈라 센다 — 대응이 다르다", () => {
    const h = summarizeHealth([
      make({ stale: true }),
      make({ stale: true, manual: true }),
      make({ stalled: true }),
      make({ missing: true }),
      make({}),
    ]);
    expect(h).toMatchObject({ total: 5, ok: 1, stale: 1, manualStale: 1, stalled: 1, missing: 1 });
    const notice = healthNotice(h)!;
    expect(notice).toContain("수집 끊김 1건");
    expect(notice).toContain("수동 갱신 필요 1건");
  });

  it("한 지표는 한 칸에만 센다 — 합이 total을 넘지 않는다", () => {
    const h = summarizeHealth([make({ stalled: true, stale: true, manual: false })]);
    expect(h.ok + h.stalled + h.stale + h.manualStale + h.missing).toBe(h.total);
  });
});
