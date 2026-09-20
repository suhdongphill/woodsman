/**
 * 파생 계열 테스트 — **순유동성이 조용히 틀리는 길**을 하나씩 막는다.
 *
 * 이 지표의 위험은 값이 없어서 안 보이는 게 아니라, **성분이 빠져도 선이 그려지는** 것이다.
 * 그래서 "제대로 계산한다"보다 "틀렸을 때 안 그린다"를 더 많이 잰다.
 */
import { describe, expect, it } from "vitest";
import { composeDerived, derivedMeta, realizedVolBp, valueAsOf, type MacroDerived } from "./derived";
import {
  MACRO_INDICATORS,
  autoIndicators,
  derivedIndicators,
  findIndicator,
  manualIndicators,
  validateSectors,
  withDerivedComponents,
} from "./catalog";
import { applyTransform } from "./series";

const NETLIQ: MacroDerived = { op: "subtract", from: ["a", "b", "c"], carryDays: 10 };

const pt = (date: string, value: number) => ({ date, value });

describe("valueAsOf — 기준일 이하의 가장 최근 값", () => {
  const series = [pt("2026-08-03", 1), pt("2026-08-10", 2), pt("2026-08-17", 3)];

  it("기준일에 딱 맞는 값이 있으면 그것을 쓴다", () => {
    expect(valueAsOf(series, "2026-08-10", 10)).toBe(2);
  });

  it("없으면 앞선 값을 끌어다 쓴다", () => {
    expect(valueAsOf(series, "2026-08-13", 10)).toBe(2);
  });

  it("⚠ 기준일 뒤의 값은 절대 쓰지 않는다 — 미래를 당겨 쓰는 것이다", () => {
    expect(valueAsOf(series, "2026-08-01", 10)).toBeUndefined();
  });

  it("⚠ 한도를 넘게 낡았으면 버린다 — 반년 전 값으로 오늘 선을 그리지 않는다", () => {
    expect(valueAsOf(series, "2026-08-25", 10)).toBe(3); // 8일 전 → 한도 안
    expect(valueAsOf(series, "2026-08-30", 10)).toBeUndefined(); // 13일 전 → 버린다
  });
});

