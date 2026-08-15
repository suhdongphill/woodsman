/**
 * 종목분석 보고서의 **구조** — 순수 값.
 *
 * `docs/종목분석_보고서_설계서_v1.md` §3(섹션)·§4(정직성 규율)를 옮긴 것이다.
 *
 * ## 왜 DB가 아니라 코드인가
 * 거시·버블·CANSLIM과 같은 이유다 — 바뀌는 것은 **보고서 내용**이지 섹션 구성이나 규율이 아니다.
 * 그것들은 판단이 담긴 문장이라 버전 관리가 되는 편이 맞다. D1에는 내용만 쌓는다.
 *
 * ## ⚠ 설계서와 어긋나는 한 가지 (2026-08-15 기록)
 * 설계서 §3의 제목은 "10섹션"인데 표에는 **§00~§12(13개)** 가 있다. 표가 실제 모델이므로
 * 표를 따랐다. 설계서 제목이 옛 초안의 흔적으로 보인다 — 다음 개정 때 제목을 고치는 편이 좋다.
 */
import type { HonestyRuleDef, ReportSectionDef } from "./types";

/**
 * 13섹션. `required`가 `true`면 **비면 발행할 수 없다.**
 *
 * 설계서 §3: "§00·§01·§09·§10은 필수, 나머지는 종목 성격에 따라 선택"
 * (사이클 종목은 §03이 두껍고, 보유 종목은 §09가 두껍다).
 * ⚠ §11 체크리스트와 §12 푸터도 필수로 뒀다 — 설계서 문장에는 없지만,
 *    미확정 항목을 안 적으면 R7(다음 판단 시점)이 공허해지고,
 *    푸터의 투자자문업 미인가 고지는 `/disclaimer`와 연결된 법적 고지다. 뺄 수 없다.
 */
export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    key: "header",
    no: "00",
    name: "헤더",
    required: true,
    question: "무슨 종목이고, 한 줄로 무슨 이야기인가?",
    devices: ["종목명 + 티커", "한 줄 논지", "작성일·산업·비교군", "⚠ 근사치 고지"],
    numeric: false,
    rules: ["R5"],
    order: 0,
  },
  {
    key: "summary",
    no: "01",
    name: "Investment Summary",
    required: true,
    question: "결론이 무엇이고, 그 판정은 언제 철회되나?",
    devices: ["판정 배지 2종(구조/단기)", "논지 2~3문단", "⚠ 철회 조건"],
    numeric: false,
    rules: ["R3"],
    order: 1,
  },
  {
    key: "marketPosition",
    no: "02",
    name: "시장 위치",
    required: false,
    question: "지금 어디에 서 있나?",
    devices: ["히어로 KPI 4(현재가·등락·52주 범위·시총)", "속보 박스", "거래량 배수"],
    numeric: true,
    rules: ["R5"],
    order: 2,
  },
  {
    key: "industry",
    no: "03",
    name: "산업 분석",
    required: false,
    question: "이 산업은 사이클의 어디쯤인가?",
    devices: ["KPI 타일", "시계열 차트", "⚠ 사이클 판독(ΔYoY — 레벨이 아니라 기울기)", "계절성 검증"],
    numeric: true,
    rules: ["R5"],
    order: 3,
  },
  {
    key: "company",
    no: "04",
    name: "기업 분석",
    required: false,
    question: "이익이 실제로 늘고 있고, 그 이익의 성격은 무엇인가?",
    devices: ["3개년 재무 표(추세·CAGR)", "이익의 성격", "사업 구조", "CANSLIM C·A축 검산"],
    numeric: true,
    rules: ["R1", "R5"],
    order: 4,
  },
  {
    key: "moat",
    no: "05",
    name: "해자와 병목",
    required: false,
    question: "무엇이 이 회사를 지켜 주고, 무엇이 발목을 잡나?",
    devices: [
      "5단 분석(기술·전환비용·신사업·⚠ 약점·병목)",
      "⚠ 해자를 주장이 아니라 **경쟁사 탈락의 역사**로 증명",
      "한 줄 압축 판정",
    ],
    numeric: false,
    rules: [],
    order: 5,
  },
  {
    key: "competition",
    no: "06",
    name: "경쟁 구도",
    required: false,
    question: "같은 판의 다른 회사와 나란히 놓으면 어떤가?",
    devices: ["피어 매트릭스(포지션·강점·약점)", "확정 실적 병렬 비교", "구조 판정"],
    numeric: true,
    rules: ["R5"],
    order: 6,
  },
  {
    key: "valuation",
    no: "07",
    name: "밸류에이션",
    required: false,
    question: "지금 가격은 무엇을 이미 반영하고 있나?",
    devices: [
      "멀티플 밴드 + ROE 병기",
      "이론값과 현실의 괴리를 숫자로",
      "5각도 교차검증",
      "⚠ **방법론 한계 고백**",
      "⚠ 목표주가는 제3자 공표치 인용만",
    ],
    numeric: true,
    rules: ["R4", "R5", "R6"],
    order: 7,
  },
  {
    key: "flow",
    no: "08",
    name: "수급",
    required: false,
    question: "사려는 힘과 팔려는 힘 중 어느 쪽이 센가?",
    devices: [
      "⚠ **미조회 고지 + 빈 프레임 + 조회처**(설계서에서 가장 중요한 장치)",
      "판독 기준표(관측 → CANSLIM I축 환산)",
    ],
    numeric: true,
    rules: ["R2", "R5"],
    order: 8,
  },
  {
    key: "scenario",
    no: "09",
    name: "시나리오 · 대응",
    required: true,
    question: "어떤 조건이면 어떻게 하나?",
    devices: [
      "강세/기본/약세 조건부 산식",
      "Envelope 대응 표",
      "계절성 표",
      "⚠ **시계 분리**(중장기 / 단기)",
    ],
    numeric: true,
    rules: ["R5"],
    order: 9,
  },
  {
    key: "sizing",
    no: "10",
    name: "비중 조절 프레임",
    required: true,
    question: "얼마나 담고, 언제 줄이나?",
    devices: [
      "확대 근거 / 유지 / 축소 트리거",
      "손절 규율(숫자로)",
      "⚠ 의사결정 대행이 아니라 **조건-대응**",
    ],
    numeric: false,
    rules: ["R3"],
    order: 10,
  },
  {
    key: "checklist",
    no: "11",
    name: "미확정 체크리스트",
    required: true,
    question: "아직 모르는 것은 무엇이고, 어디서 확인하나?",
    devices: ["`항목 · 소스 · 영향` 표", "그대로 다음 갱신의 작업 목록이 된다"],
    numeric: false,
    rules: ["R2", "R7"],
    order: 11,
  },
  {
    key: "footer",
    no: "12",
    name: "푸터",
    required: true,
    question: "이 숫자들은 어디서 왔고, 이 글의 법적 성격은 무엇인가?",
    devices: ["항목별 수치 출처", "⚠ 투자자문업 미인가 고지(`/disclaimer`와 연결)"],
    numeric: false,
    rules: ["R5"],
    order: 12,
  },
];

