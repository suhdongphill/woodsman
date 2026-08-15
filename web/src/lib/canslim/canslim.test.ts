import { describe, expect, it } from "vitest";
import {
  CANSLIM_BANDS,
  CANSLIM_ITEMS,
  DATA_TAGS,
  M_GATE_MAX,
  TOTAL_WEIGHT,
  findCanslimItem,
  isCanslimKey,
} from "./catalog";
import {
  bandFor,
  canslimCoverageNotice,
  isScorablePoints,
  marketGate,
  missingAxes,
  scoreCanslim,
} from "./score";
import type { CanslimKey, CanslimReading, DataTagKey } from "./types";

function reading(points?: number, tag: DataTagKey = "confirmed"): CanslimReading {
  return { key: "C", points, tag, evidence: "YoY +116%", source: "DART", asOf: "2026-08-11" };
}

/** 키 → 점수 맵을 간단히 만든다. */
function readings(entries: Partial<Record<CanslimKey, CanslimReading>>): Map<string, CanslimReading> {
  return new Map(Object.entries(entries) as [string, CanslimReading][]);
}

const ALL_KEYS: CanslimKey[] = ["C", "A", "N", "S", "L", "I", "M"];

/** 7축 전부 같은 점수로 채운다. */
function flat(points: number): Map<string, CanslimReading> {
  return new Map(ALL_KEYS.map((k) => [k, { ...reading(points), key: k }]));
}