describe("composeDerived — 순유동성 합성", () => {
  it("기준 계열의 날짜마다 나머지를 뺀다", () => {
    const out = composeDerived(NETLIQ, [
      [pt("2026-08-12", 6.76), pt("2026-08-19", 6.75)],
      [pt("2026-08-12", 0.96), pt("2026-08-19", 0.94)],
      [pt("2026-08-12", 0.0003), pt("2026-08-19", 0.0003)],
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].date).toBe("2026-08-12");
    expect(out[1].value).toBeCloseTo(6.75 - 0.94 - 0.0003, 4);
  });

  it("⚠ 성분이 하나라도 비면 파생 자체가 없다 — 둘만으로 그린 선에 세 계열 이름을 붙이지 않는다", () => {
    const parts = [[pt("2026-08-19", 6.75)], [], [pt("2026-08-19", 0.0003)]];
    expect(composeDerived(NETLIQ, parts)).toEqual([]);
    expect(composeDerived(NETLIQ, [parts[0], undefined, parts[2]])).toEqual([]);
  });

  it("⚠ 짝을 못 찾은 날짜는 버린다 — 0으로 채우면 '그날 TGA가 0이었다'가 된다", () => {
    const out = composeDerived(NETLIQ, [
      [pt("2026-06-10", 6.7), pt("2026-08-19", 6.75)],
      [pt("2026-06-10", 0.8), pt("2026-08-19", 0.94)],
      // 역레포는 최근 것만 있다 — 6월 기준일에는 끌어다 쓸 값이 없다.
      [pt("2026-08-19", 0.0003)],
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-08-19");
  });

  it("성분 개수가 규칙과 다르면 아무것도 내지 않는다", () => {
    expect(composeDerived(NETLIQ, [[pt("2026-08-19", 1)], [pt("2026-08-19", 1)]])).toEqual([]);
  });

  /**
   * ⚠ 실제 FRED 응답(2026-08-19)으로 끝까지 통과시킨다. 단위가 어긋나면 여기서 죽는다.
   *   WALCL 6,745,699(백만) · WDTGAL 936,406(백만) · RRPONTSYD 0.317(십억)
   */
  it("⭐ 실제 응답 → 변환 → 합성이 5.8조 언저리로 떨어진다", () => {
    const assets = applyTransform([pt("2026-08-19", 6_745_699)], "levelM");
    const tga = applyTransform([pt("2026-08-19", 936_406)], "levelM");
    const rrp = applyTransform([pt("2026-08-19", 0.317)], "levelK");

    const out = composeDerived(NETLIQ, [assets, tga, rrp]);
    expect(out[0].value).toBeCloseTo(5.809, 3);

    // ⚠ TGA를 십억으로 잘못 읽었다면 이렇게 된다 — 800배가 아니라 부호까지 뒤집힌다.
    const wrong = composeDerived(NETLIQ, [assets, applyTransform([pt("2026-08-19", 936_406)], "levelK"), rrp]);
    expect(wrong[0].value).toBeLessThan(-900);
  });
});

describe("derivedMeta — 언제 값이고 언제 받았나", () => {
  it("⚠ 가장 오래된 기준일을 쓴다 — 한 성분이 오늘 것이라고 오늘 기준이 아니다", () => {
    const meta = derivedMeta([
      { asOf: "2026-08-19", fetchedAt: "2026-08-25T00:00:00.000Z" },
      { asOf: "2026-08-12", fetchedAt: "2026-08-25T00:00:00.000Z" },
      { asOf: "2026-08-24", fetchedAt: "2026-08-20T00:00:00.000Z" },
    ]);
    expect(meta.asOf).toBe("2026-08-12");
    // 수집시각도 가장 오래된 것 — 성분 하나만 끊겨도 파생은 끊긴 것으로 본다.
    expect(meta.fetchedAt).toBe("2026-08-20T00:00:00.000Z");
  });

  it("성분 하나라도 기준일이 없으면 파생도 기준일이 없다", () => {
    expect(derivedMeta([{ asOf: "2026-08-19" }, undefined]).asOf).toBeUndefined();
  });
});

describe("카탈로그의 파생 정의", () => {
  it("정의 검증을 통과한다", () => {
    expect(validateSectors()).toEqual([]);
  });

  it("순유동성이 세 성분을 갖고, 성분이 모두 실재한다", () => {
    const netliq = findIndicator("netliq");
    expect(netliq?.source).toBe("DERIVED");
    expect(netliq?.derived?.from).toEqual(["fed_assets", "tga", "rrp"]);
    for (const key of netliq!.derived!.from) expect(findIndicator(key)).toBeTruthy();
  });

  it("⚠ 파생은 transform이 level이다 — 성분이 이미 변환을 거쳤으므로 두 번 걸면 안 된다", () => {
    for (const i of MACRO_INDICATORS.filter((x) => x.derived)) {
      expect(i.transform, `${i.key}`).toBe("level");
    }
  });

  it("⚠ 파생에는 소스 ID가 없다 — 수집기가 없는 시리즈를 부르러 가면 안 된다", () => {
    for (const i of MACRO_INDICATORS.filter((x) => x.source === "DERIVED")) {
      expect(i.sourceId).toBeUndefined();
    }
  });

  it("⚠ 수집 목록에도 수동 입력 목록에도 들어가지 않는다", () => {
    const derivedKeys = derivedIndicators().map((i) => i.key);
    expect(derivedKeys).toContain("netliq");
    for (const key of derivedKeys) {
      expect(autoIndicators().map((i) => i.key)).not.toContain(key);
      expect(manualIndicators().map((i) => i.key)).not.toContain(key);
    }
  });

  it("성분 키를 같이 읽는다 — 안 그러면 화면이 조용히 빈 선을 그린다", () => {
    expect(withDerivedComponents(["netliq"])).toEqual(["netliq", "fed_assets", "tga", "rrp"]);
    // 이미 있는 키를 두 번 넣지 않는다(IN 절이 길어질 뿐이다).
    expect(withDerivedComponents(["netliq", "tga"])).toEqual([
      "netliq",
      "tga",
      "fed_assets",
      "rrp",
    ]);
    // 파생이 없으면 그대로다.
    expect(withDerivedComponents(["ust10y"])).toEqual(["ust10y"]);
  });
});

describe("실현변동성(bp) — MOVE 대신 쓰는 지나간 국채 변동성 (R2b-3)", () => {
  const days = (n: number, start = "2026-01-05") =>
    Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

  it("일간 변화의 표본표준편차 × √252 × 100", () => {
    // 변화가 +0.05, −0.05 번갈아 → 표준편차(표본, n=4) = 0.05·√(4/3)
    const values = [4, 4.05, 4, 4.05, 4];
    const out = realizedVolBp(days(5).map((d, i) => pt(d, values[i])), 4, 5);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(0.05 * Math.sqrt(4 / 3) * Math.sqrt(252) * 100, 6);
  });

  it("⚠ 창이 차기 전에는 내지 않는다 — 짧은 창의 표준편차는 과장되거나 0이다", () => {
    expect(realizedVolBp(days(4).map((d, i) => pt(d, 4 + i * 0.01)), 4, 5)).toHaveLength(0);
  });

  it("⚠ 긴 공백 뒤의 변화를 하루치로 넣지 않는다 — 창을 다시 채운다", () => {
    const a = days(5).map((d, i) => pt(d, 4 + (i % 2) * 0.05));
    const b = days(3, "2026-03-01").map((d, i) => pt(d, 5 + (i % 2) * 0.05));
    // 공백 뒤 3점 = 변화 2개 → 창 4를 못 채워 추가 점이 없다
    expect(realizedVolBp([...a, ...b], 4, 5)).toHaveLength(1);
  });

  it("⚠ 선형 계산이 매번 새로 센 값과 같다", () => {
    const pts = days(80).map((d, i) => pt(d, 4 + Math.sin(i / 3) * 0.1 + (i % 7) * 0.01));
    const fast = realizedVolBp(pts, 20, 5);
    const naive = pts.slice(20).map((p, k) => {
      const i = k + 20;
      const diffs = Array.from({ length: 20 }, (_, j) => pts[i - 19 + j].value - pts[i - 20 + j].value);
      const m = diffs.reduce((s, x) => s + x, 0) / 20;
      const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - m) ** 2, 0) / 19);
      return pt(p.date, sd * Math.sqrt(252) * 100);
    });
    expect(fast.length).toBe(naive.length);
    fast.forEach((f, i) => expect(f.value).toBeCloseTo(naive[i].value, 8));
  });

  it("⚠ 카탈로그 — 성분 하나짜리 파생은 실현변동성뿐이고, 이름에 MOVE를 쓰지 않는다", () => {
    const rvol = findIndicator("ust10y_rvol")!;
    expect(rvol.derived).toMatchObject({ op: "realizedVolBp", from: ["ust10y"], window: 20 });
    expect(rvol.name).not.toMatch(/MOVE/);
    expect(rvol.sourceLabel).toMatch(/MOVE 아님/);
    expect(validateSectors()).toEqual([]);
    for (const i of derivedIndicators()) {
      if (i.derived!.from.length < 2) expect(i.derived!.op).toBe("realizedVolBp");
    }
  });
});

