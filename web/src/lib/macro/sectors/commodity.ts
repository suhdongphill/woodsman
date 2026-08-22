/**
 * 원자재 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "commodity",
      name: "원자재",
      emoji: "🛢️",
      question: "만드는 비용이 오르고 있나?",
      intro:
        "원유·구리·천연가스는 거의 모든 물건의 원가에 들어갑니다. 값이 오르면 시차를 두고 물가로 옮겨붙고, 기업의 이익률을 깎습니다. 구리는 쓰임새가 워낙 넓어 '경기 박사(Dr. Copper)'라고 불릴 만큼 경기를 앞서 보여줍니다.",
      order: 6,
    },
  indicators: [
    {
      key: "wti",
      name: "WTI 유가",
      group: "commodity",
      source: "FRED",
      sourceId: "DCOILWTICO",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "$",
      decimals: 2,
      url: FRED("DCOILWTICO"),
      sourceLabel: "FRED · DCOILWTICO",
      what: "미국 서부 텍사스산 원유 가격입니다(배럴당 달러).",
      why: "유가는 물가의 출발점이자 경기 수요의 온도계입니다. 오르면 물가가, 급락하면 수요가 걱정됩니다.",
      read: "오르는 이유를 함께 봅니다. 수요가 좋아서 오르면 경기 신호, 공급 사고로 오르면 비용 충격입니다.",
      order: 1,
    },
    {
      key: "brent",
      name: "브렌트유",
      group: "commodity",
      source: "FRED",
      sourceId: "DCOILBRENTEU",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "$",
      decimals: 2,
      url: FRED("DCOILBRENTEU"),
      sourceLabel: "FRED · DCOILBRENTEU",
      what: "북해산 원유 가격으로, 국제 유가의 기준으로 더 널리 쓰입니다.",
      why: "한국이 수입하는 원유 가격에 더 가깝습니다.",
      read: "WTI와의 차이가 벌어지면 지역별 공급 사정이 다르다는 뜻입니다.",
      order: 2,
    },
    {
      key: "natgas",
      name: "천연가스 (헨리허브)",
      group: "commodity",
      source: "FRED",
      sourceId: "DHHNGSP",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "$",
      decimals: 2,
      url: FRED("DHHNGSP"),
      sourceLabel: "FRED · DHHNGSP",
      what: "미국 천연가스 기준 가격입니다.",
      why: "전기·난방·화학의 원가입니다. 최근에는 데이터센터 전력 수요와도 엮입니다.",
      read: "계절성이 매우 큽니다. 작년 같은 달과 비교해서 봅니다.",
      order: 3,
    },
    {
      key: "gold",
      /**
       * ⚠ 이름이 「현물」에서 「COMEX 최근월」로 바뀌었다(2026-08-22).
       *   무료로 받을 수 있는 현물 시세가 없어 **선물 최근월물**을 쓰는데,
       *   라벨은 '현물'인데 값은 선물인 상태가 이 사이트가 막으려는 바로 그 조용한 오류다.
       *   값을 바꿀 수 없으면 **이름을 값에 맞춘다.** (볼트 §6-4와 같은 결정)
       */
      name: "금 (COMEX 최근월)",
      group: "commodity",
      source: "YAHOO",
      sourceId: "GC=F",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "$",
      decimals: 2,
      url: "https://finance.yahoo.com/quote/GC=F/",
      sourceLabel: "Yahoo Finance · GC=F (COMEX 선물)",
      what: "금 1온스의 달러 가격입니다. ⚠ 현물이 아니라 COMEX 최근월 선물 가격이라, 현물 시세와 몇 달러 차이가 납니다.",
      why: "이자를 주지 않는 자산이라, 실질금리가 낮아지고 통화 가치가 의심받을 때 오릅니다.",
      read: "주식과 금이 같이 오르는 구간은 '유동성이 풀렸다'는 신호로, 금만 오르면 '위험을 피하고 있다'는 신호로 읽습니다.",
      order: 4,
    },
    {
      key: "copper",
      name: "구리 (Dr. Copper)",
      group: "commodity",
      source: "FRED",
      sourceId: "PCOPPUSDM",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "m",
      unit: "$/t",
      decimals: 0,
      url: FRED("PCOPPUSDM"),
      sourceLabel: "FRED · PCOPPUSDM",
      what: "구리 1톤의 국제 가격입니다.",
      why: "전선·건설·전기차까지 안 쓰이는 데가 없어, 경기를 앞서 보여준다고 해서 '구리 박사'라 부릅니다.",
      read: "구리가 먼저 꺾이면 제조업 지표가 뒤따라 꺾이는 경우가 많습니다.",
      order: 5,
    },
  ],
};
