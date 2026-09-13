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
 * FRED는 `WALCL`·`WDTGAL`을 **백만 달러**로, `RRPONTSYD`를 **십억 달러**로 준다.
 * 그대로 더하면 1000배가 어긋난다. 그래서 표시 단위를 **조 달러로 통일**했다
 * (`levelM` / `levelK`). 여기에 계열을 더할 때 원본 단위를 반드시 확인할 것.
 * (2026-08-25 정정: 이 문단이 `WDTGAL`을 십억이라고 적고 있었다. 아래 `tga` 정의의
 *  주석·`transform`은 처음부터 백만이 맞았고, **경고문 쪽이 틀려 있었다.**
 *  단위를 조심하라고 세워 둔 문단이 틀린 단위를 가르치고 있었던 셈이다.)
 *
 * ## 순유동성(`netliq`)은 파생 계열이다 (2026-08-25 추가)
 * 볼트 금리 허브의 대표 지표다. 세 계열을 날짜로 맞춰 합성해야 하고 위의 단위 함정이
 * 그대로 걸려서, **구성요소 셋을 먼저 세우고**(2026-08-22) 다음 세션에 만들었다.
 * ⚠ 합성 규칙과 그 위험은 `lib/macro/derived.ts`에 있다 — 값은 DB에 쌓지 않고 읽을 때 만든다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
    key: "liquidity",
    name: "유동성",
    emoji: "🌊",
    question: "시장에 돈이 얼마나 남아 있나?",
    intro:
      "금리가 '돈의 값'이라면 유동성은 '돈의 양'입니다. 연준이 풀어 둔 돈에서 정부 계좌에 잠긴 돈과 역레포로 되돌아간 돈을 빼면, 실제로 시장에서 돌 수 있는 몫이 남습니다. 같은 금리에서도 이 잔액이 줄면 위험자산이 먼저 흔들립니다. ⚠ 여기 있는 숫자들은 흐름이 아니라 잔액입니다 — '얼마나 줄었나'보다 '얼마나 남았나'를 먼저 보세요. ⚠ 그리고 '돈이 풀린다'는 말에는 **성격이 다른 두 가지**가 섞여 있습니다. 연준이 만드는 쪽(정책금리·대차대조표)은 값을 움직이고, 재무부가 만드는 쪽(적자지출·발행·바이백)은 양을 옮깁니다. 앞쪽은 자산가격까지 이어지는 근거가 단단하지만, **뒤쪽은 순효과의 방향조차 아직 정해지지 않았습니다.**",
    order: 2,
  },
  indicators: [
    {
      /**
       * ⚠ **파생 계열.** 값이 DB에 없다 — `fed_assets`·`tga`·`rrp`를 읽을 때 합성한다.
       *   성분이 하나라도 없거나 너무 낡으면 **그 점은 아예 안 그린다**(`derived.ts` 규칙 1·2).
       */
      key: "netliq",
      name: "순유동성 (Net Liquidity)",
      group: "liquidity",
      source: "DERIVED",
      derived: {
        op: "subtract",
        // ⚠ 첫 번째가 기준 계열이다. 주간 대차대조표(수요일)가 날짜 눈금을 정한다.
        from: ["fed_assets", "tga", "rrp"],
        /**
         * 역레포는 일간, 대차대조표·TGA는 주간이다. 기준일에 딱 맞는 값이 없을 때
         * 앞선 값을 10일까지만 끌어다 쓴다 — 주간 한 칸(7일)에 연휴를 더한 폭이다.
         * ⚠ 넉넉하게 잡을수록 낡은 성분이 조용히 따라온다.
         */
        carryDays: 10,
      },
      /** ⚠ 성분이 각자 조 달러로 변환된 뒤 합성된다. 여기서 또 나누면 두 번 적용된다. */
      transform: "level",
      layer: "L1",
      type: "capacity_remaining",
      stateDependency:
        "성분인 역레포가 사실상 고갈되면(약 1,000억 달러 미만) 이 지표는 '완충장치를 쓰며 버틴 결과'가 아니라 '총자산과 정부 계정만 남은 상태'가 된다. 같은 감소라도 그 구간에서는 흡수할 여력이 남아 있지 않다는 뜻으로 읽어야 한다. 또 TGA가 줄어 이 값이 늘어난 경우는, 정부가 실제로 지출한 것인지 발행으로 다시 채워 넣을 것인지에 따라 뜻이 갈린다 — 재정 쪽 증감은 방출과 흡수의 시차만큼만 유동성이다.",
      freq: "w",
      unit: "조 달러",
      decimals: 2,
      /**
       * ⚠ 합성값을 한 장으로 보여주는 페이지가 없어 **기준 계열**로 건다.
       *   나머지 둘의 링크는 아래 각 지표 카드에 있다.
       */
      url: FRED("WALCL"),
      sourceLabel: "FRED 합성 · WALCL − WDTGAL − RRPONTSYD",
      what: "연준이 풀어 둔 돈(총자산)에서 정부 통장에 잠긴 돈(TGA)과 하루짜리로 되돌아간 돈(역레포)을 뺀 값입니다. 실제로 시장에서 돌 수 있는 몫에 가깝습니다.",
      why: "이 묶음의 세 숫자를 따로 보면 방향이 서로 엇갈려 읽기 어렵습니다. 하나로 합치면 '같은 금리에서 돈의 양이 늘고 있나 줄고 있나'를 한 줄로 볼 수 있습니다. 위험자산이 흔들린 구간과 이 값이 꺾인 구간이 자주 겹쳤습니다.",
      read: "절대 수준보다 **방향과 기울기**를 봅니다. ⚠ 이 값은 세 계열을 뺀 결과라, 어느 성분 때문에 움직였는지까지 봐야 뜻이 정해집니다 — 아래 세 카드를 같이 보세요. ⚠ 이 값이 늘었다고 곧바로 '유동성이 풀렸다'로 읽지 않습니다. 국채도 유동성을 제공하기 때문에, 빚을 내서 하는 재정확장은 오히려 조이는 쪽으로 작동할 수 있습니다(BIS 연구 967번). 시장이 그 확장을 일시적이라고 볼 때만 순증합니다.",
      headline: true,
      order: 1,
    },
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
      /**
       * ⚠ 홈의 대표 자리를 `netliq`에 넘겼다(2026-08-25). 총자산만 보면 TGA·역레포가
       *   같은 기간에 얼마나 흡수했는지가 안 보여서, 방향을 반대로 읽을 수 있다.
       *   묶음당 대표는 하나다 — 둘을 다 올리면 홈이 유동성 얘기만 두 칸 하게 된다.
       */
      order: 2,
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
      why: "여기에 돈이 쌓이는 동안은 그만큼 시중에서 돈이 빠져나간 것입니다. 세금 납부 시기나 부채한도 협상 직후에 시장이 뻑뻑해지는 이유가 여기 있습니다. 재정 쪽 유동성은 결국 '발행으로 걷어들인 시점과 지출로 푸는 시점의 시차'인데, **그 시차가 눈에 보이는 곳이 이 잔액**입니다.",
      read: "잔액이 **높아지는 구간**은 유동성 흡수, **낮아지는 구간**은 방출로 읽습니다. 다만 위의 경고대로 수준을 함께 봐야 합니다. ⚠ 국채 바이백을 이 잔액이 줄어드는 근거로 쓰는 설명을 자주 보는데, 그건 세금이 걷히는 달의 현금관리 목적 바이백에만 해당합니다. 시장 유동성을 돕는 목적의 바이백은 **새로 발행한 돈으로 사들이기 때문에**(미국 법전 31편 3111조) 이 잔액을 줄이지 않습니다.",
      order: 3,
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
      order: 4,
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
      order: 5,
    },
    {
      key: "reserves",
      name: "은행 지급준비금",
      group: "liquidity",
      source: "FRED",
      // ⚠ 백만 달러 단위다(WALCL과 같다) — 조 달러로 읽으려고 levelM.
      sourceId: "WRESBAL",
      transform: "levelM",
      layer: "L1",
      type: "level",
      freq: "w",
      unit: "조 달러",
      decimals: 2,
      url: FRED("WRESBAL"),
      sourceLabel: "FRED · WRESBAL (연준 H.4.1)",
      what: "은행들이 연준에 맡겨 둔 돈입니다. 은행끼리 결제하고 급할 때 꺼내 쓰는 **금융 시스템의 현금 서랍**입니다.",
      why: "⭐ **돈이 모자란가**를 가장 직접 보여 줍니다. 재무부가 TGA에서 돈을 쓰면 여기가 늘고, TGA를 채우거나 연준이 자산을 줄이면 여기가 줄어듭니다. 금리가 높아도 준비금이 넉넉하면 「돈이 비싼 것」이지 「돈이 없는 것」은 아닙니다.",
      read: "주간 증감을 TGA 증감과 함께 보세요 — TGA가 줄고 준비금이 늘었다면 재정지출이 은행으로 들어온 것입니다. ⚠ 준비금이 넉넉한데도 단기 자금금리(SOFR)가 튀면, 양의 문제가 아니라 **분배(누가 쥐고 있나)의 문제**입니다.",
      order: 6,
    },
    {
      key: "rrp_foreign",
      name: "해외 공적기관 역레포 (FIMA 풀)",
      group: "liquidity",
      source: "FRED",
      // ⚠ 백만 달러 단위다. 국내 ON RRP(`rrp`, RRPONTSYD)와 **다른 계정**이다.
      sourceId: "WLRRAFOIAL",
      transform: "levelM",
      layer: "L1",
      type: "level",
      freq: "w",
      unit: "조 달러",
      decimals: 3,
      url: FRED("WLRRAFOIAL"),
      sourceLabel: "FRED · WLRRAFOIAL (연준 H.4.1)",
      what: "외국 중앙은행·국제기구가 뉴욕 연준에 하루짜리로 맡겨 둔 달러입니다. 국내 머니마켓펀드가 쓰는 역레포(ON RRP)와는 **다른 창구**입니다.",
      why: "⚠ **시장 유동성이 아닙니다.** 2026-09-13 기준 연준 대차대조표의 역레포 약 3,500억 달러 가운데 거의 전부가 이 계정이고, 국내 ON RRP는 50억 달러 남짓입니다. 둘을 합친 「역레포 감소」를 2021~2024년처럼 「머니마켓펀드 돈이 시장으로 나왔다」로 읽으면 틀립니다. 그래서 따로 싣습니다.",
      read: "달러가 필요한 해외 공적기관이 이 돈을 빼 가면 달러 수요가 커졌다는 신호일 수 있습니다 — 달러 강세·해외 달러 조달 쪽 참고값으로 보세요. ⚠ **순유동성(Net Liquidity) 계산에는 넣지 않습니다.**",
      order: 7,
    },
    {
      key: "sofr",
      name: "SOFR (담보부 익일물 금리)",
      group: "liquidity",
      source: "FRED",
      sourceId: "SOFR",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "%",
      decimals: 2,
      url: FRED("SOFR"),
      sourceLabel: "FRED · SOFR (원 발표: 뉴욕 연준)",
      what: "국채를 담보로 하루 동안 돈을 빌릴 때 실제로 거래된 금리입니다. 미국 단기 자금시장의 기준 금리입니다.",
      why: "금융기관이 **오늘 밤 돈을 구하는 값**입니다. 자금시장이 빡빡해지면 이 금리가 연준이 정한 범위 위쪽으로 튑니다.",
      read: "혼자 보기보다 아래 「SOFR − IORB」로 보세요 — 연준이 준비금에 주는 이자보다 비싸게 빌려야 하는 상황이 자금 스트레스입니다. ⚠ 분기말·월말·세금 납부일에는 일시적으로 튀는 게 정상입니다.",
      order: 8,
    },
    {
      key: "iorb",
      name: "IORB (준비금 이자율)",
      group: "liquidity",
      source: "FRED",
      // ⚠ FRED가 **다음 날 적용 금리**를 미리 싣는다(2026-09-13에 09-14 값이 있었다). 수집기가 그 한 점을
      //   미래 관측일로 버리고 이력에 「1점 버림」을 남긴다 — 고장이 아니라 규칙이다(`lib/macro/observed.ts`).
      sourceId: "IORB",
      transform: "level",
      layer: "L0",
      type: "level",
      freq: "d",
      unit: "%",
      decimals: 2,
      url: FRED("IORB"),
      sourceLabel: "FRED · IORB (원 발표: 연준 이사회)",
      what: "연준이 은행 준비금에 붙여 주는 이자율입니다. 연준이 **정하는** 금리라 정책금리 범위와 함께 움직입니다.",
      why: "은행 입장에서 이것은 **연준에 그냥 맡겨 두면 받는 수익**입니다. 그래서 은행은 이보다 낮은 금리로는 남에게 잘 빌려주지 않고, 단기 자금금리의 바닥 역할을 합니다.",
      read: "이 값 자체보다 SOFR와의 차이를 보세요. 정책 결정일에만 바뀝니다.",
      order: 9,
    },
    {
      key: "sofr_iorb",
      name: "SOFR − IORB (자금시장 스트레스)",
      group: "liquidity",
      source: "DERIVED",
      derived: {
        op: "subtract",
        // ⚠ 첫 번째가 기준 계열이다. IORB는 결정일에만 바뀌므로 며칠 끌어다 써도 뜻이 달라지지 않는다.
        from: ["sofr", "iorb"],
        carryDays: 5,
      },
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "%p",
      decimals: 2,
      url: FRED("SOFR"),
      sourceLabel: "FRED 합성 · SOFR − IORB",
      what: "담보부 익일물 시장금리(SOFR)에서 연준의 준비금 이자율(IORB)을 뺀 값입니다.",
      why: "⭐ **돈이 모자란지(양)와 돈이 비싼지(값)를 가르는 눈금**입니다. 연준이 금리를 올리면 둘이 함께 오르므로 이 차이는 그대로입니다 — 긴축은 여기에 안 찍힙니다. 이 값이 **양수로 벌어질 때**는 준비금에 이자를 받느니 시장에 빌려주는 게 낫다는 뜻, 즉 시장에서 현금이 모자라다는 뜻입니다.",
      read: "평소에는 0 근처이거나 약간 음수입니다. 며칠 연속 양수로 벌어지면 자금시장 스트레스를 의심합니다. ⚠ 분기말 하루 이틀 튀는 것은 흔합니다 — **지속되는지**를 보세요.",
      order: 10,
    },
    {
      // ⚠ 2026-09-14 통합 계획 S2 — 명세 §15 「레포 안정성」의 입력(명세에 정의가 없어 Woodsman v0: SOFR 분포의 폭).
      key: "sofr99",
      name: "SOFR 99번째 백분위",
      group: "liquidity",
      source: "FRED",
      sourceId: "SOFR99",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "%",
      decimals: 2,
      url: FRED("SOFR99"),
      sourceLabel: "FRED · SOFR99 (원 발표: 뉴욕 연준)",
      what: "하루 동안 거래된 담보부 익일물 금리 가운데 **가장 비싸게 빌린 1%** 쪽의 금리입니다.",
      why: "평균(SOFR)이 조용해도, 급하게 돈을 구한 누군가는 훨씬 비싸게 빌렸을 수 있습니다. 그 **꼬리**를 봅니다.",
      read: "혼자 보기보다 아래 「SOFR 분포 폭」으로 보세요. ⚠ 분기말·월말에는 꼬리가 튀는 게 흔합니다.",
      order: 15,
    },
    {
      key: "sofr1",
      name: "SOFR 1번째 백분위",
      group: "liquidity",
      source: "FRED",
      sourceId: "SOFR1",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "%",
      decimals: 2,
      url: FRED("SOFR1"),
      sourceLabel: "FRED · SOFR1 (원 발표: 뉴욕 연준)",
      what: "하루 동안 거래된 담보부 익일물 금리 가운데 **가장 싸게 빌린 1%** 쪽의 금리입니다.",
      why: "분포의 아래쪽 끝입니다. 위쪽 끝(99번째)과의 거리가 자금시장이 한 가격으로 돌고 있는지를 말합니다.",
      read: "혼자 보기보다 아래 「SOFR 분포 폭」으로 보세요.",
      order: 16,
    },
    {
      /**
       * ⭐ 레포 안정성 — SOFR 99번째 − 1번째 백분위(2026-09-14, 통합 계획 S2).
       * ⚠ 명세 §15는 「repo stability」의 산식을 정하지 않았다(설계서 11-4). **Woodsman v0 정의**: 같은 날 거래 금리의 폭.
       *   폭이 넓으면 담보·차주에 따라 값이 크게 갈리는 것 — 한 가격으로 돌지 못하는 자금시장이다.
       * ⚠ SRF 이용량(RPONTSYD)을 쓰지 않은 이유: 거의 매일 0이라 10년 창의 흩어짐(MAD)이 0 → 정규화할 수 없다.
       */
      key: "sofr_dispersion",
      name: "SOFR 분포 폭 (99번째 − 1번째 백분위)",
      group: "liquidity",
      source: "DERIVED",
      derived: { op: "subtract", from: ["sofr99", "sofr1"], carryDays: 3 },
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "%p",
      decimals: 2,
      url: FRED("SOFR99"),
      sourceLabel: "FRED 합성 · SOFR99 − SOFR1 (Woodsman v0 레포 안정성)",
      what: "같은 날 담보부 익일물 금리의 **가장 비싼 쪽과 가장 싼 쪽의 차이**입니다.",
      why: "자금시장이 건강하면 누구나 비슷한 값에 빌립니다. 폭이 벌어지면 **누군가는 훨씬 비싸게 빌려야** 하는 상태 — 돈이 고르게 돌지 않는다는 신호입니다.",
      read: "평소보다 넓게 벌어진 날이 **며칠 이어지는지**를 보세요. ⚠ 분기말·월말 하루짜리 확대는 흔합니다. 2019년 9월 레포 금리 급등 때 크게 벌어졌습니다.",
      order: 17,
    },
    {
      /**
       * 자금 변동성 — SOFR 일간 변화의 20일 실현변동성(bp, 연율). 명세 §15 「funding volatility」.
       * ⚠ 정책금리 변경일에는 SOFR가 계단처럼 움직여 변동성이 기계적으로 커진다 — 카드에 적는다.
       */
      key: "sofr_rvol",
      name: "SOFR 변동성 (20일 실현, bp)",
      group: "liquidity",
      source: "DERIVED",
      derived: { op: "realizedVolBp", from: ["sofr"], carryDays: 5, window: 20 },
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "bp",
      decimals: 0,
      url: FRED("SOFR"),
      sourceLabel: "FRED 합성 · SOFR 일간 변화 20일 표준편차 × √252",
      what: "담보부 익일물 금리(SOFR)가 최근 한 달 동안 **하루하루 얼마나 출렁였는지**를 1년 기준 bp로 바꾼 값입니다.",
      why: "하룻밤 돈값이 들쭉날쭉하면 금융기관이 자금 계획을 세우기 어렵고, 그 불확실성이 위험자산의 레버리지를 줄입니다.",
      read: "높을수록 자금시장이 불안합니다. ⚠ **연준이 금리를 바꾼 직후 20일**은 계단 한 번 때문에 값이 크게 나옵니다 — 그 기간은 회의 날짜와 함께 보세요.",
      order: 18,
    },
    {
      // ⚠ 분모는 재무부가 낸 「Total Marketable」 행이다 — 구성요소를 더해 만들지 않는다(lib/macro/treasury.ts).
      key: "tsy_bill_share",
      name: "시장성 국채 중 단기물(Bills) 비중",
      group: "liquidity",
      source: "TREASURY",
      sourceId: "mspd:bill_share",
      transform: "level",
      layer: "L1",
      type: "level",
      freq: "m",
      unit: "%",
      decimals: 1,
      url: "https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/summary-of-treasury-securities-outstanding",
      sourceLabel: "미 재무부 Fiscal Data · MSPD 표 1(월말 잔액)",
      what: "재무부가 시장에 발행해 남아 있는 국채 가운데 만기 1년 이하 단기물(Bills)이 차지하는 비율입니다. 매달 말 기준입니다.",
      why: "⭐ **재무부가 돈을 어떻게 빌리는지**가 금융 시스템에 다르게 닿습니다. 단기물은 머니마켓펀드·역레포의 현금이 사 가는 경우가 많아 은행 준비금을 덜 흡수하고, 장기물(이표채)은 **장기금리와 기간 프리미엄**에 직접 부담을 줍니다. 명세 Treasury Liquidity의 「Bill/Coupon Mix」 자리입니다.",
      read: "비중이 오르면 재무부가 단기로 더 많이 빌리는 것이고, 장기금리 부담은 줄지만 단기 자금시장에 물량이 늘어납니다. ⚠ 볼트 8/25 검증대로 **재무부 쪽 유동성은 순효과의 방향이 정해지지 않았습니다** — 이 값이 오르내리는 것만으로 유동성이 늘었다고 단정하지 않습니다.",
      order: 11,
    },
    {
      // ⚠ Notes + Bonds만. 물가연동국채(TIPS)·변동금리채(FRN)·연방금융은행(FFB)은 성격이 달라 넣지 않는다.
      key: "tsy_coupon_share",
      name: "시장성 국채 중 이표채(Notes·Bonds) 비중",
      group: "liquidity",
      source: "TREASURY",
      sourceId: "mspd:coupon_share",
      transform: "level",
      layer: "L1",
      type: "level",
      freq: "m",
      unit: "%",
      decimals: 1,
      url: "https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/summary-of-treasury-securities-outstanding",
      sourceLabel: "미 재무부 Fiscal Data · MSPD 표 1(월말 잔액)",
      what: "시장성 국채 가운데 만기 2년 이상의 이자 붙는 국채(Notes·Bonds)가 차지하는 비율입니다. 물가연동국채와 변동금리채는 빼고 셉니다.",
      why: "장기 국채가 늘어나면 시장이 소화해야 할 **기간 위험**이 커집니다. 기업·가계와 같은 장기 자금을 두고 경쟁하게 되어, 명세 Capital Competition의 「Coupon Supply」 자리입니다.",
      read: "단기물 비중과 함께 보세요(둘을 더해도 100%가 아닙니다 — 물가연동국채·변동금리채가 빠져 있습니다). 이표채 비중이 오르는 시기에 기간 프리미엄이 함께 오르면 **공급 부담**이 금리에 찍히고 있다는 뜻입니다.",
      order: 12,
    },
    {
      // ⚠ 명목 10년물만 — 이름이 같은 10년 TIPS를 뺀다(inflation_index_security). 재발행(9-Year 11/10-Month)은 넣는다.
      // 입찰은 한 달에 한 번 남짓이다(신규 + 재발행 두 번이 석 달에 한 바퀴). 입찰일이 관측일이다.
      key: "auction10y_btc",
      name: "10년 국채 입찰 응찰률 (명목)",
      group: "liquidity",
      source: "TREASURY",
      sourceId: "auction10y:bid_to_cover",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "m",
      unit: "배",
      decimals: 2,
      // ⚠ 2026-09-14: 워커에서 Fiscal Data가 525로 막혀 TreasuryDirect(TA_WS)로 받는다 — 같은 재무부 입찰 결과다.
      url: "https://www.treasurydirect.gov/auctions/auction-query/",
      sourceLabel: "미 재무부 TreasuryDirect · 국채 입찰 결과(명목 10년물 · TIPS 제외)",
      what: "재무부가 10년 국채를 팔 때 **팔려는 물량 대비 사겠다고 들어온 주문이 몇 배였는지**입니다. 신규 발행과 두 차례 재발행을 모두 셉니다.",
      why: "⭐ 국채를 **누가 얼마나 사 주는가**를 가장 직접 보여 줍니다. 응찰률이 떨어지면 같은 물량을 팔려고 더 높은 금리를 줘야 합니다 — 명세 Auction Quality · Auction Stress 자리입니다.",
      read: "평소 2.3~2.6배 안팎에서 움직입니다. 한 번 낮은 것보다 **몇 차례 연속 낮아지는지**를 보세요. ⚠ 응찰률만으로 수요를 단정하지 않습니다 — 해외 기관 비중이나 발행 금리가 시장 금리보다 높게 나왔는지(꼬리)도 함께 봐야 하는데, 꼬리는 무료 자료에 발표 직전 금리가 없어 아직 계산하지 못합니다.",
      order: 13,
    },
    {
      // ⚠ 명목 10년물만 — TIPS의 낙찰금리(실질금리 2%대)가 섞이면 이 계열이 조용히 절반으로 떨어진다.
      key: "auction10y_yield",
      name: "10년 국채 입찰 낙찰금리 (명목)",
      group: "liquidity",
      source: "TREASURY",
      sourceId: "auction10y:high_yield",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "m",
      unit: "%",
      decimals: 3,
      // ⚠ 2026-09-14: 워커에서 Fiscal Data가 525로 막혀 TreasuryDirect(TA_WS)로 받는다 — 같은 재무부 입찰 결과다.
      url: "https://www.treasurydirect.gov/auctions/auction-query/",
      sourceLabel: "미 재무부 TreasuryDirect · 국채 입찰 결과(명목 10년물 · TIPS 제외)",
      what: "10년 국채 입찰에서 **가장 높게 낙찰된 금리**(모든 낙찰자가 받는 금리)입니다.",
      why: "시장에서 매일 거래되는 10년 금리와 달리, 재무부가 **실제로 돈을 빌린 값**입니다. 입찰 응찰률과 짝으로 봅니다.",
      read: "같은 날 시장 10년 금리(미 국채 10년)와 견줘 보세요. 입찰 금리가 시장보다 눈에 띄게 높으면 그만큼 웃돈을 줘야 팔렸다는 뜻입니다. ⚠ 입찰 시각의 시장 금리는 무료 자료로 받을 수 없어 일별 종가와 비교합니다 — 정확한 「꼬리」가 아닙니다.",
      order: 14,
    },
  ],
};
