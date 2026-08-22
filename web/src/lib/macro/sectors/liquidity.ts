/**
 * 유동성 섹터 — **돈이 얼마나 남아 있나**(L1 스톡·잔액).
 *
 * 볼트 `_scripts/sectors/rates.json`의 L1 블록을 사이트로 옮긴 것이다(2026-08-22).
 * 볼트는 금리 허브 하나에 금리·유동성·신용·원자재를 다 담지만, 이 사이트는
 * **묶음 하나가 화면 하나**라 유동성을 따로 세운다 — 금리 화면에 잔액 지표를 섞으면
 * "가격(L2)"과 "잔액(L1)"을 같은 눈으로 읽게 된다.
 *
 * ## ⚠ 스톡을 플로우처럼 읽으면 틀린다
 * 이 묶음의 지표는 대부분 **남은 완충 여력**이다. "역레포 감소 = 유동성 공급"은
 * 잔액이 남아 있을 때만 성립하고, 고갈 구간에서는 같은 감소가 완충장치 소멸을 뜻한다.
 * 그래서 뒤집히는 조건을 `stateDependency`에 적었고, 적지 않으면
 * `validateSectors()`가 로드를 거부한다.
 *
 * ## ⚠ 단위가 계열마다 다르다 — 여기가 조용히 틀리는 자리다
 * FRED는 `WALCL`을 **백만 달러**로, `WDTGAL`·`RRPONTSYD`를 **십억 달러**로 준다.
 * 그대로 더하면 1000배가 어긋난다. 그래서 표시 단위를 **조 달러로 통일**했다
 * (`levelM` / `levelK`). 여기에 계열을 더할 때 원본 단위를 반드시 확인할 것.
 *
 * ## ⚠ 순유동성(총자산 − TGA − 역레포)은 아직 없다
 * 볼트의 대표 지표(`netliq`)지만 **파생 계열**이라 세 계열을 날짜로 맞춰 합성해야 하고,
 * 위의 단위 함정이 그대로 걸린다. 잘못 만들면 "그럴듯한데 틀린 한 줄"이 되므로
 * 구성요소 세 개를 먼저 세우고 다음에 만든다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
    key: "liquidity",
    name: "유동성",
    emoji: "🌊",
    question: "시장에 돈이 얼마나 남아 있나?",
    intro:
      "금리가 '돈의 값'이라면 유동성은 '돈의 양'입니다. 연준이 풀어 둔 돈에서 정부 계좌에 잠긴 돈과 역레포로 되돌아간 돈을 빼면, 실제로 시장에서 돌 수 있는 몫이 남습니다. 같은 금리에서도 이 잔액이 줄면 위험자산이 먼저 흔들립니다. ⚠ 여기 있는 숫자들은 흐름이 아니라 잔액입니다 — '얼마나 줄었나'보다 '얼마나 남았나'를 먼저 보세요.",
    order: 2,
  },
  indicators: [
    {
      key: "fed_assets",
      name: "연준 총자산",
      group: "liquidity",
      source: "FRED",
      sourceId: "WALCL",
      transform: "levelM",
      layer: "L1",
      type: "level",
      freq: "w",
      unit: "조 달러",
      decimals: 2,
      url: FRED("WALCL"),
      sourceLabel: "FRED · WALCL (연준 H.4.1)",
      what: "연준이 들고 있는 자산의 총액입니다. 국채와 주택저당증권을 사들이면 늘고, 만기가 돌아온 것을 재투자하지 않으면 줄어듭니다.",
      why: "이 숫자가 늘어난 시기와 위험자산이 오른 시기가 상당히 겹칩니다. 금리 발표만 보면 놓치는, 돈의 양 쪽 이야기입니다.",
      read: "절대 수준보다 **방향과 기울기**를 봅니다. 줄이는 국면(양적긴축)에서는 같은 금리라도 시장이 더 팍팍하게 느낍니다.",
      headline: true,
      order: 1,
    },
    {
      key: "tga",
      name: "재무부 일반계정 (TGA)",
      group: "liquidity",
      source: "FRED",
      sourceId: "WDTGAL",
      /**
       * ⚠ `WDTGAL`은 FRED가 **백만 달러**로 준다(십억이 아니다).
       *   실제 응답으로 확인했다: 2026-06-10 = 801,084 → $801B → 0.80조 달러.
       *   같은 묶음의 `RRPONTSYD`는 **십억 달러**라 `levelK`를 쓴다.
       *   이 파일 머리말의 경고가 가리키는 자리가 정확히 여기다.
       */
      transform: "levelM",
      layer: "L1",
      type: "capacity_remaining",
      stateDependency:
        "잔액이 높으면 앞으로 지출로 풀릴 여력, 낮으면 재건 과정에서 시장 유동성을 흡수한다. 방향이 아니라 수준과 함께 읽을 것.",
      freq: "w",
      unit: "조 달러",
      decimals: 2,
      url: FRED("WDTGAL"),
      sourceLabel: "FRED · WDTGAL (미 재무부)",
      what: "미국 정부가 연준에 두고 쓰는 '정부 통장'의 잔액입니다. 세금이 들어오면 차고, 지출하면 빠집니다.",
      why: "여기에 돈이 쌓이는 동안은 그만큼 시중에서 돈이 빠져나간 것입니다. 세금 납부 시기나 부채한도 협상 직후에 시장이 뻑뻑해지는 이유가 여기 있습니다.",
      read: "잔액이 **높아지는 구간**은 유동성 흡수, **낮아지는 구간**은 방출로 읽습니다. 다만 위의 경고대로 수준을 함께 봐야 합니다.",
      order: 2,
    },
    {
      key: "rrp",
      name: "역레포 잔액 (ON RRP)",
      group: "liquidity",
      source: "FRED",
      sourceId: "RRPONTSYD",
      transform: "levelK",
      layer: "L1",
      type: "capacity_remaining",
      stateDependency:
        "잔액이 남아 있을 때만 '감소 = 유동성 공급'이 성립한다. 사실상 고갈(약 1,000억 달러 미만) 구간에서는 같은 감소가 완충장치 소멸을 뜻하므로 해석을 뒤집어야 한다.",
      freq: "d",
      unit: "조 달러",
      decimals: 3,
      url: FRED("RRPONTSYD"),
      sourceLabel: "FRED · RRPONTSYD (뉴욕 연준)",
      what: "머니마켓펀드 같은 곳이 하루짜리로 연준에 맡겨 둔 돈입니다. 갈 데가 마땅치 않은 현금이 여기 모입니다.",
      why: "이 잔액이 줄면 그 돈이 국채나 다른 자산으로 나갔다는 뜻이라 시장에는 완충재가 됩니다. 양적긴축이 오래 가도 시장이 버틴 이유를 이걸로 설명하곤 했습니다.",
      read: "⚠ **남은 잔액을 먼저 보세요.** 넉넉할 때의 감소와 바닥 근처에서의 감소는 정반대 뜻입니다.",
      order: 3,
    },
    {
      key: "m2_yoy",
      name: "M2 통화량 (전년비)",
      group: "liquidity",
      source: "FRED",
      sourceId: "M2SL",
      transform: "yoy",
      layer: "L1",
      type: "change",
      freq: "m",
      staleDays: 95,
      staleWhy:
        "연준 H.6. 해당 월 데이터가 다음 달 4주차에 나와 기준월 시작일에서 약 55일 뒤진다.",
      unit: "%",
      decimals: 1,
      url: FRED("M2SL"),
      sourceLabel: "FRED · M2SL (연준 H.6)",
      what: "현금과 예금처럼 바로 쓸 수 있는 돈의 총량이 작년보다 얼마나 늘었는지입니다.",
      why: "돈의 양이 줄어드는 구간은 역사적으로 드물고, 그런 시기에는 물가와 자산가격이 함께 식었습니다. 인플레이션의 뒤늦은 배경음 같은 지표입니다.",
      read: "0% 아래(전년보다 감소)는 흔치 않은 신호입니다. 다만 반응이 늦어, 이걸 보고 매매 시점을 잡는 용도가 아닙니다.",
      order: 4,
    },
  ],
};
