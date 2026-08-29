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
      order: 7,
    },
  indicators: [
    {
      key: "retail_mom",
      name: "소매판매 (전월비)",
      group: "consumer",
      source: "FRED",
      sourceId: "RSAFS",
      transform: "mom",
      layer: "L3",
      type: "change",
      freq: "m",
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
      layer: "L6",
      type: "level",
      freq: "m",
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
      layer: "L6",
      type: "level",
      freq: "m",
      /**
       * ⚠ 2026-08-26. 기본 월간 기한(75일)으로 재면 「기한초과」가 **영원히 켜져 있다** —
       *   더 새 값이 존재하지 않는데도 그렇다. 상시 켜진 경고는 경고가 아니고,
       *   **진짜 낡은 지표가 같은 회색에 묻힌다**(freshness.ts §1-7).
       *   ⚠ 다만 예외만 주면 독자가 두 달 전 값을 오늘 값으로 읽는다. `staleWhy`는
       *   코드에만 있고 화면에 안 나오므로, **딱지가 하던 말은 아래 `read`로 옮겼다.**
       *   ⚠ 근본 해법은 미시간대 원발표를 직접 받는 수집 경로다(FRED가 아니라 어댑터 필요).
       *   그것을 만들면 이 예외는 지우는 것이 맞다.
       *   일수와 근거 문장은 볼트 `_scripts/sectors/macro.json`과 **같게** 쓴다(두 화면 대조용).
       */
      staleDays: 105,
      staleWhy:
        "미시간대 원발표는 당월이지만 **FRED 반영이 2개월가량 늦다**(2026-08 점검에서 직접 확인). 원발표를 쓰려면 수집 경로부터 바꿔야 하므로, 지금은 FRED 반영 주기로 잰다.",
      unit: "",
      decimals: 1,
      url: FRED("UMCSENT"),
      sourceLabel: "FRED · UMCSENT",
      what: "미시간대가 조사하는 또 하나의 소비심리 지수입니다.",
      why: "컨퍼런스보드는 고용을, 미시간대는 물가와 가계 형편을 더 크게 반영합니다. 둘을 같이 보면 원인이 갈립니다.",
      read: "두 지수가 엇갈리면 '일자리는 있는데 물가가 힘들다' 같은 상황을 뜻합니다. ⚠ 기준일을 꼭 같이 보세요 — 이 숫자는 미시간대가 매달 내는 원발표가 아니라 **FRED에 반영된 값이라 구조적으로 두 달가량 뒤집니다.** 오늘의 심리가 아니라 **두 달 전 조사 결과**로 읽으셔야 합니다.",
      order: 3,
    },
  ],
};