describe("카탈로그", () => {
  it("⚠ 가중치 합이 100이다 — 어긋나면 종합 점수가 100점 만점이 아니게 된다", () => {
    expect(TOTAL_WEIGHT).toBe(100);
  });

  it("7항목이 모두 있고 키가 겹치지 않는다", () => {
    expect(CANSLIM_ITEMS).toHaveLength(7);
    expect(new Set(CANSLIM_ITEMS.map((i) => i.key)).size).toBe(7);
  });

  it("⚠ 등급 경계는 8.0 / 6.5다 — 화면이 정책보다 후하게 판정하면 안 된다", () => {
    // 2026-08-11 설계서 §1: 화면이 7.0/5.0을 쓰고 있었다. 그 재발을 여기서 막는다.
    expect(CANSLIM_BANDS.map((b) => b.min)).toEqual([8.0, 6.5, 0]);
  });

  it("밴드는 내림차순이어야 위에서부터 찾는 방식이 맞다", () => {
    const mins = CANSLIM_BANDS.map((b) => b.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });

  it("항목마다 질문·루브릭·주의가 채워져 있다 — 화면이 그대로 쓴다", () => {
    for (const i of CANSLIM_ITEMS) {
      expect(i.question, i.key).not.toBe("");
      expect(i.rubric, i.key).not.toBe("");
      expect(i.caveat, i.key).not.toBe("");
    }
  });

  it("데이터 태그 3종이 있고 N/A 설명에 '0점이 아니다'가 적혀 있다", () => {
    expect(DATA_TAGS.map((t) => t.key)).toEqual(["confirmed", "needsCheck", "na"]);
    expect(DATA_TAGS.find((t) => t.key === "na")?.note).toContain("0점이 아니라");
  });

  it("조회 함수", () => {
    expect(findCanslimItem("M")?.weight).toBe(15);
    expect(findCanslimItem("Z")).toBeUndefined();
    expect(isCanslimKey("C")).toBe(true);
    expect(isCanslimKey("Q")).toBe(false);
  });
});

describe("종합 점수", () => {
  it("7축 모두 10점이면 100점 / composite10 = 10", () => {
    const s = scoreCanslim(flat(10));
    expect(s.composite100).toBe(100);
    expect(s.composite10).toBe(10);
    expect(s.coverage.pct).toBe(100);
  });

  it("7축 모두 0점이면 0점이다 — 결측과 다르다", () => {
    const s = scoreCanslim(flat(0));
    expect(s.composite100).toBe(0);
    expect(s.band?.grade).toBe("저조");
  });

  it("가중치가 반영된다 — 무거운 축이 점수를 더 움직인다", () => {
    // I(10)만 10점 vs M(15)만 10점 → composite10은 둘 다 10(분모가 그 축뿐)
    // 대신 커버리지가 다르다.
    const onlyI = scoreCanslim(readings({ I: { ...reading(10), key: "I" } }));
    const onlyM = scoreCanslim(readings({ M: { ...reading(10), key: "M" } }));
    expect(onlyI.composite10).toBe(10);
    expect(onlyM.composite10).toBe(10);
    expect(onlyI.coverage.pct).toBe(10);
    expect(onlyM.coverage.pct).toBe(15);
  });

  it("가중 평균이 산술 평균과 다르다", () => {
    // C(15)=10, I(10)=0 → (10*15 + 0*10) / 25 = 6.0  (산술평균이면 5.0)
    const s = scoreCanslim(
      readings({ C: { ...reading(10), key: "C" }, I: { ...reading(0), key: "I" } }),
    );
    expect(s.composite10).toBe(6);
  });
});

describe("⚠ R1 — 결측은 분모에서 뺀다 (0점이 아니다)", () => {
  it("채점하지 않은 축은 분모에서 빠진다", () => {
    // C만 8점 → 8.0. 나머지를 0점으로 쳤다면 8*15/100 = 1.2가 나왔을 것이다.
    const s = scoreCanslim(readings({ C: { ...reading(8), key: "C" } }));
    expect(s.composite10).toBe(8);
    expect(s.composite10).not.toBe(1.2);
  });

  it("N/A 태그는 점수가 적혀 있어도 계산에서 뺀다 — 태그가 사람의 최종 판단이다", () => {
    const s = scoreCanslim(
      readings({
        C: { ...reading(10), key: "C" },
        A: { key: "A", points: 2, tag: "na" },
      }),
    );
    expect(s.composite10).toBe(10);
    expect(s.axes.find((a) => a.item.key === "A")?.excludedBecause).toBe("na");
  });

  it("하나도 채점하지 않으면 점수를 내지 않는다 — 0으로 내면 '저조'로 읽힌다", () => {
    const s = scoreCanslim(new Map());
    expect(s.composite10).toBeUndefined();
    expect(s.composite100).toBeUndefined();
    expect(s.band).toBeUndefined();
    expect(s.coverage.pct).toBe(0);
  });

  it("⚠ 범위를 벗어난 점수를 잘라서 쓰지 않는다 — 드러낸다", () => {
    const s = scoreCanslim(
      readings({ C: { key: "C", points: 42, tag: "confirmed" }, A: { ...reading(6), key: "A" } }),
    );
    expect(s.axes.find((a) => a.item.key === "C")?.excludedBecause).toBe("out-of-range");
    expect(s.composite10).toBe(6); // C는 계산에 안 들어갔다
  });

  it("점수 유효성 판정", () => {
    expect(isScorablePoints(0)).toBe(true);
    expect(isScorablePoints(10)).toBe(true);
    expect(isScorablePoints(-1)).toBe(false);
    expect(isScorablePoints(10.5)).toBe(false);
    expect(isScorablePoints(Number.NaN)).toBe(false);
    expect(isScorablePoints("8")).toBe(false);
    expect(isScorablePoints(undefined)).toBe(false);
  });

  it("커버리지는 항목 수가 아니라 가중치 기준이다", () => {
    // C(15)+A(15)+N(15)+S(15) = 60 → 4/7축이지만 60%
    const s = scoreCanslim(
      readings({
        C: { ...reading(8), key: "C" },
        A: { ...reading(8), key: "A" },
        N: { ...reading(8), key: "N" },
        S: { ...reading(8), key: "S" },
      }),
    );
    expect(s.coverage.scored).toBe(4);
    expect(s.coverage.pct).toBe(60);
    expect(Math.round((4 / 7) * 100)).not.toBe(60); // 항목 수 기준이면 57%였다
  });

  it("커버리지 문구가 상황을 구분한다", () => {
    expect(canslimCoverageNotice(scoreCanslim(new Map()).coverage)).toContain("채점한 축이 없습니다");
    expect(
      canslimCoverageNotice(scoreCanslim(readings({ I: { ...reading(8), key: "I" } })).coverage),
    ).toContain("치우칠 수 있습니다");
    expect(canslimCoverageNotice(scoreCanslim(flat(8)).coverage)).toContain("분모에서 빼고");
  });

  it("채점되지 않은 축을 이유와 함께 돌려준다 — 다음 작업 목록이 된다", () => {
    const s = scoreCanslim(
      readings({ C: { ...reading(8), key: "C" }, A: { key: "A", points: 5, tag: "na" } }),
    );
    const missing = missingAxes(s);
    expect(missing).toHaveLength(6);
    expect(missing.find((m) => m.key === "A")?.why).toBe("na");
    expect(missing.find((m) => m.key === "M")?.why).toBe("missing");
  });
});

describe("등급 밴드", () => {
  it("경계값이 정책대로 걸린다", () => {
    expect(bandFor(10).grade).toBe("우수");
    expect(bandFor(8.0).grade).toBe("우수");
    expect(bandFor(7.9).grade).toBe("보통");
    expect(bandFor(6.5).grade).toBe("보통");
    expect(bandFor(6.4).grade).toBe("저조");
    expect(bandFor(0).grade).toBe("저조");
  });

  it("⚠ 옛 화면 경계(7.0/5.0)로는 판정하지 않는다", () => {
    // 7.5는 옛 경계에서 '우수'였지만 정책상 '보통'이다.
    expect(bandFor(7.5).grade).toBe("보통");
    // 5.5는 옛 경계에서 '보통'이었지만 정책상 '저조'다.
    expect(bandFor(5.5).grade).toBe("저조");
  });
});

describe("⚠ M 게이트 — 시장이 나쁘면 종합 점수와 무관하다", () => {
  it("M이 게이트 이하면 보류", () => {
    const s = scoreCanslim(new Map([...flat(10)]).set("M", { key: "M", points: 3, tag: "confirmed" }));
    expect(s.gate.state).toBe("hold");
    expect(s.gate.text).toContain("보류");
    // ⚠ 종합 점수 자체는 그대로 계산된다. 게이트는 점수를 깎는 장치가 아니다.
    expect(s.composite10).toBeGreaterThan(8);
  });

  it("M이 게이트를 넘으면 통과", () => {
    const s = scoreCanslim(new Map([...flat(10)]).set("M", { key: "M", points: M_GATE_MAX + 1, tag: "confirmed" }));
    expect(s.gate.state).toBe("clear");
  });

  it("⚠ M을 채점하지 않았으면 '통과'가 아니라 '모름'이다", () => {
    const s = scoreCanslim(
      readings({ C: { ...reading(10), key: "C" }, A: { ...reading(10), key: "A" } }),
    );
    expect(s.gate.state).toBe("unknown");
    expect(s.gate.state).not.toBe("clear");
  });

  it("⚠ M이 N/A여도 '통과'가 아니다", () => {
    const s = scoreCanslim(new Map([...flat(10)]).set("M", { key: "M", tag: "na" }));
    expect(s.gate.state).toBe("unknown");
  });

  it("게이트 판정은 축 목록만으로도 낼 수 있다", () => {
    expect(marketGate([]).state).toBe("unknown");
  });
});
