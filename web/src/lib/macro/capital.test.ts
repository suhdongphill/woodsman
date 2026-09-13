import { describe, expect, it } from "vitest";
import {
  SPREAD_BASELINE,
  TREND_QUARTERS,
  capitalSentence,
  computeCapitalSpreads,
  computeGrowthFunding,
  computePrys,
} from "./capital";
import { CLAIMS, factsMissingSource, findClaim } from "./claims";
import { GLOSSARY, checkNote, findTerm, glossaryHref, orderedGlossary, sourceNote } from "./glossary";

/**
 * ⚠ **2026-09-13에 직접 받아 계산한 실측값이다.**
 *
 * 생산성은 `OPHNFB`(비농업 시간당 산출) 수준 계열에서 전년비를 직접 계산했다 —
 * ⚠ `PRS85006092`는 「전년비」가 아니라 **연율 분기변화**여서, 그걸 전년비로 읽으면
 *   생산성이 1.4%로 보이고 격차가 **1%p 가까이 틀린다**(FRED 시리즈 페이지로 확인).
 *   이 테스트가 그 함정을 못으로 박는다.
 */
const REAL = {
  productivityYoy: [
    { date: "2025-07-01", value: 2.46 },
    { date: "2025-10-01", value: 2.49 },
    { date: "2026-01-01", value: 2.93 },
    { date: "2026-04-01", value: 2.24 },
  ],
  realYield: 2.55, // DFII10 · 2026-09-10
  realYieldAsOf: "2026-09-10",
  nominalGrowth: 6.56, // 명목 GDP 전년비 · 2026Q2
  nominalGrowthAsOf: "2026-04-01",
  nominalYield: 4.95, // DGS10 · 2026-09-10
  nominalYieldAsOf: "2026-09-10",
};

