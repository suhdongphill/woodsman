/**
 * 주도주 섹터 — **돈이 지금 어디로 흐르고 있나.**
 *
 * ⚠ 이 묶음은 거시 지표가 아니라 **시장 가격 계열**이다(섹터 ETF).
 *    그래서 침체 신호 판정에 쓰지 않는다 — 신호 규칙(`signal`)을 붙이지 않았다.
 *    같은 표에 두는 이유는 **수집 경로를 재사용**하기 위해서다. 새 수집기를 또 만들면
 *    "야후에서 받아 저장한다"는 같은 판단이 두 곳에 생긴다.
 *
 * ⚠ **"자금 유입"이라고 부르지 않는다.** 진짜 자금유입은 설정주식수·AUM 변화인데
 *    무료로 신뢰성 있게 얻을 길이 없다. 여기서 재는 것은 **가격이 만든 결과**다 —
 *    상대강도와 52주 위치. 이름을 정확히 붙이는 것이 이 사이트의 규칙이다.
 *
 * 판단(52주 위치·상대강도·주도 여부)은 `src/lib/sector-strength.ts`가 한다.
 */
import type { MacroSector } from "../types";

/** Yahoo 종목 페이지. 지표마다 손으로 적지 않는다. */
const Y = (symbol: string) => `https://finance.yahoo.com/quote/${symbol}/`;

type EtfSpec = {
  key: string;
  symbol: string;
  name: string;
  what: string;
  why: string;
  read: string;
};

/**
 * SPDR 섹터 ETF 11종 + 시장 기준(SPY).
 * ⚠ 키는 **바꾸지 않는다** — 바꾸면 쌓아 둔 시계열이 통째로 끊긴다.
 */
