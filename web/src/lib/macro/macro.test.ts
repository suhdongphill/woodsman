import { describe, expect, it } from "vitest";
import { splitEmphasis } from "../format";
import {
  MACRO_INDICATORS,
  RECESSION_SIGNAL_KEYS,
  autoIndicators,
  findIndicator,
  headlineIndicators,
  indicatorsByGroup,
  manualIndicators,
  recessionSignalIndicators,
  validateSectors,
} from "./catalog";
import { MACRO_GROUPS, findMacroGroup, orderedMacroGroups } from "./groups";
import {
  applyTransform,
  changeFromPrevious,
  chartBaseline,
  formatIndicatorValue,
  latestPoint,
  tailPoints,
  type SeriesPoint,
} from "./series";
import { judgeSignal, summarizeRecession, type SignalStatus } from "./signal";
import {
  dedupeByDate,
  parseEcosJson,
  parseFredCsv,
  parseNaverTotalInfo,
  parseYahooChart,
} from "./parse";

describe("⚠ 단위 환산 — 유동성 묶음이 조용히 1000배 틀리는 자리", () => {
  /**
   * FRED는 같은 유동성 블록에서도 계열마다 단위가 다르다. 실제 응답으로 확인한 값이다.
   *   WALCL  2026-06-10 = 6,725,397 (백만 달러) → 6.73조
   *   WDTGAL 2026-06-10 =   801,084 (백만 달러) → 0.80조
   *   RRPONTSYD 2026-06-02 =    2.502 (십억 달러) → 0.0025조
   * 하나라도 틀리면 합계·비교가 1000배 어긋나는데 화면은 멀쩡해 보인다.
   */
  it("백만 달러 계열은 levelM으로 조 달러가 된다", () => {
    const out = applyTransform([{ date: "2026-06-10", value: 6_725_397 }], "levelM");
    expect(out[0].value).toBeCloseTo(6.725, 3);
  });

  it("TGA도 백만 달러다 — 십억으로 읽으면 800배 커진다", () => {
    expect(applyTransform([{ date: "2026-06-10", value: 801_084 }], "levelM")[0].value).toBeCloseTo(
      0.801,
      3,
    );
    // ⚠ 틀린 변환(levelK)을 썼다면 이 값이 나온다 — 0.8조가 아니라 801조로 읽힌다.
    expect(applyTransform([{ date: "2026-06-10", value: 801_084 }], "levelK")[0].value).toBe(801.084);
  });

  it("역레포는 십억 달러라 levelK가 맞다", () => {
    expect(applyTransform([{ date: "2026-06-02", value: 2.502 }], "levelK")[0].value).toBeCloseTo(
      0.0025,
      4,
    );
  });

  it("카탈로그가 실제로 그 변환을 쓰고 있다", () => {
    const byKey = new Map(MACRO_INDICATORS.map((i) => [i.key, i]));
    expect(byKey.get("fed_assets")?.transform).toBe("levelM");
    expect(byKey.get("tga")?.transform).toBe("levelM");
    expect(byKey.get("rrp")?.transform).toBe("levelK");
  });
});

describe("섹터 정의 검증 (볼트 사양서 1-1)", () => {
  it("⚠ 정의가 깨져 있으면 목록으로 드러난다 — 반쯤 동작하게 두지 않는다", () => {
    expect(validateSectors()).toEqual([]);
  });

  it("검증기가 실제로 문제를 잡는다", () => {
    const broken = validateSectors([
      {
        group: { key: "rates", name: "x", emoji: "", question: "", intro: "", order: 1 },
        indicators: [
          {
            key: "dup",
            name: "자동인데 소스 없음",
            group: "fx",
            source: "FRED",
            transform: "level",
            layer: "L9" as never,
            type: "capacity_remaining",
            freq: "d",
            staleDays: 30,
            unit: "",
            decimals: 0,
            url: "http://insecure",
            sourceLabel: "",
            what: "",
            why: "",
            read: "",
            order: 1,
          },
        ],
      },
    ]);
    expect(broken.some((p) => p.includes("소스 ID가 없다"))).toBe(true);
    expect(broken.some((p) => p.includes("group(fx)이 다르다"))).toBe(true);
    expect(broken.some((p) => p.includes("출처 링크가 없다"))).toBe(true);
    expect(broken.some((p) => p.includes("초보자 설명"))).toBe(true);
    expect(broken.some((p) => p.includes("레이어"))).toBe(true);
    expect(broken.some((p) => p.includes("stateDependency"))).toBe(true);
    expect(broken.some((p) => p.includes("staleWhy"))).toBe(true);
  });

  /**
   * ⚠ 신선도는 지표마다 발표 주기를 정확히 적어야 동작한다. 하나라도 비면
   *    그 지표만 조용히 판정에서 빠진다 — 그게 이 기능이 죽는 방식이다.
   */
  it("모든 지표에 레이어·성격·발표주기가 있다", () => {
    for (const i of MACRO_INDICATORS) {
      expect(i.layer, i.key).toBeTruthy();
      expect(i.type, i.key).toBeTruthy();
      expect(["d", "w", "m", "q"], i.key).toContain(i.freq);
    }
  });
});