/**
 * 비율(`ratioPct`) — 2026-09-20, 재정 묶음을 붙이며 생겼다.
 *
 * ## 왜 뺄셈이 아니라 나눗셈이 필요했나
 * 재정 적자를 **금액**으로 넣으면 물가와 경제 규모를 따라 커져서, 백분위가 늘 최악에 붙는다.
 * 움직이지 않는 지표는 기둥에 아무것도 보태지 않는다(죽은 지표). 그래서 세입으로 나눈다.
 */
describe("composeDerived — 비율(ratioPct)", () => {
  const RATIO: MacroDerived = { op: "ratioPct", from: ["num", "den"], carryDays: 10 };

  it("분자 ÷ 분모 × 100", () => {
    const out = composeDerived(RATIO, [[pt("2026-04-01", 130)], [pt("2026-04-01", 100)]]);
    expect(out).toEqual([pt("2026-04-01", 130)]);
  });

  it("날짜 눈금은 **분자**가 정한다 — 분모는 그날 이하의 최근 값을 쓴다", () => {
    const out = composeDerived(RATIO, [
      [pt("2026-04-05", 21), pt("2026-07-05", 22)],
      [pt("2026-04-01", 100), pt("2026-07-01", 110)],
    ]);
    expect(out.map((p) => p.date)).toEqual(["2026-04-05", "2026-07-05"]);
    expect(out[1].value).toBeCloseTo(20, 10);
  });

  it("⚠ 분모가 0인 날은 버린다 — 무한대는 값이 아니다", () => {
    const out = composeDerived(RATIO, [
      [pt("2026-01-01", 5), pt("2026-04-01", 6)],
      [pt("2026-01-01", 0), pt("2026-04-01", 50)],
    ]);
    expect(out).toEqual([pt("2026-04-01", 12)]);
  });

  it("⚠ 분모가 한도보다 낡았으면 그 날을 버린다 — 옛 세입으로 올해 비율을 내지 않는다", () => {
    const out = composeDerived(RATIO, [[pt("2026-04-20", 130)], [pt("2026-01-01", 100)]]);
    expect(out).toEqual([]);
  });

  it("⚠ 성분이 하나라도 비면 아무것도 내지 않는다", () => {
    expect(composeDerived(RATIO, [[pt("2026-04-01", 130)], []])).toEqual([]);
    expect(composeDerived(RATIO, [[pt("2026-04-01", 130)], undefined])).toEqual([]);
  });

  it("⚠ 검증기가 성분 셋짜리 비율을 잡는다 — 무엇을 무엇으로 나눴는지 읽을 수 없다", () => {
    const broken = validateSectors([
      {
        group: { key: "fiscal", name: "x", emoji: "", question: "", intro: "", order: 1 },
        indicators: [
          {
            key: "three",
            name: "성분 셋짜리 비율",
            group: "fiscal",
            source: "DERIVED",
            derived: { op: "ratioPct", from: ["a", "b", "c"], carryDays: 10 },
            transform: "level",
            layer: "L3",
            type: "level",
            freq: "q",
            unit: "%",
            decimals: 1,
            url: "https://example.test",
            sourceLabel: "x",
            what: "x",
            why: "x",
            read: "x",
            order: 1,
          },
        ],
      },
    ]);
    expect(broken.some((p) => p.includes("비율(ratioPct)의 성분은 둘이어야 한다"))).toBe(true);
  });

  it("카탈로그 — 재정 두 비율은 같은 장부(BEA) 안에서만 나눈다", () => {
    const spend = findIndicator("fed_outlays_receipts")!;
    const interest = findIndicator("fed_interest_receipts")!;
    expect(spend.derived).toMatchObject({ op: "ratioPct", from: ["fed_outlays", "fed_receipts"] });
    expect(interest.derived).toMatchObject({ op: "ratioPct", from: ["fed_interest", "fed_receipts"] });
    // ⚠ 성분 셋 다 같은 단위(levelK로 조 달러)여야 비율이 뜻을 갖는다
    for (const key of ["fed_outlays", "fed_receipts", "fed_interest"]) {
      expect(findIndicator(key)!.transform, key).toBe("levelK");
    }
    // ⚠ 재무부 장부(MSPD)는 이 비율에 섞이지 않는다
    expect([spend, interest].some((i) => i.derived!.from.includes("treasury_marketable"))).toBe(false);
  });
});
