/**
 * 소비·심리 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "consumer",
      name: "소비·심리",
      emoji: "🛒",
      question: "사람들이 지갑을 열고 있나?",
      intro:
        "미국 경제의 3분의 2는 소비입니다. 실제로 쓴 돈(소매판매)과 앞으로 쓸 마음(소비자신뢰)을 같이 보면, 지금 버티는 중인지 곧 꺾일지가 갈립니다. 심리 지표는 실제 소비보다 먼저 움직입니다.",
      order: 6,
    },
  indicators: [
    {
      key: "retail_mom",
      name: "소매판매 (전월비)",
      group: "consumer",
      source: "FRED",
      sourceId: "RSAFS",
      transform: "mom",
      unit: "%",
      decimals: 1,
      url: FRED("RSAFS"),
      sourceLabel: "FRED · RSAFS",
      what: "미국 소매점 매출이 지난달보다 얼마나 늘었는지입니다.",
      why: "말이 아니라 실제로 쓴 돈입니다. 미국 경제의 3분의 2가 소비입니다.",
      read: "물가 상승분이 빠지지 않은 숫자라, 물가와 같이 봐야 '진짜 더 산 것'인지 알 수 있습니다.",
      order: 1,
    },
    {
      key: "cci",
      name: "소비자신뢰지수 (CCI)",
      group: "consumer",
      source: "MANUAL",
      transform: "level",
      unit: "",
      decimals: 1,
      url: "https://www.conference-board.org/topics/consumer-confidence",
      sourceLabel: "수동 입력 · 컨퍼런스보드",
      what: "미국 소비자에게 지금 형편과 앞으로 6개월을 직접 물어 만든 지수입니다(1985년=100).",
      why: "지갑을 열 마음이 실제 소비보다 먼저 식습니다. 기대지수가 80 밑으로 내려가면 컨퍼런스보드가 침체 경계로 보는 수준입니다.",
      read: "현재 여건은 버티는데 기대만 무너지는 모습이 경기 전환 앞에서 자주 나옵니다.",
      order: 2,
    },
    {
      key: "umcsent",
      name: "미시간대 소비심리",
      group: "consumer",
      source: "FRED",
      sourceId: "UMCSENT",
      transform: "level",
      unit: "",
      decimals: 1,
      url: FRED("UMCSENT"),
      sourceLabel: "FRED · UMCSENT",
      what: "미시간대가 조사하는 또 하나의 소비심리 지수입니다.",
      why: "컨퍼런스보드는 고용을, 미시간대는 물가와 가계 형편을 더 크게 반영합니다. 둘을 같이 보면 원인이 갈립니다.",
      read: "두 지수가 엇갈리면 '일자리는 있는데 물가가 힘들다' 같은 상황을 뜻합니다.",
      order: 3,
    },
  ],
};