const ETFS: EtfSpec[] = [
  {
    key: "spx_etf",
    symbol: "SPY",
    name: "S&P 500 (기준)",
    what: "미국 대형주 500종목을 담은 ETF입니다. 여기서는 **비교 기준**으로 씁니다.",
    why: "어떤 섹터가 '강하다'는 말은 언제나 시장 대비입니다. 기준이 없으면 강약을 말할 수 없습니다.",
    read: "섹터가 이것보다 더 올랐으면 돈이 그쪽으로 더 갔다는 뜻입니다.",
  },
  {
    key: "sector_tech",
    symbol: "XLK",
    name: "기술",
    what: "애플·마이크로소프트·엔비디아 등 기술 섹터 ETF입니다.",
    why: "금리와 유동성에 가장 민감한 섹터입니다. 완화 기대가 살아나면 먼저 반응합니다.",
    read: "금리가 내려가는데 기술이 안 오르면, 실적 쪽에 다른 문제가 있다는 신호입니다.",
  },
  {
    key: "sector_semi",
    symbol: "SMH",
    name: "반도체",
    what: "반도체 설계·제조 기업을 담은 ETF입니다.",
    why: "한국 증시와 가장 함께 움직이는 계열입니다. 사이클의 앞머리에 섭니다.",
    read: "반도체가 기술 전체보다 앞서면 사이클이 살아 있다는 뜻입니다.",
  },
  {
    key: "sector_fin",
    symbol: "XLF",
    name: "금융",
    what: "은행·보험·자산운용 섹터 ETF입니다.",
    why: "장단기 금리차가 벌어지면 은행 수익이 좋아집니다. 금리 구조가 그대로 실적이 됩니다.",
    read: "금리차가 벌어지는데 금융이 안 오르면 신용 쪽을 의심합니다.",
  },
  {
    key: "sector_energy",
    symbol: "XLE",
    name: "에너지",
    what: "원유·가스 생산과 정제 기업 섹터 ETF입니다.",
    why: "유가와 함께 움직이고, 물가의 원인이자 결과입니다.",
    read: "유가는 그대로인데 에너지가 오르면 공급 쪽 기대가 바뀐 것입니다.",
  },
  {
    key: "sector_health",
    symbol: "XLV",
    name: "헬스케어",
    what: "제약·의료기기·보험 섹터 ETF입니다.",
    why: "경기와 덜 엮여서, 방어적으로 옮겨 갈 때 먼저 오릅니다.",
    read: "헬스케어와 필수소비재가 같이 오르면 시장이 방어로 돌아섰다는 뜻입니다.",
  },
  {
    key: "sector_indu",
    symbol: "XLI",
    name: "산업재",
    what: "기계·항공·운송 섹터 ETF입니다.",
    why: "실물 경기의 체온계입니다. 설비투자와 물류가 여기 담깁니다.",
    read: "산업재가 시장을 앞서면 경기 기대가 살아 있다는 신호입니다.",
  },
  {
    key: "sector_disc",
    symbol: "XLY",
    name: "경기소비재",
    what: "자동차·여행·의류 등 **선택**해서 사는 소비 섹터입니다.",
    why: "소비 여력이 줄면 가장 먼저 미뤄지는 지출입니다.",
    read: "경기소비재가 필수소비재보다 앞서면 소비가 아직 버티고 있다는 뜻입니다.",
  },
  {
    key: "sector_staples",
    symbol: "XLP",
    name: "필수소비재",
    what: "식품·생활용품 등 **줄이기 어려운** 소비 섹터입니다.",
    why: "경기와 무관하게 팔려서 하락장에서 상대적으로 버팁니다.",
    read: "이쪽이 시장을 앞서기 시작하면 방어로 돈이 옮겨 가고 있는 것입니다.",
  },
  {
    key: "sector_util",
    symbol: "XLU",
    name: "유틸리티",
    what: "전력·가스 등 공익 사업 섹터 ETF입니다.",
    why: "배당이 크고 금리에 민감합니다. 요즘은 데이터센터 전력 수요까지 얹혔습니다.",
    read: "금리가 내려갈 때 오르는 것이 보통인데, 전력 수요 때문에 같이 오르는 국면도 있습니다.",
  },
  {
    key: "sector_mat",
    symbol: "XLB",
    name: "소재",
    what: "화학·금속·건자재 섹터 ETF입니다.",
    why: "원자재 가격과 중국 수요를 함께 반영합니다.",
    read: "구리·유가와 같이 보면 수요 때문인지 공급 때문인지 갈립니다.",
  },
  {
    key: "sector_reit",
    symbol: "XLRE",
    name: "리츠·부동산",
    what: "상업용 부동산 리츠 섹터 ETF입니다.",
    why: "금리에 가장 직접적으로 눌리고 풀립니다.",
    read: "금리가 내려가는데 리츠가 안 오르면 공실·신용 쪽 문제를 의심합니다.",
  },
  {
    key: "sector_comm",
    symbol: "XLC",
    name: "커뮤니케이션",
    what: "구글·메타 등 미디어·통신 섹터 ETF입니다.",
    why: "광고 경기가 여기 담깁니다. 소비와 기업 지출을 함께 비춥니다.",
    read: "광고 매출이 꺾이면 여기가 먼저 반응합니다.",
  },
];

export const sector: MacroSector = {
  group: {
    key: "leaders",
    name: "주도주 섹터",
    emoji: "🌊",
    question: "지금 돈은 어느 섹터로 흐르고 있나?",
    intro:
      "바람과 조류를 읽었다면, 파도가 어디서 일고 있는지도 보입니다. 섹터 ETF의 **52주 신고가 대비 위치**와 **시장 대비 상대강도**로 어느 쪽이 앞서고 있는지 봅니다. ⚠ 이것은 자금 유입 통계가 아니라 **가격이 만든 결과**입니다 — 설정주식수·AUM 자료가 아니므로 그렇게 부르지 않습니다.",
    order: 11,
  },
  indicators: ETFS.map((etf, i) => ({
    key: etf.key,
    name: etf.name,
    group: "leaders" as const,
    source: "YAHOO" as const,
    sourceId: etf.symbol,
    transform: "level" as const,
    /** L6 — 가격은 메커니즘의 끝단이다(시간 선행 주장이 아니다). */
    layer: "L6" as const,
    type: "level" as const,
    freq: "d" as const,
    unit: "",
    decimals: 2,
    url: Y(etf.symbol),
    sourceLabel: `Yahoo Finance · ${etf.symbol}`,
    what: etf.what,
    why: etf.why,
    read: etf.read,
    order: i + 1,
  })),
};