/**
 * 정직성 규율 7가지. **형식은 베낄 수 있지만 규율은 코드가 강제해야 유지된다.**
 * 실제 검증은 `lib/report/rules.ts`가 한다.
 */
export const HONESTY_RULES: HonestyRuleDef[] = [
  {
    key: "R1",
    title: "결측은 분모에서 뺀다",
    why: "N/A를 0점으로 치면 '아직 안 본 것'이 '나쁜 것'이 된다. 채점을 미룬 종목이 자동으로 저조 등급을 받는다.",
    enforcedBy: "lib/canslim/score.ts (여기서 다시 판정하지 않는다 — 같은 판단을 두 번 구현하지 않는다)",
  },
  {
    key: "R2",
    title: "모르면 비워 두고 조회처를 적는다",
    why: "추정치로 칸을 채우는 순간 그게 지어낸 숫자가 된다. 빈칸 + 조회처는 정직하면서도 화면이 비어 보이지 않는 유일한 방법이다.",
    enforcedBy: "lib/report/rules.ts — 본문이 비었는데 조회처가 없으면 발행 차단",
  },
  {
    key: "R3",
    title: "판정에는 철회 조건이 붙는다",
    why: "반증 조건 없는 판정은 판정이 아니라 소감이다. 무엇이 관측되면 이 판정을 접을지 미리 적는다.",
    enforcedBy: "lib/report/rules.ts — 구조 판정이 있으면 `revokeIf` 필수",
  },
  {
    key: "R4",
    title: "목표주가는 우리가 만들지 않고 제3자 공표치를 인용한다",
    why: "`WOODSMAN_DOCTRINE`이 금지하는 것은 **우리가 제시하는 것**이다. 제3자가 공표한 수치를 출처·기준일과 함께 옮기는 것은 사실 보도다. 날짜 없는 목표주가는 우리 의견처럼 읽힌다.",
    enforcedBy: "lib/report/rules.ts — 컨센서스에 출처·기준일 필수, 우리 산출값은 '목표주가'라 부르지 않는다",
  },
  {
    key: "R5",
    title: "확정과 추정을 문장에서 구분한다",
    why: "같은 표 안에 감사보고서 확정치와 리서치 추정치가 섞여 있으면 읽는 사람은 전부 확정으로 읽는다.",
    enforcedBy: "lib/report/rules.ts — 수치 섹션은 데이터 태그 필수",
  },
  {
    key: "R6",
    title: "방법론의 한계를 같이 쓴다",
    why: "신뢰는 결론이 아니라 한계 고백에서 나온다. PBR은 수주 모멘텀 기업에 본질적 한계가 있고, 그걸 안 쓰면 결론만 남는다.",
    enforcedBy: "lib/report/rules.ts — 밸류에이션 섹션이 있으면 `valuationLimitation` 필수",
  },
  {
    key: "R7",
    title: "다음 판단 시점을 날짜로 남긴다",
    why: "'지켜본다'는 지켜보지 않는다는 뜻이다. 날짜가 있어야 갱신이 일어난다.",
    enforcedBy: "lib/report/rules.ts — `nextCheckAt` 필수 + §11 체크리스트",
  },
];

export function findReportSection(key: string): ReportSectionDef | undefined {
  return REPORT_SECTIONS.find((s) => s.key === key);
}

export function findHonestyRule(key: string): HonestyRuleDef | undefined {
  return HONESTY_RULES.find((r) => r.key === key);
}

/** 발행에 반드시 필요한 섹션들. */
export const REQUIRED_SECTIONS = REPORT_SECTIONS.filter((s) => s.required);

/** ⚠ 데이터 태그가 필요한 섹션들(R5). */
export const NUMERIC_SECTIONS = REPORT_SECTIONS.filter((s) => s.numeric);

/**
 * 국장 티커 모양. ⚠ **6자리 숫자 문자열**이다. 숫자로 다루면 `005930` → `5930`이 된다.
 */
export const KR_TICKER_PATTERN = /^[0-9]{6}$/;

/** 미장 티커 모양(클래스 주식의 `.`·`-` 포함). */
export const US_TICKER_PATTERN = /^[A-Z][A-Z.-]{0,9}$/;
