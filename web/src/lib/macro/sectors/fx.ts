/**
 * 환율 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
// ⚠ 2026-09-05부터 이 섹터에 FRED 계열이 없다(넷 다 Yahoo 일봉). FRED_URL import를 함께 지웠다.
import type { MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "fx",
      name: "환율",
      emoji: "💵",
      question: "원화와 달러의 힘겨루기는 어떤가?",
      intro:
        "한국에서 투자한다면 환율은 수익률의 일부입니다. 원/달러가 오르면(원화 약세) 달러 자산의 원화 환산 수익은 늘지만 수입 물가가 오르고 외국인 자금은 빠져나가기 쉽습니다. 달러인덱스는 달러 자체의 강도를 봅니다.",
      order: 6,
    },
  indicators: [
    {
      key: "usdkrw",
      name: "원/달러 환율",
      group: "fx",
      /**
       * ⚠ 2026-08-31 **FRED → Yahoo로 출처를 바꿨다.**
       *
       * 연준 H.10(DEXKOUS)은 일별 값을 **월요일에 직전 금요일치까지** 한 번에 낸다.
       * 그래서 8월 31일에 화면이 보여 주는 최신값이 **8월 21일**이었다 — 다른 FRED 계열이
       * 8월 28일치를 가진 날에도 이 계열만 일주일 더 뒤처졌다.
       *
       * ⚠ 그냥 늦는 게 아니라 **신뢰의 문제다.** 이 값은 달러 종목을 원화로 환산해
       * **대표 포트폴리오의 비중과 평가액**을 만든다. 열흘 전 환율로 계산한 오늘의 비중은
       * 틀린 숫자이고, 이 사이트는 숫자로 신뢰를 사는 곳이다.
       *
       * ⚠ **키(`usdkrw`)는 그대로다** — 바꾸면 쌓아 둔 시계열이 통째로 끊긴다(dxy 때와 같다).
       * ⚠ 과거 구간(FRED)과 최근 구간(Yahoo)은 **출처가 다르다.** DEXKOUS는 뉴욕 정오
       *    매입률이고 `KRW=X`는 장중 스팟이라, 이음매에서 값이 미세하게 어긋날 수 있다.
       * ⚠ `staleDays: 14` 예외를 **뺐다.** 그건 H.10의 주간 발표를 봐주려던 것이고,
       *    이제 일별 발표라 기본 규칙(`d` = 7일)이 맞다. 예외를 남겨 두면 진짜로 끊겼을 때
       *    일주일을 더 못 알아챈다.
       */
      source: "YAHOO",
      sourceId: "KRW=X",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "원",
      decimals: 1,
      url: "https://finance.yahoo.com/quote/KRW=X/",
      sourceLabel: "Yahoo Finance · KRW=X",
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
      /**
       * ⚠ 2026-08-22 **수동 → 자동**으로 바꿨다(볼트 §6-4와 같은 판단).
       *   수동으로 두는 동안 한 달 넘게 방치돼 있었고, 그 사실이 화면에 드러나지도 않았다.
       *   ⚠ 키(`dxy`)는 그대로다 — 바꾸면 쌓아 둔 시계열이 통째로 끊긴다.
       *   ⚠ 예전 수동 입력분과 출처가 다르다(Investing.com → ICE DXY 선물).
       *      과거 구간과 최근 구간의 값이 미세하게 어긋날 수 있다.
       */
      source: "YAHOO",
      sourceId: "DX-Y.NYB",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "",
      decimals: 2,
      url: "https://finance.yahoo.com/quote/DX-Y.NYB/",
      sourceLabel: "Yahoo Finance · DX-Y.NYB (ICE)",
      what: "유로·엔 등 주요 6개 통화 대비 달러의 종합 강도입니다.",
      why: "달러가 세지면 원자재와 신흥국 자산이 동시에 눌립니다. 위험자산 전반의 역풍 게이지입니다.",
      read: "원/달러가 올랐을 때 DXY도 올랐다면 달러가 센 것이고, DXY는 그대로인데 원화만 약하면 국내 요인입니다.",
      order: 2,
    },
    {
      key: "usdjpy",
      name: "엔/달러 환율",
      group: "fx",
      /**
       * ⚠ 2026-09-05 **FRED → Yahoo로 출처를 바꿨다**(usdkrw가 8월 31일에 간 길과 같다).
       *
       * 연준 H.10(DEXJPUS)은 일별 값을 **월요일에 직전 금요일치까지** 몰아서 낸다.
       * 9월 5일 현재 이 계열의 최신값은 **8월 28일**이었다 — 같은 날 Yahoo는 9월 4일치를
       * 갖고 있었다. 일주일 뒤처진 값으로 「엔 캐리가 흔들리는가」를 읽을 수는 없다.
       *
       * ⚠ `staleDays: 14` 예외를 **뺐다.** 그건 H.10의 주간 발표를 봐주던 것이고, 이제
       *    일별로 들어오니 기본 규칙(`d` = 7일)이 맞다. 예외를 남기면 진짜로 끊겼을 때
       *    일주일을 더 못 알아챈다 — 8월 31일 환율 사고가 정확히 이 모양이었다.
       * ⚠ **키(`usdjpy`)는 그대로다** — 바꾸면 쌓아 둔 시계열이 통째로 끊긴다.
       * ⚠ 과거 구간(FRED)과 최근 구간(Yahoo)은 출처가 다르다. DEXJPUS는 뉴욕 정오 매입률,
       *    `JPY=X`는 장중 스팟이라 이음매에서 값이 미세하게 어긋날 수 있다.
       */
      source: "YAHOO",
      sourceId: "JPY=X",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "엔",
      decimals: 1,
      url: "https://finance.yahoo.com/quote/JPY=X/",
      sourceLabel: "Yahoo Finance · JPY=X",
      what: "1달러를 사는 데 필요한 엔화입니다.",
      why: "싼 엔화를 빌려 다른 자산에 투자하는 '엔 캐리'가 세계 유동성의 한 축이라, 급변하면 시장 전체가 흔들립니다.",
      read: "엔이 급하게 강해지면(숫자가 급락하면) 캐리 자금이 되돌아오며 위험자산이 함께 흔들리는 일이 있었습니다.",
      order: 3,
    },
    {
      key: "usdcny",
      name: "위안/달러 환율",
      group: "fx",
      /** ⚠ 2026-09-05 FRED(DEXCHUS) → Yahoo. 이유는 바로 위 `usdjpy`와 같다(H.10 주간 발표). */
      source: "YAHOO",
      sourceId: "CNY=X",
      transform: "level",
      layer: "L2",
      type: "level",
      freq: "d",
      unit: "위안",
      decimals: 2,
      url: "https://finance.yahoo.com/quote/CNY=X/",
      sourceLabel: "Yahoo Finance · CNY=X",
      what: "1달러를 사는 데 필요한 위안화입니다.",
      why: "중국 경기와 수출 경쟁력의 신호이고, 원화는 위안화를 따라 움직이는 경향이 있습니다.",
      read: "위안 약세가 이어지면 원화도 같이 눌리는 국면이 많습니다.",
      order: 4,
    },
    {
      /**
       * ⭐ 2026-09-26 — GCRM 「달러 네트워크 지배력」의 `global_reserve_share`(가중 0.15)를 켜려고 붙였다.
       * 분모는 **배분된(통화가 확인된) 외환보유액**이다(IMF `AFXRA`). 미배분분까지 넣은 전체 보유액이 아니다 —
       * IMF가 COFER 달러 비중을 발표할 때 쓰는 기준과 같다.
       * ⚠ 날짜는 분기 첫날, 발표는 분기 끝나고 약 3개월 뒤다(2026-09-26 현재 최신 2026-Q1).
       */
      key: "cofer",
      name: "세계 외환보유액 중 달러 비중 (COFER)",
      group: "fx",
      source: "IMF",
      sourceId: "COFER:G001.AFXRA.CI_USD.SHRO_PT.Q",
      transform: "level",
      layer: "L1",
      type: "level",
      freq: "q",
      staleDays: 300,
      staleWhy:
        "분기 첫날로 적는데 IMF 발표가 분기 끝나고 약 3개월 뒤다. 다음 분기 값이 나오기 직전이면 첫날에서 약 9개월 — 기본 기한(228일)이면 정상인데도 매번 묵음 딱지가 뜬다. 한 분기(91일)를 늦추되 발표를 한 번 놓치면 뜨게 300일로 잡았다.",
      unit: "%",
      decimals: 1,
      url: "https://data.imf.org/en/datasets/IMF.STA:COFER",
      sourceLabel: "IMF COFER · 배분된 외환보유액 중 달러 비중",
      what: "세계 중앙은행들이 쌓아 둔 외환보유액(통화 구성이 확인된 부분) 가운데 미국 달러 자산이 차지하는 비율입니다. 분기마다 IMF가 냅니다.",
      why: "달러가 **기축통화로서 얼마나 붙들려 있는지**를 가장 직접 보여 줍니다. 비중이 줄면 세계가 달러 밖으로 조금씩 분산하고 있다는 뜻이고, 그만큼 미국 국채를 사 줄 구조적 수요가 얇아집니다. GCRM 「달러 네트워크 지배력」 기둥에 들어갑니다.",
      read: "1999년 70%대에서 2020년대 50%대 후반으로 내려왔습니다. ⚠ 환율에도 흔들립니다 — 달러가 강해지면 다른 통화 자산의 달러 환산액이 줄어 **팔지 않아도** 달러 비중이 오릅니다. 한 분기 움직임보다 몇 년의 흐름으로 보세요. ⚠ 발표가 분기 끝나고 약 3개월 늦습니다.",
      order: 5,
    },
  ],
};
