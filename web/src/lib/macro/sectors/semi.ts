/**
 * 반도체 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "semi",
      name: "반도체",
      emoji: "🔧",
      question: "이번 반도체 사이클은 어디쯤인가?",
      intro:
        "한국 증시는 반도체 사이클과 함께 움직입니다. 주가만 보면 늦고, 생산·신규주문·설비 가동률 같은 실물 지표를 같이 봐야 '수요가 진짜인지, 증설이 앞서간 것인지'가 보입니다. 증설이 수요를 앞지르면 생산이 사상 최고여도 가동률은 떨어집니다.",
      order: 10,
    },
  indicators: [
    {
      key: "semi_ip_yoy",
      name: "반도체 산업생산 (전년비)",
      group: "semi",
      source: "FRED",
      sourceId: "IPG3344S",
      transform: "yoy",
      layer: "L3",
      type: "change",
      freq: "m",
      unit: "%",
      decimals: 1,
      url: FRED("IPG3344S"),
      sourceLabel: "FRED · IPG3344S",
      what: "미국 반도체·전자부품 공장이 실제로 만들어 낸 양의 전년 대비 증감입니다.",
      why: "주가는 기대를 반영하지만 생산은 실제로 팔린 물량을 반영합니다. 사이클의 실물 쪽 축입니다.",
      read: "주가가 오르는데 생산이 안 따라오면, 기대가 실물보다 앞서 있다는 뜻입니다.",
      order: 1,
    },
    {
      key: "semi_util",
      name: "반도체 설비 가동률",
      group: "semi",
      source: "FRED",
      sourceId: "CAPUTLG3344S",
      transform: "level",
      layer: "L3",
      type: "level",
      freq: "m",
      unit: "%",
      decimals: 1,
      url: FRED("CAPUTLG3344S"),
      sourceLabel: "FRED · CAPUTLG3344S",
      what: "지어 놓은 반도체 생산 능력 중 실제로 돌리고 있는 비율입니다.",
      why: "증설이 수요를 앞지르면 생산이 사상 최고여도 가동률은 떨어집니다. 공급 과잉을 잡아내는 지표입니다.",
      read: "장기 평균선과 견줍니다. 생산은 느는데 가동률이 내려가면 증설이 앞서갔다는 신호입니다.",
      order: 2,
    },
    {
      key: "semi_orders_yoy",
      name: "컴퓨터·전자 신규주문 (전년비)",
      group: "semi",
      source: "FRED",
      sourceId: "A34SNO",
      transform: "yoy",
      layer: "L3",
      type: "change",
      freq: "m",
      staleDays: 95,
      staleWhy:
        "Census M3. 기준월 종료 후 약 5주 뒤 발표된다.",
      unit: "%",
      decimals: 1,
      url: FRED("A34SNO"),
      sourceLabel: "FRED · A34SNO",
      what: "컴퓨터·전자제품 분야에 새로 들어온 주문 금액의 전년 대비 증감입니다.",
      why: "주문은 생산보다 앞섭니다. 앞으로의 매출을 미리 보여줍니다.",
      read: "신규주문이 먼저 꺾이면 몇 달 뒤 생산과 실적이 따라 꺾이는 흐름이 반복돼 왔습니다.",
      order: 3,
    },
    {
      key: "sox",
      name: "필라델피아 반도체지수 (SOX)",
      group: "semi",
      source: "YAHOO",
      sourceId: "^SOX",
      transform: "level",
      layer: "L4",
      type: "level",
      freq: "d",
      unit: "pt",
      decimals: 0,
      url: "https://finance.yahoo.com/quote/%5ESOX/",
      sourceLabel: "Yahoo Finance · ^SOX",
      what: "미국에 상장된 대표 반도체 기업 30개의 주가를 묶은 지수입니다.",
      why: "한국 메모리 주가가 사실상 이 지수를 따라 움직입니다. 사이클의 기대 쪽 축입니다.",
      read: "위 실물 지표들과 함께 봅니다. 지수만 오르고 생산·주문이 안 따라오는 구간을 경계합니다.",
      order: 4,
    },
    {
      key: "hynix",
      name: "SK하이닉스 주가",
      group: "semi",
      source: "YAHOO",
      sourceId: "000660.KS",
      transform: "level",
      layer: "L4",
      type: "level",
      freq: "d",
      unit: "원",
      decimals: 0,
      url: "https://finance.naver.com/item/main.naver?code=000660",
      sourceLabel: "Yahoo Finance · 000660.KS",
      what: "국내 메모리 대표 종목의 주가입니다.",
      why: "HBM·서버 메모리 수요가 실적에 가장 먼저 반영되는 회사라, 사이클의 체온계 역할을 합니다.",
      read: "아래 선행 PER과 같이 봅니다. 이익 정점 부근에서는 주가가 올라도 PER이 낮아 보이는 착시가 생깁니다.",
      order: 5,
    },
    {
      key: "samsung",
      name: "삼성전자 주가",
      group: "semi",
      source: "YAHOO",
      sourceId: "005930.KS",
      transform: "level",
      layer: "L4",
      type: "level",
      freq: "d",
      unit: "원",
      decimals: 0,
      url: "https://finance.naver.com/item/main.naver?code=005930",
      sourceLabel: "Yahoo Finance · 005930.KS",
      what: "국내 시가총액 1위 종목의 주가입니다.",
      why: "지수 비중이 커서 코스피 전체의 방향과 사실상 같이 움직입니다.",
      read: "메모리 사이클과 지수 흐름을 한 화면에서 견주는 기준선으로 씁니다.",
      order: 6,
    },
    {
      key: "hynix_fwd_per",
      name: "SK하이닉스 추정 PER",
      group: "semi",
      /**
       * ⚠ 2026-09-05 **수동 → 자동(네이버 금융 「추정PER」)으로 바꿨다.**
       *
       * 수동으로 둔 동안 값이 **한 점도 들어오지 않았다.** 유료 컨센서스(FnGuide 등)가 필요하다고
       * 보고 미뤄 뒀는데, 네이버 금융 화면이 쓰는 공개 응답에 컨센서스 기반 **추정PER**이 그대로
       * 들어 있었다. Yahoo의 `quoteSummary`는 막혀 있지만(Invalid Crumb) 이쪽은 열려 있다.
       *
       * ⚠ **「12개월 선행」이 아니라 「추정(당해 컨센서스)」이다.** 이름과 출처 표기를 그에 맞게
       *    고쳤다 — 화면이 실제보다 정교한 척하지 않게 한다.
       * ⚠ 발표 계열이 아니라 **매일 다시 재는 관측**이라 과거 소급이 안 된다. 오늘부터 쌓인다.
       *    그래서 `freq`도 월간이 아니라 일간이다.
       */
      source: "NAVER",
      sourceId: "000660/추정PER",
      transform: "level",
      layer: "L4",
      type: "level",
      freq: "d",
      unit: "배",
      decimals: 1,
      url: "https://finance.naver.com/item/main.naver?code=000660",
      sourceLabel: "네이버 금융 · 추정PER(컨센서스)",
      what: "올해 예상 이익 대비 주가가 몇 배인지입니다(증권사 컨센서스 기준).",
      why: "싸 보이는지 비싸 보이는지를 한 숫자로 봅니다. 다만 경기 순환주에서는 함정이 있습니다.",
      read: "이익 정점 부근에서는 PER이 오히려 낮게 보입니다(고점 이익 함정). 낮은 PER 하나만으로 싸다고 읽지 않습니다.",
      order: 7,
    },
    {
      key: "samsung_fwd_per",
      name: "삼성전자 추정 PER",
      group: "semi",
      /**
       * ⚠ 2026-09-05 **수동 → 자동(네이버 금융 「추정PER」)으로 바꿨다.**
       *
       * 수동으로 둔 동안 값이 **한 점도 들어오지 않았다.** 유료 컨센서스(FnGuide 등)가 필요하다고
       * 보고 미뤄 뒀는데, 네이버 금융 화면이 쓰는 공개 응답에 컨센서스 기반 **추정PER**이 그대로
       * 들어 있었다. Yahoo의 `quoteSummary`는 막혀 있지만(Invalid Crumb) 이쪽은 열려 있다.
       *
       * ⚠ **「12개월 선행」이 아니라 「추정(당해 컨센서스)」이다.** 이름과 출처 표기를 그에 맞게
       *    고쳤다 — 화면이 실제보다 정교한 척하지 않게 한다.
       * ⚠ 발표 계열이 아니라 **매일 다시 재는 관측**이라 과거 소급이 안 된다. 오늘부터 쌓인다.
       *    그래서 `freq`도 월간이 아니라 일간이다.
       */
      source: "NAVER",
      sourceId: "005930/추정PER",
      transform: "level",
      layer: "L4",
      type: "level",
      freq: "d",
      unit: "배",
      decimals: 1,
      url: "https://finance.naver.com/item/main.naver?code=005930",
      sourceLabel: "네이버 금융 · 추정PER(컨센서스)",
      what: "올해 예상 이익 대비 주가 배수입니다(증권사 컨센서스 기준).",
      why: "메모리 사이클 정점의 이익이 얼마나 반영돼 있는지를 가늠합니다.",
      read: "하이닉스와 나란히 놓고 봅니다. 같은 사이클에서 두 회사의 배수 차이가 벌어지는 이유를 찾는 것이 출발점입니다.",
      order: 8,
    },
  ],
};
