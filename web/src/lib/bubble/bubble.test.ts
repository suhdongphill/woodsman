import { describe, expect, it } from "vitest";
import { ALL_BUBBLE_INDICATORS, BUBBLE_LAYERS, BUBBLE_TRIGGERS, SCORE_BANDS } from "./catalog";
import { asOfNotice, bandFor, coverageNotice, scoreBubble, scoreByScale } from "./score";
import type { BubbleReading } from "./types";

function readings(entries: [string, 0 | 1 | 2][]): Map<string, BubbleReading> {
  return new Map(entries.map(([indicatorKey, points]) => [indicatorKey, { indicatorKey, points }]));
}

describe("버블 카탈로그", () => {
  it("5레이어 28지표 · 하드 트리거 8 (2026-10-26 정비: 5개 빼고 3개 더함 · 뜻이 바뀐 3개는 새 키)", () => {
    expect(BUBBLE_LAYERS).toHaveLength(5);
    expect(ALL_BUBBLE_INDICATORS).toHaveLength(28);
    expect(BUBBLE_TRIGGERS).toHaveLength(8);
  });

  /**
   * ⚠ 층별 개수까지 못 박는 이유: 총합만 보면 한 층에서 빠지고 다른 층에서 늘어난 것을 놓친다.
   * ⚠ 2026-10-26부터 볼트 대시보드(`_apps/메모리 버블 트리거.html`)와 구성이 다르다 — 사이트 카탈로그가 앞서고 볼트를 맞추는 일이 남았다.
   */
  it("층별 지표 수", () => {
    const byId = Object.fromEntries(BUBBLE_LAYERS.map((l) => [l.id, l.indicators.length]));
    expect(byId).toEqual({ L1: 6, L2: 6, L3: 5, L4: 8, L5: 3 });
  });

  it("2026-10-26 운영자 요청으로 더한 지표가 들어 있다", () => {
    const keys = ALL_BUBBLE_INDICATORS.map((i) => i.key);
    expect(keys).toContain("neocloud_credit"); // L4 · CoreWeave 무담보채
    expect(keys).toContain("oracle_credit"); // L4 · 등급 사다리 + FCF
    expect(keys).toContain("sox_runup"); // L2 · Greenwood·Shleifer·You (2019)
    expect(BUBBLE_TRIGGERS.map((t) => t.key)).toContain("trg8"); // 엔캐리 청산 재발화
  });

  /**
   * ⚠ 뺀 키·뜻이 바뀐 옛 키는 카탈로그에 다시 들어오면 안 된다 — DB에 옛 판정 행이 남아 있어서,
   *   키가 돌아오는 순간 **옛 정의로 매긴 점수**가 조용히 총점에 섞인다.
   */
  it("⚠ 뺀 키와 뜻이 바뀐 옛 키가 되살아나지 않는다", () => {
    const keys = ALL_BUBBLE_INDICATORS.map((i) => i.key);
    for (const retired of [
      "llm_token_spend",
      "capex_accel",
      "dram_momentum",
      "analyst_dispersion",
      "narrative_flag",
      "hbm_asp_trend",
      "asset_life_mismatch",
      "ipo_froth",
    ]) {
      expect(keys).not.toContain(retired);
    }
  });

  /** ⚠ 운영자(2026-10-26): 「유튜브 등의 출처는 제거하고 객관적이고 논리적인 부분으로 교체」 */
  it("⚠ 출처에 유튜브·뉴스레터·사람 판단만 있는 지표가 없다", () => {
    for (const i of ALL_BUBBLE_INDICATORS) {
      expect(i.source ?? "").not.toMatch(/유튜브|YouTube|경제학교|경읽남|별주부전|김선우|Groundbreaker|사용자 판단|웹 조사/);
    }
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


describe("채점 기준일", () => {
  const dated = (entries: [string, 0 | 1 | 2, string | undefined][]): Map<string, BubbleReading> =>
    new Map(
      entries.map(([indicatorKey, points, asOf]) => [
        indicatorKey,
        { indicatorKey, points, asOf },
      ]),
    );

  it("가장 오래된 것과 가장 최근을 함께 낸다", () => {
    const score = scoreBubble(
      dated([
        ["capex_yoy", 2, "2026-03-31"],
        ["roi_gap", 1, "2026-08-14"],
        ["retail_froth", 0, "2026-06-30"],
      ]),
    );
    expect(score.asOf).toMatchObject({ oldest: "2026-03-31", newest: "2026-08-14", undated: 0 });
  });

  it("⚠ 하루로 뭉치지 않는다 — 다섯 달 묵은 판정이 오늘 잰 것처럼 읽히면 안 된다", () => {
    const notice = asOfNotice({ oldest: "2026-03-31", newest: "2026-08-14", undated: 0 });
    expect(notice).toContain("2026-08-14");
    expect(notice).toContain("2026-03-31");
  });

  it("모두 같은 날이면 한 번만 적는다", () => {
    expect(asOfNotice({ oldest: "2026-08-14", newest: "2026-08-14", undated: 0 })).toBe(
      "2026-08-14 기준",
    );
  });

  it("기준일 없는 판정은 건수로 밝힌다 — 범위가 실제보다 좁아 보이면 안 된다", () => {
    const score = scoreBubble(
      dated([
        ["capex_yoy", 2, "2026-08-14"],
        ["roi_gap", 1, undefined],
      ]),
    );
    expect(score.asOf.undated).toBe(1);
    expect(asOfNotice(score.asOf)).toContain("1건");
  });

  it("채점이 하나도 없으면 아무 말도 지어내지 않는다", () => {
    expect(asOfNotice(scoreBubble(new Map()).asOf)).toBeNull();
  });
});
