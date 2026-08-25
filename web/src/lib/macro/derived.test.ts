/**
 * 파생 계열 테스트 — **순유동성이 조용히 틀리는 길**을 하나씩 막는다.
 *
 * 이 지표의 위험은 값이 없어서 안 보이는 게 아니라, **성분이 빠져도 선이 그려지는** 것이다.
 * 그래서 "제대로 계산한다"보다 "틀렸을 때 안 그린다"를 더 많이 잰다.
 */
import { describe, expect, it } from "vitest";
import { composeDerived, derivedMeta, valueAsOf, type MacroDerived } from "./derived";
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
