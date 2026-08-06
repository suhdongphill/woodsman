/**
 * 환율 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "fx",
      name: "환율",
      emoji: "💵",
      question: "원화와 달러의 힘겨루기는 어떤가?",
      intro:
        "한국에서 투자한다면 환율은 수익률의 일부입니다. 원/달러가 오르면(원화 약세) 달러 자산의 원화 환산 수익은 늘지만 수입 물가가 오르고 외국인 자금은 빠져나가기 쉽습니다. 달러인덱스는 달러 자체의 강도를 봅니다.",
      order: 4,
    },
  indicators: [
    {
      key: "usdkrw",
      name: "원/달러 환율",
      group: "fx",
      source: "FRED",
      sourceId: "DEXKOUS",
      transform: "level",
      unit: "원",
      decimals: 1,
      url: FRED("DEXKOUS"),
      sourceLabel: "FRED · DEXKOUS",
      what: "1달러를 사는 데 필요한 원화입니다.",
      why: "한국에서 투자하면 환율이 수익률의 일부가 됩니다. 달러 자산은 환율이 오를 때 원화 환산 수익이 함께 늘어납니다.",
      read: "오르면 원화 약세입니다. 수입 물가가 오르고 외국인 자금이 빠져나가기 쉬운 환경이 됩니다.",
      headline: true,
      order: 1,
    },
    {
      key: "dxy",
      name: "달러인덱스 (DXY)",
      group: "fx",
      source: "MANUAL",
      transform: "level",
      unit: "",
      decimals: 2,
      url: "https://kr.investing.com/currencies/us-dollar-index",
      sourceLabel: "수동 입력 · Investing.com",
      what: "유로·엔 등 주요 6개 통화 대비 달러의 종합 강도입니다.",
      why: "달러가 세지면 원자재와 신흥국 자산이 동시에 눌립니다. 위험자산 전반의 역풍 게이지입니다.",
      read: "원/달러가 올랐을 때 DXY도 올랐다면 달러가 센 것이고, DXY는 그대로인데 원화만 약하면 국내 요인입니다.",
      order: 2,
    },
    {
      key: "usdjpy",
      name: "엔/달러 환율",
      group: "fx",
      source: "FRED",
      sourceId: "DEXJPUS",
      transform: "level",
      unit: "엔",
      decimals: 1,
      url: FRED("DEXJPUS"),
      sourceLabel: "FRED · DEXJPUS",
      what: "1달러를 사는 데 필요한 엔화입니다.",
      why: "싼 엔화를 빌려 다른 자산에 투자하는 '엔 캐리'가 세계 유동성의 한 축이라, 급변하면 시장 전체가 흔들립니다.",
      read: "엔이 급하게 강해지면(숫자가 급락하면) 캐리 자금이 되돌아오며 위험자산이 함께 흔들리는 일이 있었습니다.",
      order: 3,
    },
    {
      key: "usdcny",
      name: "위안/달러 환율",
      group: "fx",
      source: "FRED",
      sourceId: "DEXCHUS",
      transform: "level",
      unit: "위안",
      decimals: 2,
      url: FRED("DEXCHUS"),
      sourceLabel: "FRED · DEXCHUS",
      what: "1달러를 사는 데 필요한 위안화입니다.",
      why: "중국 경기와 수출 경쟁력의 신호이고, 원화는 위안화를 따라 움직이는 경향이 있습니다.",
      read: "위안 약세가 이어지면 원화도 같이 눌리는 국면이 많습니다.",
      order: 4,
    },
  ],
};
