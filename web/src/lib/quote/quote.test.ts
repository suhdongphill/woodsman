import { describe, expect, it } from "vitest";
import {
  FIFTY_TWO_WEEK_DAYS,
  QUOTE_STALE_AFTER_DAYS,
  VOLUME_SPIKE_MULTIPLE,
  buildQuoteKpi,
  isQuoteStale,
  normalizeQuotes,
  quoteAgeDays,
  shiftDays,
} from "./kpi";
import {
  ENVELOPE_PERCENT,
  ENVELOPE_WEEKS,
  buildEnvelope,
  describeEnvelope,
  isoWeekKey,
  toWeeklyCloses,
} from "./envelope";
import { STALE_AFTER_DAYS } from "../manual-price";
import type { QuotePoint } from "./types";

/** 거래일 n개를 하루 간격으로 만든다(주말 무시 — 계산 규칙 검증이 목적이다). */
function series(start: string, closes: number[], volumes?: number[]): QuotePoint[] {
  return closes.map((close, i) => ({
    date: shiftDays(start, i)!,
    close,
    volume: volumes?.[i],
  }));
}

describe("normalizeQuotes", () => {
  it("날짜 오름차순으로 정렬한다", () => {
    const out = normalizeQuotes([
      { date: "2026-03-02", close: 2 },
      { date: "2026-03-01", close: 1 },
    ]);
    expect(out.map((p) => p.date)).toEqual(["2026-03-01", "2026-03-02"]);
  });

  it("같은 날짜가 두 번 오면 뒤엣것을 남긴다 — 수정치가 나중에 온다", () => {
    const out = normalizeQuotes([
      { date: "2026-03-01", close: 1 },
      { date: "2026-03-01", close: 9 },
    ]);
    expect(out).toEqual([{ date: "2026-03-01", close: 9 }]);
  });

  it("종가가 숫자가 아니면 버린다", () => {
    const out = normalizeQuotes([
      { date: "2026-03-01", close: Number.NaN },
      { date: "2026-03-02", close: 5 },
    ]);
    expect(out).toEqual([{ date: "2026-03-02", close: 5 }]);
  });
});

describe("buildQuoteKpi", () => {
  it("점이 없으면 undefined — 0원짜리 KPI를 만들지 않는다", () => {
    expect(buildQuoteKpi([])).toBeUndefined();
  });

  it("최근 종가와 그 거래일을 낸다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [100, 110]));
    expect(kpi?.price).toBe(110);
    expect(kpi?.asOf).toBe("2026-03-02");
  });

  it("전일 대비 등락을 낸다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [100, 110]));
    expect(kpi?.change?.previousClose).toBe(100);
    expect(kpi?.change?.diff).toBe(10);
    expect(kpi?.change?.percent).toBeCloseTo(10, 6);
  });

  it("점이 하나뿐이면 등락을 내지 않는다 — 있는 것만 말한다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [100]));
    expect(kpi?.price).toBe(100);
    expect(kpi?.change).toBeUndefined();
  });

  it("직전 종가가 0이면 변동률을 내지 않는다(무한대 방지)", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [0, 110]));
    expect(kpi?.change).toBeUndefined();
  });

  it("52주 범위와 그 안의 위치를 낸다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [100, 200, 150]));
    expect(kpi?.range?.low).toBe(100);
    expect(kpi?.range?.high).toBe(200);
    expect(kpi?.range?.position).toBeCloseTo(50, 6);
    expect(kpi?.range?.samples).toBe(3);
  });

  it("52주보다 오래된 점은 범위에서 뺀다", () => {
    expect(FIFTY_TWO_WEEK_DAYS).toBe(365);
    const old: QuotePoint = { date: "2024-01-01", close: 5 };
    const kpi = buildQuoteKpi([old, ...series("2026-03-01", [100, 200, 150])]);
    // 5가 저점이 되면 안 된다 — 2년 전 값이다.
    expect(kpi?.range?.low).toBe(100);
  });

  it("밴드 폭이 0이면 위치를 내지 않는다 — 0%는 52주 저점이라는 거짓말이 된다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [100, 100, 100]));
    expect(kpi?.range?.position).toBeUndefined();
  });

  it("거래량 배수를 내고 당일은 평균에서 뺀다", () => {
    // 직전 4일 평균 100, 당일 1000 → 10배
    const kpi = buildQuoteKpi(
      series("2026-03-01", [10, 10, 10, 10, 10], [100, 100, 100, 100, 1000]),
    );
    expect(kpi?.volume?.average).toBe(100);
    expect(kpi?.volume?.latest).toBe(1000);
    expect(kpi?.volume?.multiple).toBeCloseTo(10, 6);
  });

  it("거래량이 일평균 임계를 넘으면 속보 박스를 띄운다", () => {
    expect(VOLUME_SPIKE_MULTIPLE).toBe(10);
    const spike = buildQuoteKpi(series("2026-03-01", [10, 10], [100, 1000]));
    expect(spike?.volume?.spike).toBe(true);
    const calm = buildQuoteKpi(series("2026-03-01", [10, 10], [100, 200]));
    expect(calm?.volume?.spike).toBe(false);
  });

  it("거래량이 없으면 거래량 신호를 내지 않는다 — 없는 것과 0은 다르다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [10, 10]));
    expect(kpi?.volume).toBeUndefined();
  });

  it("스파크 배열은 오래된 것에서 최근 순이다", () => {
    const kpi = buildQuoteKpi(series("2026-03-01", [1, 2, 3]));
    expect(kpi?.spark).toEqual([1, 2, 3]);
  });
});

