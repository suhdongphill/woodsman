/**
 * 고용 섹터 — 묶음 정의와 지표를 **이 파일 하나에** 둔다.
 *
 * ⚠ 지표를 더하거나 임계값을 바꿀 때 다른 파일을 건드리지 않는다
 *    (볼트 인수인계 사양서 1-1: 흩어져 있으면 하나 추가에 여러 곳을 고치게 된다).
 *    새 섹터를 만들 때만 `registry.ts`에 한 줄 등록한다.
 */
import { FRED_URL as FRED, type MacroSector } from "../types";

export const sector: MacroSector = {
  group: {
      key: "jobs",
      name: "고용",
      emoji: "👷",
      question: "사람들이 일자리를 지키고 있나?",
      intro:
        "일자리가 있어야 소비가 있고, 소비가 있어야 기업 이익이 있습니다. 고용은 경기의 마지막 버팀목이라 무너지는 순간이 곧 침체의 시작입니다. 다만 후행하는 성격이 있어, 주간 실업수당 청구처럼 빠른 지표를 함께 봅니다.",
      order: 4,
    },
  indicators: [
    {
      key: "unrate",
      name: "실업률",
      group: "jobs",
      source: "FRED",
      sourceId: "UNRATE",
      transform: "level",
      layer: "L3",
      type: "level",
      freq: "m",
      unit: "%",
      decimals: 2,
      url: FRED("UNRATE"),
      sourceLabel: "FRED · UNRATE",
      what: "일할 의사가 있는 사람 중 일자리를 못 구한 사람의 비율입니다.",
      why: "고용이 무너지면 소비가 무너지고, 소비가 무너지면 기업 이익이 무너집니다. 경기의 마지막 버팀목입니다.",
      read: "절대 수준보다 **바닥에서 얼마나 올라왔는지**가 중요합니다. 0.5%p 이상 오르면 침체 신호로 봅니다(아래 SAHM 규칙).",
      headline: true,
      order: 1,
    },
    {
      key: "sahm",
      name: "SAHM 침체 규칙",
      group: "jobs",
      source: "FRED",
      sourceId: "SAHMREALTIME",
      transform: "level",
      layer: "L3",
      type: "change",
      freq: "m",
      unit: "",
      decimals: 2,
      url: FRED("SAHMREALTIME"),
      sourceLabel: "FRED · SAHMREALTIME",
      what: "실업률 3개월 평균이 최근 1년 최저치보다 얼마나 올라왔는지를 하나의 숫자로 만든 것입니다.",
      why: "과거 미국 침체를 거의 빠짐없이, 그것도 이른 시점에 잡아낸 규칙이라 연준도 참고합니다.",
      read: "0.50 이상이면 침체가 이미 시작됐을 가능성이 높다고 봅니다.",
      signal: { op: "gt", warn: 0.3, alert: 0.5, rule: "0.50 이상이면 침체 신호" },
      order: 2,
    },
    {
      key: "nfp_mom",
      name: "비농업 고용 (월간 증감)",
      group: "jobs",
      source: "FRED",
      sourceId: "PAYEMS",
      transform: "momdiff",
      layer: "L3",
      type: "change",
      freq: "m",
      unit: "천명",
      decimals: 0,
      url: FRED("PAYEMS"),
      sourceLabel: "FRED · PAYEMS",
      what: "농업을 뺀 미국 전체 일자리가 지난달보다 몇 개 늘었는지입니다(단위: 천 명).",
      why: "매달 첫 금요일에 나오는, 시장이 가장 크게 반응하는 고용 지표입니다.",
      read: "10만 명 안팎을 인구 증가를 흡수하는 최소선으로 봅니다. 계속 그 아래면 노동시장이 식고 있다는 뜻입니다.",
      order: 3,
    },
    {
      key: "claims",
      name: "신규 실업수당 청구",
      group: "jobs",
      source: "FRED",
      sourceId: "ICSA",
      transform: "levelK",
      layer: "L3",
      type: "level",
      freq: "w",
      unit: "천건",
      decimals: 0,
      url: FRED("ICSA"),
      sourceLabel: "FRED · ICSA",
      what: "이번 주에 처음으로 실업수당을 신청한 사람 수입니다.",
      why: "매주 나옵니다. 월간 지표가 나오기 전에 노동시장의 균열을 먼저 보여주는 가장 빠른 창입니다.",
      read: "40만 건을 넘어서면 해고가 본격화됐다고 보는 것이 통례입니다. 한 주 튀는 값보다 4주 흐름을 봅니다.",
      order: 4,
    },
    {
      key: "jolts",
      name: "JOLTS 구인건수",
      group: "jobs",
      source: "FRED",
      sourceId: "JTSJOL",
      // ⚠ JOLTS도 **이미 천건 단위**다(2026-06 = 7359 → 735.9만건). 위 ICSA(실제 건수)와 다르다.
      transform: "level",
      layer: "L3",
      type: "level",
      freq: "m",
      /**
       * ⚠ 2026-08-22 실측 보정, 2026-08-25 볼트와 맞추며 100 → 105.
       *   JOLTS는 BLS가 기준월 종료 후 **약 5~6주** 뒤에 낸다(6월분이 8월 초, 7월분이 9월 초).
       *   ⚠ 100은 **정상 상태의 최대 나이와 같은 값**이었다 — `2026-07-01` 관측이 다음
       *   발표(10월 초) 직전에 96~100일이 되므로, 여유가 0에 가까워 발표일 며칠 전마다
       *   기한초과가 뜬다. 볼트 `_scripts/sectors/macro.json`이 같은 계산으로 105를 쓰고
       *   있어 그쪽에 맞췄다. **오탐 한 건이 미탐 열 건보다 비싸다**(freshness.ts §1-7).
       */
      staleDays: 105,
      staleWhy:
        "BLS JOLTS는 기준월 종료 후 약 5~6주 뒤 발표된다(7월분이 9월 초). 정상 상태의 최대 나이가 약 100일이라 여유 5일을 더했다 — 기본 75일로 재면 정상 발표 중에도 기한초과로 뜬다.",
      unit: "천건",
      decimals: 0,
      url: FRED("JTSJOL"),
      sourceLabel: "FRED · JTSJOL",
      what: "기업이 사람을 뽑겠다고 내건 빈 일자리 수입니다.",
      why: "해고가 늘기 전에 '새로 안 뽑는' 단계가 먼저 옵니다. 그 단계를 보여줍니다.",
      read: "실업자 수와 견줘 봅니다. 빈 일자리가 실업자보다 많으면 아직 사람이 귀한 시장입니다.",
      order: 5,
    },
  ],
};
