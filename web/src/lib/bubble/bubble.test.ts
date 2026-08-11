import { describe, expect, it } from "vitest";
import { ALL_BUBBLE_INDICATORS, BUBBLE_LAYERS, BUBBLE_TRIGGERS, SCORE_BANDS } from "./catalog";
import { bandFor, coverageNotice, scoreBubble, scoreByScale } from "./score";
import type { BubbleReading } from "./types";

function readings(entries: [string, 0 | 1 | 2][]): Map<string, BubbleReading> {
  return new Map(entries.map(([indicatorKey, points]) => [indicatorKey, { indicatorKey, points }]));
}

describe("버블 카탈로그", () => {
  it("설계서의 5레이어 30지표를 그대로 옮겼다", () => {
    expect(BUBBLE_LAYERS).toHaveLength(5);
    expect(ALL_BUBBLE_INDICATORS).toHaveLength(30);
    expect(BUBBLE_TRIGGERS).toHaveLength(8);
  });

  /**
   * ⚠ 층별 개수까지 못 박는 이유: 총합만 보면 한 층에서 빠지고 다른 층에서 늘어난 것을
   * 놓친다. 볼트 대시보드(`00_Dashboard/메모리 버블 트리거.html`)의 층 구성과 대조하는 자리다.
   */
  it("층별 지표 수가 볼트와 같다", () => {
    const byId = Object.fromEntries(BUBBLE_LAYERS.map((l) => [l.id, l.indicators.length]));
    expect(byId).toEqual({ L1: 8, L2: 5, L3: 6, L4: 6, L5: 5 });
  });

  it("2026-08 볼트 ingest로 늘어난 지표가 들어 있다", () => {
    const keys = ALL_BUBBLE_INDICATORS.map((i) => i.key);
    expect(keys).toContain("llm_token_spend"); // L1 · AI 수익화의 실물 증거
    expect(keys).toContain("asset_life_mismatch"); // L4 · 부채의 만기 구조
    expect(BUBBLE_TRIGGERS.map((t) => t.key)).toContain("trg8"); // 엔캐리 청산 재발화
  });

  it("지표 키가 중복되지 않는다", () => {
    const keys = ALL_BUBBLE_INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("모든 지표에 사람이 읽는 채점 규칙이 있다", () => {
    for (const i of ALL_BUBBLE_INDICATORS) expect(i.rule.length).toBeGreaterThan(2);
  });

  it("가중치는 진원지(L1·L2)가 가장 크다", () => {
    const byId = Object.fromEntries(BUBBLE_LAYERS.map((l) => [l.id, l.weight]));
    expect(byId.L1).toBe(1.5);
    expect(byId.L2).toBe(1.5);
    expect(byId.L5).toBeLessThan(byId.L1);
  });

  it("⚠ 국면 문구가 매매 지시로 넘어가지 않는다", () => {
    for (const b of SCORE_BANDS) {
      expect(b.stance).not.toMatch(/매수하세요|매도하세요|사세요|파세요/);
    }
  });
});

describe("눈금 채점", () => {
  it("높을수록 위험한 지표", () => {
    const scale = { op: "gt" as const, t1: 20, t2: 40 };
    expect(scoreByScale(scale, 10)).toBe(0);
    expect(scoreByScale(scale, 30)).toBe(1);
    expect(scoreByScale(scale, 82)).toBe(2);
  });

  it("낮을수록 위험한 지표", () => {
    const scale = { op: "lt" as const, t1: 10, t2: 0 };
    expect(scoreByScale(scale, 15)).toBe(0);
    expect(scoreByScale(scale, 5)).toBe(1);
    expect(scoreByScale(scale, -3)).toBe(2);
  });

  it("값이 없거나 눈금이 없으면 채점하지 않는다(정성 지표)", () => {
    expect(scoreByScale(undefined, 5)).toBeUndefined();
    expect(scoreByScale({ op: "gt", t1: 1, t2: 2 }, undefined)).toBeUndefined();
  });
});

describe("총점", () => {
  it("모두 0점이면 0, 모두 2점이면 100", () => {
    const allZero = readings(ALL_BUBBLE_INDICATORS.map((i) => [i.key, 0]));
    expect(scoreBubble(allZero).score).toBe(0);

    const allTwo = readings(ALL_BUBBLE_INDICATORS.map((i) => [i.key, 2]));
    const max = scoreBubble(allTwo);
    expect(max.score).toBe(100);
    expect(max.band?.regime).toBe("붕괴 초기");
  });

  it("⚠ 결측은 분모에서 뺀다 — 0점으로 치면 '안 본 것'이 '괜찮은 것'이 된다", () => {
    // L1의 한 지표만 2점, 나머지는 전부 결측.
    const one = readings([["capex_yoy", 2]]);
    const result = scoreBubble(one);
    // 채점된 레이어(L1)의 평균이 2 → 그 레이어만으로 정규화하면 100
    expect(result.score).toBe(100);
    expect(result.coverage.scored).toBe(1);
    expect(result.coverage.total).toBe(ALL_BUBBLE_INDICATORS.length);
  });

  it("⚠ 하나도 채점되지 않았으면 점수를 내지 않는다(0은 '안전'으로 읽힌다)", () => {
    const empty = scoreBubble(new Map());
    expect(empty.score).toBeUndefined();
    expect(empty.band).toBeUndefined();
    expect(coverageNotice(empty.coverage)).toMatch(/아직 채점한 지표가 없습니다/);
  });

  it("가중치가 큰 레이어가 점수를 더 움직인다", () => {
    const heavy = scoreBubble(readings([["capex_yoy", 2], ["retail_froth", 0]])); // L1(1.5) vs L5(0.8)
    const light = scoreBubble(readings([["capex_yoy", 0], ["retail_froth", 2]]));
    expect(heavy.score!).toBeGreaterThan(light.score!);
  });

  it("구간은 위에서부터 처음 걸리는 것", () => {
    expect(bandFor(0).regime).toBe("확장 (Risk-On)");
    expect(bandFor(20).regime).toBe("확장 (Risk-On)");
    expect(bandFor(21).regime).toBe("주의");
    expect(bandFor(55).regime).toBe("경계");
    expect(bandFor(75).regime).toBe("위험");
  });

  it("우선 경보 3종이 모두 2점이면 따로 알린다 — 평균에 묻히지 않게", () => {
    const fired = scoreBubble(
      readings([
        ["capex_to_ocf", 2],
        ["roi_gap", 2],
        ["equip_billings_yoy", 2],
      ]),
    );
    expect(fired.priorityFired).toBe(true);

    const notFired = scoreBubble(readings([["capex_to_ocf", 2], ["roi_gap", 1]]));
    expect(notFired.priorityFired).toBe(false);
  });

  it("커버리지가 낮으면 화면이 그렇게 말한다", () => {
    expect(coverageNotice({ scored: 5, total: 28, pct: 18 })).toMatch(/치우칠 수 있습니다/);
    expect(coverageNotice({ scored: 28, total: 28, pct: 100 })).toMatch(/결측은 분모에서 빼고/);
  });
});
