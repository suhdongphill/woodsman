import { describe, expect, it } from "vitest";
import { BUBBLE_GUIDE, DIRECTION_THRESHOLD, LIQUIDITY_PARTS, TIDE_GUIDES, buildTide, levelWord, tideDirection } from "./tide";
import { SCORE_DEFINITIONS } from "./config";
import { SCORE_BANDS } from "../bubble/catalog";

describe("조류의 방향", () => {
  it("문턱 이상 움직여야 방향이다", () => {
    expect(tideDirection(60, 60 - DIRECTION_THRESHOLD)).toBe("up");
    expect(tideDirection(40, 40 + DIRECTION_THRESHOLD)).toBe("down");
    expect(tideDirection(52, 50)).toBe("flat");
  });

  it("⚠ 한쪽이 발행되지 않았으면 방향을 내지 않는다", () => {
    expect(tideDirection(55, null)).toBe("unknown");
    expect(tideDirection(undefined, 50)).toBe("unknown");
  });

  it("수준 말은 명세 식(50 + 16.667z)의 구간을 따른다", () => {
    expect(levelWord(50)).toBe("평소 수준");
    expect(levelWord(67)).toBe("평소보다 크게 높다");
    expect(levelWord(33)).toBe("평소보다 크게 낮다");
  });
});

describe("저장된 점수 → 조류", () => {
  const row = (asOf: string, value: number | null, basis = "LIVE") => ({ scoreKey: "engine_heat", asOf, basis, value, coverage: 90, state: value === null ? "DO_NOT_PUBLISH" : "OK" });

  it("⭐ 최신 · 4주 전 · 13주 전을 골라 방향을 낸다", () => {
    const rows = [row("2026-06-15", 40, "RECOMPUTED"), row("2026-08-17", 52, "RECOMPUTED"), row("2026-09-14", 58)];
    const t = buildTide(rows, "engine_heat", "2026-09-14");
    expect(t.latest?.value).toBe(58);
    expect(t.dir4).toBe("up");
    expect(t.dir13).toBe("up");
    expect(t.pastRecomputed).toBe(true);
    expect(t.stale).toBe(false);
  });

  it("그날 계산이 없으면 7일 안의 가장 가까운 이전 평가일을 쓴다 — 그보다 멀면 비교하지 않는다", () => {
    const rows = [row("2026-08-12", 50), row("2026-09-14", 50)];
    expect(buildTide(rows, "engine_heat", "2026-09-14").past4?.asOf).toBe("2026-08-12");
    expect(buildTide([row("2026-08-01", 50), row("2026-09-14", 50)], "engine_heat", "2026-09-14").dir4).toBe("unknown");
  });

  it("⚠ 새 점수가 사흘 넘게 없으면 묵었다고 표시한다", () => {
    expect(buildTide([row("2026-09-09", 50)], "engine_heat", "2026-09-14").stale).toBe(true);
  });

  it("⚠ 저장된 점수가 없으면 최신값도 방향도 없다", () => {
    const t = buildTide([], "global_liquidity", "2026-09-14");
    expect(t.latest).toBeUndefined();
    expect(t.dir4).toBe("unknown");
  });
});

describe("읽는 법 · 판단법", () => {
  const texts = [...Object.values(TIDE_GUIDES).flatMap((g) => [g!.how, g!.judge]), BUBBLE_GUIDE.how, BUBBLE_GUIDE.judge];

  it("⚠ 매수·매도 권유 문장을 쓰지 않는다 — 판단은 조건형(운영자 원칙 ④)", () => {
    for (const t of texts) expect(t).not.toMatch(/매수|매도|사세요|파세요|비중 확대|비중 축소|현금 확대|리스크오프/);
  });

  it("⚠ 버블 판단 문장의 구간은 카탈로그의 구간과 같다", () => {
    for (const band of SCORE_BANDS.slice(0, -1)) expect(BUBBLE_GUIDE.judge).toContain(String(band.max));
  });

  it("유동성 하위 계기는 GLS의 하위 점수와 같다", () => {
    const def = SCORE_DEFINITIONS.global_liquidity.components;
    expect(Object.keys(def).length).toBeGreaterThanOrEqual(LIQUIDITY_PARTS.length);
    for (const p of LIQUIDITY_PARTS) expect(SCORE_DEFINITIONS[p.key]).toBeDefined();
  });
});