describe("지표 카탈로그 무결성", () => {
  it("키가 중복되지 않는다 — 키가 겹치면 시계열이 섞인다", () => {
    const keys = MACRO_INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("모든 지표가 존재하는 그룹에 속한다", () => {
    const groups = new Set(MACRO_GROUPS.map((g) => g.key));
    for (const i of MACRO_INDICATORS) expect(groups.has(i.group)).toBe(true);
  });

  it("자동 수집 지표는 반드시 소스 ID를 갖는다 — 없으면 조용히 안 받아진다", () => {
    for (const i of autoIndicators()) {
      expect(i.sourceId, `${i.key}에 sourceId가 없다`).toBeTruthy();
    }
  });

  /**
   * ⚠ 2026-09-05. 연준 H.10(FRED의 `DEX*` 환율 계열)은 **일별 값을 주 1회(월요일)** 낸다.
   *    관측은 일간이라 `freq: "d"`로 적게 되는데, 그러면 화면은 최대 일주일 뒤처진 값을
   *    「최신」이라 부르고 신선도 판정도 같이 거짓말을 한다. 8월 31일 원/달러 사고
   *    (열흘 전 1,350원)와 9월 5일 엔·위안(8월 28일 값)이 **같은 원인**이었다.
   *    발표가 주 1회인 계열은 일간 지표로 쓰지 않는다 — Yahoo 일봉으로 받는다.
   */
  it("⚠ 일간 지표를 연준 H.10 주간 계열(FRED DEX*)로 받지 않는다", () => {
    const weekly = MACRO_INDICATORS.filter(
      (i) => i.freq === "d" && i.source === "FRED" && /^DEX/.test(i.sourceId ?? ""),
    );
    expect(
      weekly.map((i) => i.key),
      "H.10은 주 1회 발표라 일간 지표의 최신값이 최대 일주일 뒤처진다",
    ).toEqual([]);
  });

  it("수동 지표는 소스 ID가 없고, 출처 표기에 '수동'이 들어간다", () => {
    for (const i of manualIndicators()) {
      expect(i.sourceId).toBeUndefined();
      expect(i.sourceLabel).toContain("수동");
    }
  });

  /**
   * ⚠ 2026-09-05. 수동으로 둔 지표 일곱 개에 **값이 한 점도 없었다** — 손으로 넣기로 한
   *    것은 결국 안 들어간다. 그래서 수동은 "아직 안 붙였다"가 아니라 **"무료로는 못 받는다"**
   *    일 때만 남긴다. 무엇이 막고 있는지를 `sourceLabel`이 말해야, 나중에 길이 열렸을 때
   *    다시 볼 수 있다(ISM·컨퍼런스보드·NAHB는 유료 라이선스, 선행 PER은 유료 데이터다).
   */
  it("⚠ 수동으로 남긴 지표는 출처 기관을 밝힌다 — 왜 자동이 아닌지 추적할 수 있게", () => {
    for (const i of manualIndicators()) {
      expect(i.sourceLabel.replace("수동 입력", "").trim().length, `${i.key}`).toBeGreaterThan(2);
      expect(i.url, `${i.key}`).toMatch(/^https:\/\//);
    }
  });

  it("ECOS 지표는 `통계표/항목` 꼴의 소스 ID를 갖는다", () => {
    for (const i of MACRO_INDICATORS.filter((x) => x.source === "ECOS")) {
      expect(i.sourceId, `${i.key}`).toMatch(/^[A-Z0-9]+\/[A-Z0-9]+$/i);
    }
  });

  it("모든 지표가 초보자용 세 줄 설명을 갖는다", () => {
    for (const i of MACRO_INDICATORS) {
      expect(i.what.length, `${i.key}.what`).toBeGreaterThan(10);
      expect(i.why.length, `${i.key}.why`).toBeGreaterThan(10);
      expect(i.read.length, `${i.key}.read`).toBeGreaterThan(10);
    }
  });

  it("⚠ 설명이 매매를 권유하지 않는다", () => {
    // /disclaimer와 같은 선. 읽는 법까지만 쓰고 판단은 사람이 한다.
    const banned = /매수하세요|매도하세요|사야 합니다|팔아야 합니다|추천합니다/;
    for (const i of MACRO_INDICATORS) {
      expect(`${i.what}${i.why}${i.read}`).not.toMatch(banned);
    }
  });

  it("모든 지표가 원 출처 링크를 갖는다 — 숫자는 확인 가능해야 한다", () => {
    for (const i of MACRO_INDICATORS) expect(i.url).toMatch(/^https:\/\//);
  });

  it("침체 시그널 지표는 전부 판정 규칙을 갖는다", () => {
    const signals = recessionSignalIndicators();
    expect(signals).toHaveLength(RECESSION_SIGNAL_KEYS.length);
    for (const s of signals) expect(s.signal).toBeTruthy();
  });

  it("홈 대표 지표는 그룹이 겹치지 않게 고른다 — 한 줄에 같은 얘기를 두 번 쓰지 않는다", () => {
    const groups = headlineIndicators().map((i) => i.group);
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("그룹마다 지표가 하나 이상 있다 — 빈 그룹 카드를 만들지 않는다", () => {
    for (const g of MACRO_GROUPS) {
      expect(indicatorsByGroup(g.key).length, `${g.key}가 비었다`).toBeGreaterThan(0);
    }
  });

  it("그룹 URL 키는 영문 소문자다(공유·검색에서 깨지지 않게)", () => {
    for (const g of MACRO_GROUPS) expect(g.key).toMatch(/^[a-z]+$/);
    expect(findMacroGroup("rates")?.name).toBe("금리");
    expect(findMacroGroup("없는그룹")).toBeUndefined();
    expect(orderedMacroGroups()[0].key).toBe("rates");
  });

  it("키로 지표를 찾을 수 있다", () => {
    expect(findIndicator("t10y2y")?.group).toBe("rates");
    expect(findIndicator("없는키")).toBeUndefined();
  });
});

describe("시계열 변환", () => {
  const monthly: SeriesPoint[] = [
    { date: "2025-06-01", value: 100 },
    { date: "2025-07-01", value: 102 },
    { date: "2026-06-01", value: 110 },
    { date: "2026-07-01", value: 107.1 },
  ];

  it("level은 그대로 둔다", () => {
    expect(applyTransform(monthly, "level")).toEqual(monthly);
  });

  it("yoy는 1년 전 같은 달과 비교한다", () => {
    const out = applyTransform(monthly, "yoy");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: "2026-06-01", value: 10 });
    expect(out[1].value).toBeCloseTo(5);
  });

  it("⚠ 1년 전 값이 없는 점은 버린다 — 0으로 채우면 없는 사건이 생긴다", () => {
    const out = applyTransform([{ date: "2026-01-01", value: 5 }], "yoy");
    expect(out).toHaveLength(0);
  });

  it("momdiff는 지난달과의 차이(원단위)다 — 고용 증감처럼", () => {
    const out = applyTransform(
      [
        { date: "2026-05-01", value: 159_000 },
        { date: "2026-06-01", value: 159_057 },
      ],
      "momdiff",
    );
    expect(out).toEqual([{ date: "2026-06-01", value: 57 }]);
  });

  it("mom은 지난달 대비 %다", () => {
    const out = applyTransform(
      [
        { date: "2026-05-01", value: 200 },
        { date: "2026-06-01", value: 201 },
      ],
      "mom",
    );
    expect(out[0].value).toBeCloseTo(0.5);
  });

  it("levelK는 천 단위로 줄인다", () => {
    expect(applyTransform([{ date: "2026-06-01", value: 1_427_000 }], "levelK")).toEqual([
      { date: "2026-06-01", value: 1427 },
    ]);
  });
});

describe("값 표기", () => {
  const pct = { transform: "level" as const, unit: "%", decimals: 2 };
  const yoy = { transform: "yoy" as const, unit: "%", decimals: 1 };

  it("단위를 붙이고 자릿수를 맞춘다", () => {
    expect(formatIndicatorValue(pct, 4.6789)).toBe("4.68%");
  });

  it("변화율에는 부호를 붙인다 — 방향이 먼저 읽혀야 한다", () => {
    expect(formatIndicatorValue(yoy, 3.5)).toBe("+3.5%");
  });

  it("⚠ 마이너스는 하이픈이 아니라 −(U+2212)로 쓴다", () => {
    expect(formatIndicatorValue(yoy, -1.2)).toBe("−1.2%");
    expect(formatIndicatorValue(yoy, -1.2)).not.toContain("-");
  });

  it("값이 없으면 0이 아니라 —로 둔다", () => {
    expect(formatIndicatorValue(pct, undefined)).toBe("—");
    expect(formatIndicatorValue(pct, NaN)).toBe("—");
  });

  it("최근 값·직전 대비 변화·구간 자르기", () => {
    const p = [
      { date: "2026-06-01", value: 1 },
      { date: "2026-07-01", value: 3 },
    ];
    expect(latestPoint(p)?.value).toBe(3);
    expect(changeFromPrevious(p)).toBe(2);
    expect(latestPoint([])).toBeUndefined();
    // 점이 하나뿐이면 변화는 '없음'이지 0이 아니다.
    expect(changeFromPrevious([p[0]])).toBeUndefined();
    expect(tailPoints(p, 1)).toEqual([p[1]]);
    expect(tailPoints(p, 9)).toEqual(p);
  });
});

describe("차트 기준선", () => {
  it("판정 규칙이 있으면 경고선을 긋는다", () => {
    expect(chartBaseline({ transform: "level", signal: { alert: 50 } })).toEqual({
      value: 50,
      label: "50 = 경고선",
    });
  });

  it("변화율 지표는 0을 긋는다 — 플러스인지 마이너스인지가 그림에서 보여야 한다", () => {
    expect(chartBaseline({ transform: "yoy" })?.label).toBe("0 = 작년과 같음");
    expect(chartBaseline({ transform: "momdiff" })?.value).toBe(0);
  });

  it("⚠ 원값 지표에는 기준선을 긋지 않는다 — 없는 의미를 만들지 않는다", () => {
    expect(chartBaseline({ transform: "level" })).toBeUndefined();
  });
});

describe("침체 시그널 판정", () => {
  const inversion = { op: "lt" as const, warn: 0.2, alert: 0, rule: "0 아래면 역전" };
  const vix = { op: "gt" as const, warn: 20, alert: 30, rule: "20 경계 · 30 공포" };

  it("낮을수록 위험한 지표(금리차)", () => {
    expect(judgeSignal(inversion, 0.5)).toBe("normal");
    expect(judgeSignal(inversion, 0.1)).toBe("watch");
    expect(judgeSignal(inversion, -0.2)).toBe("alert");
  });

  it("높을수록 위험한 지표(VIX)", () => {
    expect(judgeSignal(vix, 15)).toBe("normal");
    expect(judgeSignal(vix, 24)).toBe("watch");
    expect(judgeSignal(vix, 35)).toBe("alert");
  });

  it("⚠ 값을 못 읽으면 '정상'이 아니라 '미수집'이다", () => {
    expect(judgeSignal(vix, undefined)).toBe("unknown");
    expect(judgeSignal(undefined, 10)).toBe("unknown");
  });

  it("경고 2개부터 '경계' — 하나만으로 등급을 올리지 않는다", () => {
    const two: SignalStatus[] = ["alert", "alert", "normal", "normal", "normal"];
    expect(summarizeRecession(two).level).toBe("caution");

    const one: SignalStatus[] = ["alert", "normal", "normal", "normal", "normal"];
    expect(summarizeRecession(one).level).toBe("watch");
  });

  it("경고 3개 이상이면 '위험'", () => {
    expect(
      summarizeRecession(["alert", "alert", "alert", "watch", "normal"]).level,
    ).toBe("danger");
  });

  it("모두 기준선 안쪽이면 '안정'", () => {
    const s = summarizeRecession(["normal", "normal", "normal", "normal", "normal"]);
    expect(s.level).toBe("calm");
    expect(s.line).toContain("신호는 없습니다");
  });

  it("⚠ 못 읽은 지표가 있으면 문장에 밝힌다 — 판정에서 빠진 걸 감추지 않는다", () => {
    const s = summarizeRecession(["normal", "normal", "unknown", "normal", "normal"]);
    expect(s.unknowns).toBe(1);
    expect(s.line).toContain("읽지 못해");
  });

  it("하나도 못 읽었으면 등급 자체를 내지 않는다", () => {
    const s = summarizeRecession(["unknown", "unknown"]);
    expect(s.level).toBe("unknown");
    expect(s.label).toBe("미수집");
  });
});

describe("한국은행 ECOS 응답", () => {
  const ok = {
    StatisticSearch: {
      row: [
        { TIME: "202601", DATA_VALUE: "2.5" },
        { TIME: "202602", DATA_VALUE: "2.25" },
      ],
    },
  };

  it("월간 응답을 그 달 1일로 읽는다", () => {
    expect(parseEcosJson(ok)).toEqual([
      { date: "2026-01-01", value: 2.5 },
      { date: "2026-02-01", value: 2.25 },
    ]);
  });

  /**
   * ⚠ ECOS는 **인증키가 틀려도 HTTP 200**으로 답한다. 빈 배열로 넘기면
   *    "받을 값이 없었다"와 구분이 안 되고, 수집 이력에는 아무 이유도 안 남는다.
   */
  it("⚠ 오류 응답(200)은 던진다 — 조용히 빈 목록이 되지 않는다", () => {
    expect(() =>
      parseEcosJson({ RESULT: { CODE: "INFO-100", MESSAGE: "인증키가 유효하지 않습니다" } }),
    ).toThrow(/인증키/);
  });

  it("값이 비어 있는 행은 버린다 — 0으로 채우면 기준금리 0%가 된다", () => {
    const out = parseEcosJson({
      StatisticSearch: { row: [{ TIME: "202601", DATA_VALUE: "" }, { TIME: "202602", DATA_VALUE: "2.25" }] },
    });
    expect(out).toEqual([{ date: "2026-02-01", value: 2.25 }]);
  });

  it("일간·연간 표기도 읽는다", () => {
    const out = parseEcosJson({
      StatisticSearch: { row: [{ TIME: "20260105", DATA_VALUE: "1" }, { TIME: "2026", DATA_VALUE: "2" }] },
    });
    expect(out.map((p) => p.date)).toEqual(["2026-01-05", "2026-01-01"]);
  });
});

describe("네이버 금융 응답", () => {
  const json = {
    totalInfos: [
      { code: "per", key: "PER", value: "7.34배" },
      { code: "estimatePer", key: "추정PER", value: "4.71배" },
      { code: "marketValue", key: "시총", value: "1,203조 1,209억" },
    ],
  };

  it("고른 항목의 숫자만 뽑는다", () => {
    expect(parseNaverTotalInfo(json, "추정PER", "2026-09-05")).toEqual([
      { date: "2026-09-05", value: 4.71 },
    ]);
  });

  /** ⚠ 항목 이름이 바뀌면 조용히 다른 숫자를 가져오지 않고 실패해야 한다. */
  it("⚠ 없는 항목이면 던진다 — 엉뚱한 값을 대신 넣지 않는다", () => {
    expect(() => parseNaverTotalInfo(json, "선행PER", "2026-09-05")).toThrow(/없습니다/);
  });

  /** ⚠ PER 0배는 「싸다」가 아니라 「모른다」다. */
  it("⚠ 숫자로 읽히지 않거나 0 이하면 던진다", () => {
    const bad = { totalInfos: [{ key: "추정PER", value: "N/A" }] };
    expect(() => parseNaverTotalInfo(bad, "추정PER", "2026-09-05")).toThrow();
  });
});

describe("외부 응답 파서", () => {
  it("FRED CSV를 읽는다", () => {
    const csv = [
      "observation_date,T10Y2Y",
      "2026-07-01,0.31",
      "2026-07-02,0.35",
      "",
    ].join("\n");
    expect(parseFredCsv(csv)).toEqual([
      { date: "2026-07-01", value: 0.31 },
      { date: "2026-07-02", value: 0.35 },
    ]);
  });

  it("⚠ 결측(.)은 버린다 — 0으로 넣으면 휴장일이 폭락으로 보인다", () => {
    const csv = "observation_date,X\n2026-07-03,.\n2026-07-06,0.35";
    expect(parseFredCsv(csv)).toEqual([{ date: "2026-07-06", value: 0.35 }]);
  });

  it("머리글·잡음 줄은 건너뛴다", () => {
    expect(parseFredCsv("observation_date,X\nnot-a-date,1\n")).toEqual([]);
    expect(parseFredCsv("")).toEqual([]);
  });

  it("Yahoo 차트 응답을 읽고 휴장일(null)을 버린다", () => {
    const json = {
      chart: {
        result: [
          {
            timestamp: [1767225600, 1767312000],
            indicators: { quote: [{ close: [120.5, null] }] },
          },
        ],
      },
    };
    const out = parseYahooChart(json);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(120.5);
    expect(out[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Yahoo 응답이 예상과 다르면 빈 배열 — 던지지 않는다(호출부가 실패를 기록한다)", () => {
    expect(parseYahooChart({})).toEqual([]);
    expect(parseYahooChart(null)).toEqual([]);
  });

  it("같은 날짜가 두 번 오면 나중 값(수정치)을 남긴다", () => {
    const out = dedupeByDate([
      { date: "2026-07-01", value: 1 },
      { date: "2026-06-01", value: 9 },
      { date: "2026-07-01", value: 2 },
    ]);
    expect(out).toEqual([
      { date: "2026-06-01", value: 9 },
      { date: "2026-07-01", value: 2 },
    ]);
  });
});

describe("단위와 변환이 맞물리는가", () => {
  // 2026-08-07 점검: FRED가 이미 천 단위로 주는 지표에 levelK(÷1000)를 걸어
  // 주택착공이 화면에 "1천호"(실제 142.7만호)로 나왔다. 원값 규모를 근거로 고정한다.
  const byKey = new Map(MACRO_INDICATORS.map((i) => [i.key, i]));

  it("⚠ FRED가 천 단위로 주는 지표에는 levelK를 걸지 않는다", () => {
    // HOUST 1427(천호) · JTSJOL 7359(천건) — 나누면 한 자리 수가 되어 버린다
    expect(byKey.get("houst")?.transform).toBe("level");
    expect(byKey.get("jolts")?.transform).toBe("level");
  });

  it("실제 건수로 주는 지표에는 levelK가 맞다", () => {
    // ICSA는 199000(건) → 199천건
    expect(byKey.get("claims")?.transform).toBe("levelK");
  });
});

describe("설명글의 강조 표시", () => {
  it("⚠ 별표가 화면에 그대로 찍히지 않는다 — 초보자용 문장에서 강조가 방해가 됐다", () => {
    expect(splitEmphasis("절대 수준보다 **방향**을 봅니다.")).toEqual([
      { text: "절대 수준보다 ", strong: false },
      { text: "방향", strong: true },
      { text: "을 봅니다.", strong: false },
    ]);
  });

  it("강조가 없으면 통째로 한 조각", () => {
    expect(splitEmphasis("그냥 문장")).toEqual([{ text: "그냥 문장", strong: false }]);
  });

  it("짝이 안 맞는 별표는 그대로 둔다 — 없는 강조를 만들지 않는다", () => {
    expect(splitEmphasis("**열기만 함")).toEqual([{ text: "**열기만 함", strong: false }]);
  });

  it("카탈로그 설명에 남은 별표가 모두 짝이 맞는다", () => {
    for (const i of MACRO_INDICATORS) {
      for (const field of [i.what, i.why, i.read]) {
        expect((field.match(/\*\*/g) ?? []).length % 2, `${i.key}: ${field}`).toBe(0);
      }
    }
  });
});
