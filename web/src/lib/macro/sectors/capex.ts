/**
 * 투자·자본형성 섹터 — **기업이 미래 생산능력에 돈을 쓰고 있나**. Capital Regime Engine R2b-1 (2026-09-14).
 *
 * ## 왜 따로 세웠나
 * 명세 §9 Productive Capital Formation과 §33 Capital Engine의 가장 큰 축(20%)이다. 「AI CAPEX가 실제로 일어나고 있나」는
 * 생산·제조(공장이 돌아가나)나 생산성·공급(한 시간에 얼마를 더 만드나)과 **다른 질문**이다 — 돈을 쓴 것과 산출이 는 것은 다른 숫자다.
 *
 * ## ⚠ 이 묶음에서 조심할 것
 * - ⚠ **명목**이다. 장비 가격이 오르면 같은 양을 사도 늘어 보인다.
 * - ⚠ **총액(PNFI) 안에 장비·지식재산이 들어 있다.** 명세 §9는 셋을 따로 가중하는데, 그러면 같은 돈이 겹쳐 세어진다(설계서 11-4).
 * - ⚠ 데이터센터 투자·반도체 fab·전력 인프라·R&D 단독 계열은 아직 없다 — 데이터센터는 인구조사국 건설지출 확인이 필요하다.
 * - 투자를 생산성으로 계산하지 않는다(설계서 자본 엔진 원칙).
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
    key: "capex",
    name: "투자·자본형성",
    emoji: "🏗️",
    question: "기업이 미래 생산능력에 돈을 쓰고 있나?",
    intro:
      "AI 붐이 말뿐인지 실제 투자인지는 여기서 갈립니다. 기업이 공장·장비·소프트웨어·연구개발에 쓰는 돈이 늘어야 몇 년 뒤 공급능력이 커지고, 그래야 수요를 죽이지 않고 물가를 잡을 여지가 생깁니다. ⚠ 다만 **돈을 쓴 것과 생산성이 오른 것은 다른 숫자**입니다 — 투자가 늘어도 가동률이 낮거나 수익이 따라오지 않으면 오히려 과잉투자의 신호일 수 있습니다. 생산성·공급 묶음과 함께 보세요.",
    order: 11,
  },
  indicators: [
    {
      // 십억 달러 연율 수준 계열(분기). 전년비는 읽을 때 계산한다.
      key: "pnfi_yoy",
      name: "민간 비주거 고정투자 (전년비)",
      group: "capex",
      source: "FRED",
      sourceId: "PNFI",
      transform: "yoy",
      layer: "L3",
      type: "change",
      freq: "q",
      unit: "%",
      decimals: 1,
      url: FRED("PNFI"),
      sourceLabel: "FRED · PNFI (원 발표: 미 경제분석국 BEA 국민계정)",
      what: "기업이 공장·장비·소프트웨어·연구개발 같은 **미래 생산능력**에 쓴 돈의 총액이 1년 전보다 얼마나 늘었는지입니다(명목).",
      why: "⭐ 자본 엔진의 연료입니다. AI 붐이 실제 투자로 이어지고 있는지를 가장 넓게 보여 줍니다. 명세 Productive Capital Formation의 「Business Fixed Investment」 자리입니다.",
      read: "⚠ **명목**입니다 — 장비 가격이 오르면 같은 양을 사도 늘어 보입니다. 그리고 ⚠ 아래 장비·지식재산 투자는 **이 총액 안에 들어 있는 구성요소**라, 셋을 함께 더하면 같은 돈을 두 번 세게 됩니다.",
      order: 1,
    },
    {
      // 십억 달러 연율 수준 계열(분기). 전년비는 읽을 때 계산한다.
      key: "equipment_inv_yoy",
      name: "장비 투자 (전년비)",
      group: "capex",
      source: "FRED",
      sourceId: "Y033RC1Q027SBEA",
      transform: "yoy",
      layer: "L3",
      type: "change",
      freq: "q",
      unit: "%",
      decimals: 1,
      url: FRED("Y033RC1Q027SBEA"),
      sourceLabel: "FRED · Y033RC1Q027SBEA (원 발표: 미 경제분석국 BEA)",
      what: "기업이 산 기계·컴퓨터·서버·운송장비 같은 **장비**에 쓴 돈이 1년 전보다 얼마나 늘었는지입니다(명목).",
      why: "데이터센터의 서버·네트워크 장비가 여기에 잡힙니다. AI 투자가 **건물보다 먼저** 드러나는 자리입니다.",
      read: "⚠ 수입 장비도 들어갑니다 — 투자가 늘어도 그만큼 수입이 늘면 국내 생산으로 이어지지 않습니다. 비주거 고정투자(총액)의 구성요소입니다.",
      order: 2,
    },
    {
      // 십억 달러 연율 수준 계열(분기). 전년비는 읽을 때 계산한다.
      key: "ip_inv_yoy",
      name: "지식재산 투자 (전년비)",
      group: "capex",
      source: "FRED",
      sourceId: "Y001RC1Q027SBEA",
      transform: "yoy",
      layer: "L3",
      type: "change",
      freq: "q",
      unit: "%",
      decimals: 1,
      url: FRED("Y001RC1Q027SBEA"),
      sourceLabel: "FRED · Y001RC1Q027SBEA (원 발표: 미 경제분석국 BEA)",
      what: "기업이 소프트웨어·연구개발·콘텐츠 같은 **지식재산**에 쓴 돈이 1년 전보다 얼마나 늘었는지입니다(명목).",
      why: "AI 모델 개발과 소프트웨어 투자가 여기에 잡힙니다. 생산성이 오르는 경로는 기계보다 이쪽이 더 직접적일 수 있습니다.",
      read: "⚠ 자체 개발 소프트웨어는 비용을 기준으로 추정해 넣습니다 — 실제 가치와 다를 수 있습니다. 비주거 고정투자(총액)의 구성요소입니다.",
      order: 3,
    },
  ],
};