describe("신선도", () => {
  it("기준일이 없으면 판단하지 않는다", () => {
    expect(quoteAgeDays(undefined, "2026-03-10")).toBeUndefined();
    expect(isQuoteStale(undefined, "2026-03-10")).toBeUndefined();
  });

  it("경과 일수를 센다", () => {
    expect(quoteAgeDays("2026-03-01", "2026-03-10")).toBe(9);
  });

  it("연휴 낀 주말까지는 묵지 않은 것으로 본다", () => {
    expect(QUOTE_STALE_AFTER_DAYS).toBe(5);
    expect(isQuoteStale("2026-03-01", "2026-03-06")).toBe(false);
    expect(isQuoteStale("2026-03-01", "2026-03-07")).toBe(true);
  });

  it("자동 시세 기준은 수기 시세보다 짧다 — 하루 1회 들어오기 때문이다", () => {
    expect(QUOTE_STALE_AFTER_DAYS).toBeLessThan(STALE_AFTER_DAYS);
  });
});

describe("toWeeklyCloses", () => {
  it("각 주의 마지막 거래일 종가만 남긴다", () => {
    // 2026-03-02(월)~03-06(금), 03-09(월)
    const points: QuotePoint[] = [
      { date: "2026-03-02", close: 1 },
      { date: "2026-03-04", close: 2 },
      { date: "2026-03-06", close: 3 },
      { date: "2026-03-09", close: 4 },
    ];
    expect(toWeeklyCloses(points)).toEqual([
      { date: "2026-03-06", close: 3 },
      { date: "2026-03-09", close: 4 },
    ]);
  });

  it("ISO 주는 월요일에 시작한다 — 일요일은 앞 주에 붙는다", () => {
    // 2026-03-08은 일요일, 2026-03-09는 월요일
    expect(isoWeekKey("2026-03-08")).toBe(isoWeekKey("2026-03-06"));
    expect(isoWeekKey("2026-03-09")).not.toBe(isoWeekKey("2026-03-06"));
  });
});

describe("buildEnvelope", () => {
  it("점이 없으면 undefined", () => {
    expect(buildEnvelope([])).toBeUndefined();
  });

  it("중심선 위아래로 정해진 비율만큼 밴드를 만든다", () => {
    expect(ENVELOPE_PERCENT).toBe(20);
    const env = buildEnvelope([{ date: "2026-03-06", close: 100 }]);
    expect(env?.middle).toBe(100);
    expect(env?.upper).toBeCloseTo(120, 6);
    expect(env?.lower).toBeCloseTo(80, 6);
  });

  it("일봉이 아니라 주봉을 평균한다", () => {
    expect(ENVELOPE_WEEKS).toBe(20);
    // 하루 간격 100개: 주봉으로 접으면 15주 남짓이다.
    const env = buildEnvelope(series("2026-01-05", Array.from({ length: 100 }, () => 50)));
    expect(env?.weeks).toBeLessThanOrEqual(ENVELOPE_WEEKS);
    expect(env?.weeks).toBeGreaterThan(10);
  });

  it("밴드 내 위치는 하단 0, 중심 50, 상단 100이다", () => {
    const env = buildEnvelope([{ date: "2026-03-06", close: 100 }]);
    expect(env?.position).toBeCloseTo(50, 6);
  });

  it("밴드를 벗어나면 자르지 않는다 — 붙었다와 뚫었다는 다르다", () => {
    // 20주 평균 대비 마지막 주만 크게 띄운다.
    const weeks: QuotePoint[] = [];
    for (let i = 0; i < 19; i++) weeks.push({ date: shiftDays("2026-01-05", i * 7)!, close: 100 });
    weeks.push({ date: shiftDays("2026-01-05", 19 * 7)!, close: 400 });
    const env = buildEnvelope(weeks);
    expect(env!.position).toBeGreaterThan(100);
  });

  it("20주가 안 차면 있는 만큼으로 내고 몇 주인지 적는다", () => {
    const env = buildEnvelope([
      { date: "2026-03-06", close: 100 },
      { date: "2026-03-13", close: 100 },
    ]);
    expect(env?.weeks).toBe(2);
    expect(describeEnvelope(env!)).toContain("2주로 계산");
  });

  it("중심선 대비 괴리율을 낸다", () => {
    const weeks: QuotePoint[] = [
      { date: "2026-03-06", close: 100 },
      { date: "2026-03-13", close: 100 },
      { date: "2026-03-20", close: 130 },
    ];
    const env = buildEnvelope(weeks);
    expect(env?.middle).toBeCloseTo(110, 6);
    expect(env?.deviation).toBeCloseTo(((130 - 110) / 110) * 100, 6);
  });
});

describe("describeEnvelope — 매매를 지시하지 않는다", () => {
  const forbidden = ["매수", "매도", "손절", "사세요", "파세요", "진입", "청산"];

  it("어떤 위치에서도 매매 지시어가 나오지 않는다", () => {
    const cases = [30, 80, 100, 130, 200, 50];
    for (const close of cases) {
      const env = buildEnvelope([
        { date: "2026-03-06", close: 100 },
        { date: "2026-03-13", close },
      ]);
      const text = describeEnvelope(env!);
      for (const word of forbidden) {
        expect(text.includes(word), `${text} 에 금지어 ${word}`).toBe(false);
      }
    }
  });

  it("상태는 말한다", () => {
    const high = buildEnvelope([
      { date: "2026-03-06", close: 100 },
      { date: "2026-03-13", close: 500 },
    ]);
    expect(describeEnvelope(high!)).toContain("벗어나 있습니다");
  });
});
