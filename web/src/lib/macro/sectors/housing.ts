/**
 * 부동산 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "housing",
      name: "부동산",
      emoji: "🏠",
      question: "금리가 실물에 얼마나 닿았나?",
      intro:
        "주택은 금리에 가장 민감한 실물 자산입니다. 금리가 오르면 착공과 건설업체 체감경기가 먼저 식고, 그 다음에 고용과 소비로 번집니다. 그래서 부동산 지표는 '긴축이 실제로 아프기 시작했는지'를 보는 창입니다.",
      order: 8,
    },
  indicators: [
    {
      key: "houst",
      name: "주택착공",
      group: "housing",
      source: "FRED",
      sourceId: "HOUST",
      // ⚠ FRED HOUST는 **이미 천호 단위**다(2026-06 = 1427 → 142.7만호).
      //    levelK로 한 번 더 나누면 화면에 "1천호"로 나온다 — 2026-08-07 점검에서 잡혔다.
      transform: "level",
      unit: "천호",
      decimals: 0,
      url: FRED("HOUST"),
      sourceLabel: "FRED · HOUST",
      what: "새로 짓기 시작한 주택 수입니다(연율 환산).",
      why: "주택은 금리에 가장 먼저 반응하는 실물입니다. 착공이 줄면 건설 고용과 자재 수요가 따라 줄어듭니다.",
      read: "금리가 오른 뒤 몇 달 지나 꺾이는 것이 보통입니다. 긴축이 실물에 닿았는지 보는 창입니다.",
      order: 1,
    },
    {
      key: "case_shiller_yoy",
      name: "케이스-실러 주택가격 (전년비)",
      group: "housing",
      source: "FRED",
      sourceId: "CSUSHPINSA",
      transform: "yoy",
      unit: "%",
      decimals: 1,
      url: FRED("CSUSHPINSA"),
      sourceLabel: "FRED · CSUSHPINSA",
      what: "미국 주택 가격이 1년 전보다 얼마나 올랐는지입니다.",
      why: "집값이 오르면 소비가 늘고(자산효과), 임대료를 통해 물가에도 반영됩니다.",
      read: "발표가 두 달가량 늦습니다. 지금이 아니라 두 달 전 상황으로 읽어야 합니다.",
      order: 2,
    },
    {
      key: "nahb",
      name: "NAHB 주택시장지수",
      group: "housing",
      source: "MANUAL",
      transform: "level",
      unit: "",
      decimals: 0,
      url: "https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index",
      sourceLabel: "수동 입력 · NAHB",
      what: "주택 건설업체들이 느끼는 체감 경기입니다. 50이 기준선입니다.",
      why: "실제 착공보다 먼저 움직입니다. 짓는 사람들이 먼저 몸을 사립니다.",
      read: "50 아래가 길게 이어지면 앞으로의 착공과 건설 고용이 줄어든다는 예고입니다.",
      order: 3,
    },
  ],
};