describe("생산성–실질금리 격차 (PRYS) — 2026-09-13 실측", () => {
  const r = computePrys(REAL)!;

  it("추세는 4분기 평균이다", () => {
    expect(r.quartersUsed).toBe(TREND_QUARTERS);
    expect(r.trend).toBeCloseTo(2.53, 2);
    expect(r.latest).toBeCloseTo(2.24, 2);
  });

  /** ⭐ 거의 정확히 0 — 실질 자금비용이 생산성 수익을 막 따라잡은 상태다. */
  it("두 읽기를 함께 낸다 — 추세 −0.02%p · 최근분기 −0.31%p", () => {
    expect(r.byTrend).toBeCloseTo(-0.02, 2);
    expect(r.byLatest).toBeCloseTo(-0.31, 2);
    expect(r.value).toBe(r.byTrend);
  });

  it("두 읽기의 부호가 같으면 갈렸다고 하지 않는다", () => {
    expect(r.split).toBe(false);
  });

  /** ⚠ 기준일이 다른 값을 맞대고 있다. 대표 기준일은 **오래된 쪽**이다. */
  it("대표 기준일은 더 오래된 쪽(생산성 발표일)이다", () => {
    expect(r.asOf).toBe("2026-04-01");
    expect(r.gapDays).toBe(162);
  });

  /** 되짚을 수 있어야 한다 — 투입값마다 값·기준일·1차 출처가 붙는다. */
  it("투입값을 1차 출처와 함께 펼친다", () => {
    expect(r.parts).toHaveLength(2);
    for (const p of r.parts) {
      expect(p.url, p.label).toMatch(/^https:\/\//);
      expect(p.sourceLabel, p.label).toBeTruthy();
      expect(p.asOf, p.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // ⚠ FRED가 아니라 **원 발표 기관**을 댄다.
    expect(r.parts[0].url).toContain("bls.gov");
    expect(r.parts[1].url).toContain("treasury.gov");
  });

  it("부호가 갈리면 갈렸다고 말한다", () => {
    const split = computePrys({
      ...REAL,
      productivityYoy: [
        { date: "2025-10-01", value: 3.6 },
        { date: "2026-04-01", value: 1.2 },
      ],
      realYield: 2.0,
    })!;
    expect(split.byTrend).toBeCloseTo(0.4, 6); // 평균 2.4 − 2.0
    expect(split.byLatest).toBeCloseTo(-0.8, 6); // 1.2 − 2.0
    expect(split.split).toBe(true);
    // ⚠ 4분기가 안 되면 몇 분기로 쟀는지 밝힌다.
    expect(split.quartersUsed).toBe(2);
  });

  it("⚠ 값이 없으면 계산하지 않는다", () => {
    expect(computePrys({ ...REAL, realYield: undefined })).toBeUndefined();
    expect(computePrys({ ...REAL, productivityYoy: [] })).toBeUndefined();
  });
});

describe("성장–조달 격차 — 2026-09-13 실측", () => {
  const r = computeGrowthFunding(REAL)!;

  it("명목 성장률 − 10년 금리 = +1.61%p", () => {
    expect(r.value).toBeCloseTo(1.61, 2);
  });

  it("기준일은 오래된 쪽이고, 투입값에 1차 출처가 붙는다", () => {
    expect(r.asOf).toBe("2026-04-01");
    for (const p of r.parts) expect(p.url).toMatch(/^https:\/\//);
  });

  it("⚠ 값이 없으면 계산하지 않는다", () => {
    expect(computeGrowthFunding({ ...REAL, nominalYield: undefined })).toBeUndefined();
  });
});

describe("⭐ 두 격차가 엇갈리는 것을 말한다", () => {
  it("기준선은 0이다 — 넘느냐가 해석을 뒤집는다", () => {
    expect(SPREAD_BASELINE).toBe(0);
  });

  /**
   * ⭐ 이 화면을 만든 이유가 이 한 줄이다 — 정부 부채는 굴러가는데(성장 > 이자)
   *    민간 투자는 빡빡한(생산성 < 실질금리) 상태를 잡아낸다.
   */
  it("성장은 플러스인데 생산성 격차가 마이너스면 엇갈렸다고 적는다", () => {
    const s = computeCapitalSpreads(REAL);
    const sentence = capitalSentence(s)!;
    expect(sentence).toContain("두 값이 엇갈립니다");
    expect(sentence).toContain("민간 투자 쪽은 빡빡");
  });

  it("둘 다 없으면 문장도 없다", () => {
    expect(
      capitalSentence(
        computeCapitalSpreads({
          productivityYoy: [],
        }),
      ),
    ).toBeUndefined();
  });
});

describe("용어 사전 — 독자가 확인할 수 있어야 한다", () => {
  /**
   * ⚠ 확인하지 않은 1차 출처 링크는 **없는 것보다 나쁘다.** 확인하러 간 독자가 404를 보면
   *    확인할 수 있다는 약속 자체가 깨진다.
   */
  it("⚠ 외부 출처를 단 용어는 링크와 확인일을 둘 다 갖는다", () => {
    for (const e of GLOSSARY) {
      if (e.own) {
        expect(e.url, `${e.term}: 우리 정의에 남의 링크를 달지 않는다`).toBeUndefined();
        continue;
      }
      expect(e.url, e.term).toMatch(/^https:\/\//);
      expect(e.checked, e.term).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.checkMethod, e.term).toBeTruthy();
    }
  });

  /** ⭐ 우리가 만든 이름은 우리 것이라고 말한다 — 표준 지표처럼 읽히면 안 된다. */
  it("⭐ 우리 정의는 우리 것이라고 밝힌다", () => {
    const prys = findTerm("PRYS")!;
    expect(prys.own).toBe(true);
    expect(sourceNote(prys)).toContain("우리가 계산해 붙인 이름");
    expect(sourceNote(findTerm("노동생산성")!)).toContain("2026-09-13");
  });

  it("별칭으로도 찾힌다", () => {
    expect(findTerm("ULC")?.term).toBe("단위노동비용");
    expect(findTerm("output per hour")?.term).toBe("노동생산성");
    expect(findTerm("dual mandate")?.term).toBe("연준의 세 가지 책무");
    expect(findTerm("없는 말")).toBeUndefined();
  });

  it("한 줄 뜻은 한 줄이다", () => {
    for (const e of GLOSSARY) expect(e.short.length, e.term).toBeLessThan(120);
  });

  /**
   * ⚠ 앵커는 **글이 링크하는 주소**다. 두 용어가 같은 앵커를 가지면 뒤엣것이 조용히 가려지고,
   *    주소에 못 쓰는 문자가 섞이면 링크가 빗나간다.
   */
  it("⚠ 앵커는 겹치지 않고 주소에 쓸 수 있는 모양이다", () => {
    const slugs = GLOSSARY.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(glossaryHref(findTerm("PRYS")!)).toBe("/macro/glossary#prys");
  });

  /** ⚠ 자본 엔진 카드가 `<Term term="…">`으로 거는 말. 사전에서 빠지면 링크가 사라진다. */
  it("⚠ 카드 본문이 링크하는 용어는 사전에 있다", () => {
    for (const t of ["노동생산성", "실질금리", "명목 GDP", "생산성–실질금리 격차", "성장–조달 격차"]) {
      expect(findTerm(t), t).toBeDefined();
    }
  });

  it("⚠ 우리 정의에는 「링크를 확인했다」는 문구를 붙이지 않는다", () => {
    expect(checkNote(findTerm("PRYS")!)).toBeUndefined();
    expect(checkNote(findTerm("노동생산성")!)).toBe("링크 2026-09-13 본문 확인");
    expect(checkNote(findTerm("EFFR")!)).toBe("링크 2026-09-13 응답 확인");
  });

  it("목록은 사전 순이다", () => {
    const names = orderedGlossary().map((e) => e.term);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ko")));
  });
});

describe("주장 등급 — 사실과 해석을 섞지 않는다", () => {
  /**
   * ⚠ 출처 없는 「사실」이 하나라도 섞이면 등급 체계 전체가 장식이 된다 —
   *    독자는 우리가 확인했는지 아닌지 구분할 방법이 없어진다.
   */
  it("⚠ Fact는 1차 출처와 확인일 없이 존재할 수 없다", () => {
    expect(factsMissingSource().map((c) => c.id)).toEqual([]);
  });

  /** ⭐ 사장님이 확인을 부탁한 지점. 「숨은 책무」가 아니라 **법에 쓰인** 책무다. */
  it("⭐ 연준의 세 번째 책무는 Fact다 — 제2A조 원문", () => {
    const c = findClaim("fed-mandate-three")!;
    expect(c.grade).toBe("Fact");
    expect(c.url).toBe("https://www.federalreserve.gov/aboutthefed/section2a.htm");
    expect(c.why).toContain("moderate long-term interest rates");
    expect(c.why).toContain("축약어");
  });

  /** ⚠ 그러나 「특정 수준을 겨냥한다」는 사실이 아니다 — 둘을 붙여 두어야 안 헷갈린다. */
  it("⚠ 연준이 10년물을 겨냥한다는 것은 Rejected다", () => {
    expect(findClaim("fed-targets-10y")?.grade).toBe("Rejected");
    expect(findClaim("fed-manages-long-rates")?.grade).toBe("Inference");
    expect(findClaim("fiscal-dominance")?.grade).toBe("Hypothesis");
  });

  it("모든 주장은 등급의 이유를 적는다", () => {
    for (const c of CLAIMS) {
      expect(c.why.length, c.id).toBeGreaterThan(20);
      expect(c.statement.length, c.id).toBeGreaterThan(5);
    }
  });

  /** ⚠ 자꾸 재등장하는 틀린 문장을 지워 두지 않고 **틀렸다고 적어** 둔다. */
  it("⚠ 요구서가 금지한 문장들이 Rejected로 남아 있다", () => {
    const rejected = CLAIMS.filter((c) => c.grade === "Rejected").map((c) => c.id);
    expect(rejected).toContain("productivity-instant-cpi");
    expect(rejected).toContain("debt-is-liquidity");
    expect(rejected).toContain("hike-always-right");
    expect(rejected).toContain("ai-capex-always-productive");
  });

  it("id는 겹치지 않는다", () => {
    const ids = CLAIMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
