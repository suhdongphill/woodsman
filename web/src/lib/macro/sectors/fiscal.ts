/**
 * 재정·국채 섹터 — **정부가 얼마나 빌려 쓰고, 그 이자를 감당하고 있나**. (2026-09-20, GCRM P1)
 *
 * ## 왜 따로 세웠나
 * 기존 묶음에 재정을 끼워 넣을 자리가 없었다. 유동성은 **연준·재무부 잔액**을 보고, 신용·자금은
 * **민간 신용**을 본다. 정부의 수입·지출·이자는 둘 다 아니다. GCRM v2의 「재정 우위 압력」 기둥
 * (설계점검 v2 §2-5)이 세 자리를 「아직 안 받는다」로 비워 두고 있었고, 그 셋이 전부 여기 있다.
 *
 * ## ⚠ 금액이 아니라 **비율**로 본다
 * 명목 금액(적자 몇 조 달러)은 물가와 경제 규모를 따라 커져서, 백분위로 재면 **최근이 늘 최악**이
 * 된다 — 움직이지 않는 지표는 판단에 아무것도 보태지 않는다(2026-09-20에 이 함정을 피해 설계를 바꿨다).
 * 그래서 대표 지표 둘을 **세입 대비 비율**로 만든다.
 *
 * ```text
 * 지출/세입 =  연방 지출 ÷ 연방 세입 × 100      1990~2026 범위 91% ~ 252%
 * 이자/세입 =  연방 이자지출 ÷ 연방 세입 × 100   1990~2026 범위 12.4% ~ 27.6%
 * ```
 *
 * 둘 다 **평균으로 돌아오는 값**이고(2000년 91% → 2020년 252% → 2026년 130%), 그래서 백분위가 산다.
 * ⚠ 이자/세입은 지금(20.9%)이 사상 최악이 **아니다** — 1990년대 초가 더 높았다. 「사상 최대 이자 부담」
 * 이라는 흔한 문장은 금액으로만 참이다.
 *
 * ## ⚠ 두 통계는 서로 다른 장부다
 * 세입·지출·이자는 **국민계정(BEA NIPA)** 기준이고, 시장성 국채 잔액은 **재무부 MSPD**다.
 * 같은 「재정」이라도 회계가 달라 서로 빼거나 나누지 않는다 — 비율은 같은 장부 안에서만 만든다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
    key: "fiscal",
    name: "재정·국채",
    emoji: "🏛️",
    question: "정부가 얼마나 빌려 쓰고, 그 이자를 감당하고 있나?",
    intro:
      "정부가 세금으로 걷는 것보다 많이 쓰면 그 차액은 **국채로 메웁니다**. 국채가 늘면 시장은 그만큼을 사 줘야 하고, 금리가 오르면 정부가 내는 이자도 함께 늘어납니다. 이 묶음은 그 고리를 봅니다 — 지출이 세입을 얼마나 넘는지, 이자가 세입을 얼마나 먹는지, 시장이 들고 있는 국채가 얼마나 빠르게 느는지. ⚠ 금액이 아니라 **세입 대비 비율**로 봅니다. 금액은 물가와 경제 규모를 따라 늘어서 언제나 「사상 최대」가 되기 때문입니다.",
    order: 15,
  },
  indicators: [
    {
      key: "fed_outlays_receipts",
      name: "연방 지출 ÷ 세입",
      group: "fiscal",
      source: "DERIVED",
      derived: {
        op: "ratioPct",
        // ⚠ 분자가 앞이다. 둘 다 같은 BEA 발표에서 같은 분기 날짜로 나온다.
        from: ["fed_outlays", "fed_receipts"],
        carryDays: 10,
      },
      transform: "level",
      layer: "L3",
      type: "level",
      freq: "q",
      unit: "%",
      decimals: 0,
      url: FRED("FGEXPND"),
      sourceLabel: "FRED 합성 · FGEXPND ÷ FGRECPT (원 발표: 미 경제분석국 BEA)",
      what: "연방정부가 쓴 돈이 걷은 돈의 몇 %인지입니다. 100%면 걷은 만큼만 쓴 것이고, 130%면 걷은 돈의 1.3배를 썼다는 뜻입니다.",
      why: "⭐ **재정 적자를 경제 규모와 무관하게 읽는 방법**입니다. 적자 금액은 물가와 경제가 커지면 따라 커지지만, 이 비율은 그렇지 않습니다. 넘치는 만큼이 곧 국채 발행이고, 그게 시장이 소화해야 할 물량입니다.",
      read: "100%가 균형입니다. 2000년 91%(흑자), 2020년 2분기 252%(팬데믹), 2026년 2분기 130%였습니다. ⚠ 경기침체에는 자동으로 올라갑니다 — 세입이 줄고 실업급여가 늘기 때문입니다. 불황기의 상승과 호황기의 상승은 뜻이 다릅니다.",
      order: 1,
    },
    {
      key: "fed_interest_receipts",
      name: "연방 이자지출 ÷ 세입",
      group: "fiscal",
      source: "DERIVED",
      derived: {
        op: "ratioPct",
        from: ["fed_interest", "fed_receipts"],
        carryDays: 10,
      },
      transform: "level",
      layer: "L3",
      type: "level",
      freq: "q",
      unit: "%",
      decimals: 1,
      url: FRED("A091RC1Q027SBEA"),
      sourceLabel: "FRED 합성 · A091RC1Q027SBEA ÷ FGRECPT (원 발표: 미 경제분석국 BEA)",
      what: "정부가 걷은 세금 중 몇 %가 **이미 진 빚의 이자**로 나가는지입니다.",
      why: "⭐ 「재정 우위(fiscal dominance)」가 시작되는 자리입니다. 이자가 세입을 크게 먹으면, 통화당국이 금리를 올릴 때 **정부 재정이 먼저 비명을 지릅니다**. 그때 금리 결정이 물가가 아니라 재정을 보게 되는 것이 재정 우위입니다.",
      read: "⚠ 지금(2026년 2분기 20.9%)이 사상 최악이 **아닙니다** — 1990년대 초는 27%를 넘었습니다. 「사상 최대 이자 부담」이라는 말은 **금액으로만** 참입니다. 방향을 보세요: 2021년 12.4%에서 꾸준히 오르고 있습니다.",
      order: 2,
    },
    {
      key: "treasury_marketable",
      name: "시장성 국채 잔액",
      group: "fiscal",
      source: "TREASURY",
      sourceId: "mspd:total_marketable",
      transform: "level",
      layer: "L1",
      type: "level",
      freq: "m",
      unit: "조 달러",
      decimals: 2,
      url: "https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/summary-of-treasury-securities-outstanding",
      sourceLabel: "미 재무부 Fiscal Data · MSPD 표 1(월말 잔액)",
      what: "시장에서 사고팔 수 있는 미 국채의 총 잔액입니다. 정부기관이 서로 들고 있는 비시장성 국채는 뺀 값입니다.",
      why: "시장이 **실제로 떠안아야 하는 물량**입니다. 연준이 자산을 줄이는 동안 이 잔액이 늘면, 그 차이는 민간이 떠안습니다 — 국채 금리와 기간 프리미엄이 움직이는 자리입니다.",
      read: "잔액 자체보다 **느는 속도**를 보세요. ⚠ 이 값은 거의 언제나 사상 최대입니다(명목 잔액이라 줄어들 일이 드뭅니다) — 「사상 최대 국채」는 뉴스가 아닙니다. ⚠ 같은 묶음의 두 비율과 달리 **재무부 장부**라, 세입·지출과 직접 나누지 않습니다.",
      order: 3,
    },
    {
      key: "fed_receipts",
      name: "연방 세입 (연율)",
      group: "fiscal",
      source: "FRED",
      // 10억 달러(연율·계절조정). 화면은 조 달러로 본다.
      sourceId: "FGRECPT",
      transform: "levelK",
      layer: "L3",
      type: "level",
      freq: "q",
      unit: "조 달러",
      decimals: 2,
      url: FRED("FGRECPT"),
      sourceLabel: "FRED · FGRECPT (원 발표: 미 경제분석국 BEA 국민계정)",
      what: "연방정부가 한 해에 걷는 돈을 분기 자료로 연율 환산한 값입니다. 소득세·법인세·사회보장기여금이 대부분입니다.",
      why: "위 두 비율의 **분모**입니다. 분모를 따로 보여 주는 이유는, 비율이 오를 때 지출이 늘어서인지 **세입이 줄어서인지**가 다른 이야기이기 때문입니다.",
      read: "경기와 함께 움직입니다 — 침체에는 먼저 줄어듭니다. ⚠ 국민계정 기준이라 재무부 월간 재정보고서(MTS)의 숫자와 다릅니다. 두 장부를 섞어 계산하지 마세요.",
      order: 4,
    },
    {
      key: "fed_outlays",
      name: "연방 지출 (연율)",
      group: "fiscal",
      source: "FRED",
      sourceId: "FGEXPND",
      transform: "levelK",
      layer: "L3",
      type: "level",
      freq: "q",
      unit: "조 달러",
      decimals: 2,
      url: FRED("FGEXPND"),
      sourceLabel: "FRED · FGEXPND (원 발표: 미 경제분석국 BEA 국민계정)",
      what: "연방정부가 한 해에 쓰는 돈을 분기 자료로 연율 환산한 값입니다. 사회보장·국방·이자가 큰 몫입니다.",
      why: "위 비율의 **분자**입니다. 지출이 세입보다 빨리 늘면 그 차이가 국채로 나옵니다.",
      read: "⚠ 여기에는 **이자지출이 포함**돼 있습니다 — 아래 이자지출과 더하지 마세요(이중 계산).",
      order: 5,
    },
    {
      key: "fed_interest",
      name: "연방 이자지출 (연율)",
      group: "fiscal",
      source: "FRED",
      sourceId: "A091RC1Q027SBEA",
      transform: "levelK",
      layer: "L3",
      type: "level",
      freq: "q",
      unit: "조 달러",
      decimals: 2,
      url: FRED("A091RC1Q027SBEA"),
      sourceLabel: "FRED · A091RC1Q027SBEA (원 발표: 미 경제분석국 BEA 국민계정)",
      what: "연방정부가 이미 진 빚에 대해 한 해에 내는 이자를 분기 자료로 연율 환산한 값입니다.",
      why: "금리 인상이 **재정으로 번지는 통로**입니다. 새로 빌리는 돈뿐 아니라, 만기가 돌아와 다시 빌리는 옛 빚에도 새 금리가 붙습니다.",
      read: "금리가 오른 뒤 **몇 분기에 걸쳐 천천히** 올라갑니다 — 국채가 만기마다 갈아타기 때문입니다. 그래서 금리가 멈춘 뒤에도 한동안 더 오릅니다. 비율로 읽으려면 위의 「이자지출 ÷ 세입」을 보세요.",
      order: 6,
    },
  ],
};
