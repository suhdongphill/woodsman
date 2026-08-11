/**
 * CANSLIM 채점 카탈로그 — 순수 값.
 *
 * `docs/canslim_스코링정책_v1.md`(개선판) + `references/scoring-rubrics.md`를 옮긴 것이다.
 *
 * ## ⚠ 어느 정책이 기준인가
 * 저장소에 채점 문서가 둘 있다. **개선판이 기준이다.**
 * `docs/CANSLIM_scoring_policy.md`(체슬리 C·A·N /75)는 개선판 §0-1이 "25/25/75 혼용 폐기"로
 * 명시적으로 대체했다. 두 눈금을 같이 쓰면 같은 종목이 두 점수를 갖게 된다.
 *
 * ## 왜 정의가 DB가 아니라 코드인가
 * 거시·버블과 같은 이유다 — 바뀌는 것은 **채점 결과**이지 항목·가중치·등급 경계가 아니다.
 * 그것들은 판단이 담긴 문장이라 버전 관리가 되는 편이 맞다. DB에는 보고서와 항목 점수만 쌓는다.
 */
import type { CanslimBand, CanslimItemDef, CanslimKey, DataTagDef } from "./types";

/**
 * 7항목 정의. ⚠ **가중치 합은 100이어야 한다**(테스트가 지킨다).
 * N을 75 → 15로 정상화하고, I는 리테일이 데이터를 구하기 어려워 10으로 낮춘 것이 개선판의 결정이다.
 */
export const CANSLIM_ITEMS: CanslimItemDef[] = [
  {
    key: "C",
    name: "Current — 최근 분기 실적",
    weight: 15,
    question: "가장 최근 분기에 이익이 실제로 늘었나?",
    rubric: "YoY ≥100% 10 · 50~100% 8~9 · 25~50% 6~7 · 10~25% 4~5 · 0~10% 2~3 · 음수 0~1",
    caveat:
      "가속이면 +1(상한 10). 매출은 정체인데 이익만 급증하면 −2(일회성·원가절감 의심). ⚠ 전년 동기가 적자·저점이면 YoY%는 허수라 회복률·QoQ로 대체하고 상한 8.",
    order: 1,
  },
  {
    key: "A",
    name: "Annual — 연간 이익 성장",
    weight: 15,
    question: "한 분기가 아니라 여러 해에 걸쳐 늘고 있나?",
    rubric: "3년 영업이익 CAGR을 C와 같은 구간표로 매핑",
    caveat:
      "⚠ 기준연도 영업이익이 0 이하면 **CAGR 사용 금지**(적자 기준연도에서 271% 같은 허수가 나온다). 적자→흑자 +3 · 3년 연속 개선 +3 · 전년비 +100%↑ 또는 전고점 회복 +2 · 차년 가이던스 성장 +2로 대체 채점하고, 회복 사이클이므로 상한 9.",
    order: 2,
  },
  {
    key: "N",
    name: "New — 신제품·신경영·신시장·신고가",
    weight: 15,
    question: "무엇이 새로워졌나? 그게 주가를 다시 매기게 하나?",
    rubric: "신제품 2.5 · 신경영/구조개편 2.5 · 신시장(TAM) 2.5 · 신고가/베이스 돌파 2.5",
    caveat:
      "해자 보정: 합리적 과점(소수 경쟁자)은 **감점이 아니라 +1**(상한 10). 경쟁 격화·진입장벽 붕괴는 −2. (기존 '경쟁기업 수 → 0점' 오류를 뒤집은 항목이다.)",
    order: 3,
  },
  {
    key: "S",
    name: "Supply & Demand — 수급",
    weight: 15,
    question: "사려는 힘과 팔려는 힘 중 어느 쪽이 센가?",
    rubric: "상승일 거래량 급증(평균 +40~50%↑)·축적 우위면 고점",
    caveat: "자사주 매입·유통주식 감소는 가점, 대량 신주발행·오버행은 감점. 유통주식이 적을수록 탄력 가점.",
    order: 4,
  },
  {
    key: "L",
    name: "Leader — 상대강도",
    weight: 15,
    question: "같은 업종에서 앞서가는 쪽인가, 따라가는 쪽인가?",
    rubric: "RS Rating 90↑ 9~10 · 80~89 7~8 · 70~79 5~6 · <70 ≤4",
    caveat: "업종 1~3등 + 50/200일선 위면 가점, 후발·이평선 하회면 감점.",
    order: 5,
  },
  {
    key: "I",
    name: "Institutional — 기관 수급",
    weight: 10,
    question: "돈을 크게 굴리는 쪽이 사 모으고 있나?",
    rubric: "기관 보유 수·순매수 증가 추세면 가점, 우량 펀드 신규 편입 가점",
    caveat:
      "과보유(over-owned)·기관 이탈은 감점. 가중치가 10인 이유는 개인이 이 데이터를 구하기 어려워서다.",
    order: 6,
  },
  {
    key: "M",
    name: "Market — 시장 방향",
    weight: 15,
    question: "시장 전체가 오르는 국면인가?",
    rubric: "Confirmed Uptrend 8~10 · 분산일 누적·조정장 ≤4",
    caveat:
      "⚠ **게이트 항목이다.** M ≤ 3이면 종합 점수와 무관하게 신규 매수 보류. 오닐: 4종목 중 3종목이 시장을 따라 움직인다.",
    order: 7,
  },
];

/**
 * 등급 밴드 — `composite10` 기준. 위에서부터 처음 `min` 이상인 구간이 등급이다.
 * ⚠ 경계는 8.0 / 6.5다. 화면이 이보다 후하게 판정하면 정책과 다른 말을 하는 것이다.
 */
export const CANSLIM_BANDS: CanslimBand[] = [
  { min: 8.0, grade: "우수", action: "비중확대 후보" },
  { min: 6.5, grade: "보통", action: "유지·관찰" },
  { min: 0, grade: "저조", action: "축소·제외" },
];

/**
 * 데이터 태그 — 정직성 원칙의 시각화(`references/report-format.md`).
 * ⚠ `na`는 **점수를 산출하지 않는다.** 0점이 아니라 분모에서 빠진다.
 */
export const DATA_TAGS: DataTagDef[] = [
  {
    key: "confirmed",
    label: "확인",
    note: "1차 자료로 검증한 수치. 출처와 기준일을 함께 적었습니다.",
    tone: "green",
  },
  {
    key: "needsCheck",
    label: "확인 필요",
    note: "추정이거나 기준일이 지난 값입니다. 쓰기 전에 원 자료로 다시 확인하세요.",
    tone: "amber",
  },
  {
    key: "na",
    label: "N/A",
    note: "데이터가 없어 채점하지 않았습니다. 0점이 아니라 계산에서 뺐습니다.",
    tone: "muted",
  },
];

/** M 게이트가 걸리는 점수 — 이하이면 보류. */
export const M_GATE_MAX = 3;

/** 점수 상·하한. ⚠ 0~10 한 눈금만 쓴다. */
export const POINT_MIN = 0;
export const POINT_MAX = 10;

export function findCanslimItem(key: string): CanslimItemDef | undefined {
  return CANSLIM_ITEMS.find((i) => i.key === key);
}

export function isCanslimKey(key: string): key is CanslimKey {
  return CANSLIM_ITEMS.some((i) => i.key === key);
}

export function findDataTag(key: string): DataTagDef | undefined {
  return DATA_TAGS.find((t) => t.key === key);
}

/** 화면·검증이 함께 쓰는 총 가중치. */
export const TOTAL_WEIGHT = CANSLIM_ITEMS.reduce((sum, i) => sum + i.weight, 0);
