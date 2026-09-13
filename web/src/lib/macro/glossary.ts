/**
 * 용어 사전 — **독자가 직접 확인할 수 있게** 1차 출처를 단다.
 *
 * ## 왜 만드나
 * 화면이 「기간 프리미엄」·「단위노동비용」 같은 말을 쓰기 시작했는데, 그 말이 무엇인지와
 * **누가 그렇게 정의했는지**를 댈 자리가 없었다. 뜻을 모르면 숫자는 장식이고,
 * 출처를 못 대면 설명은 주장이다.
 *
 * ## ⚠ 이 파일의 규칙 — 셋 다 신뢰에 직접 걸린다
 * 1. ⚠ **확인한 링크만 싣는다.** 죽은 1차 출처 링크는 **없는 것보다 나쁘다** — 확인하러 간
 *    독자가 404를 보면, 확인할 수 있다는 약속 자체가 깨진다. `checked`에 확인한 날을 적는다.
 * 2. ⚠ **원 발표 기관을 댄다.** FRED는 훌륭한 배급처지만 **생산성을 만드는 곳은 BLS**다.
 *    2차 배급처만 대면 독자가 정의 자체를 따라갈 수 없다.
 * 3. ⚠ **우리가 만든 이름은 우리 것이라고 말한다**(`own: true`). 남의 권위를 빌리지 않는다.
 *    `PRYS`는 우리가 붙인 이름이고, 그렇게 적지 않으면 표준 지표처럼 읽힌다.
 *    (`^MOVE`를 MOVE라고 부르지 않기로 한 것과 같은 규범이다.)
 *
 * ## ⚠ 봇 차단과 죽은 링크는 다르다
 * BLS·CBO·CME는 스크립트 접근에 **403**을 낸다. 사람이 브라우저로 열면 열린다. 그래서
 * 「curl이 403」을 「죽었다」로 읽지 않는다 — 대신 **본문을 받아** 살아 있는지 본다.
 * ⚠ 그렇게도 확인이 안 된 출처는 **싣지 않는다**(2026-09-13 기준 CBO·CME가 여기 해당).
 */

/** 확인 방법. ⚠ 「확인했다」가 무슨 뜻인지 남겨 둔다. */
export type CheckMethod =
  /** HTTP 200 */
  | "status"
  /** 봇 차단(403)이라 본문을 받아 페이지가 살아 있음을 확인했다 */
  | "content";

export type GlossaryEntry = {
  /** 화면에 쓰는 말. ⚠ 본문에서 이 문자열로 찾아 링크를 건다 */
  term: string;
  /** 같은 것을 가리키는 다른 표기(영문·약어). 본문 매칭에 쓴다 */
  aka?: string[];
  /** 한 줄 뜻. ⚠ 두 줄이 되면 아무도 안 읽는다 */
  short: string;
  /** 왜 이 사이트가 이 말을 쓰나 — 엔진에서의 역할 */
  role?: string;
  /** 1차 출처. ⚠ `own`이면 없다 */
  url?: string;
  /** 누가 만든 정의인가 */
  sourceLabel: string;
  /** 링크를 확인한 날 `YYYY-MM-DD`. ⚠ `own`이 아니면 필수다 */
  checked?: string;
  checkMethod?: CheckMethod;
  /** ⭐ 우리가 붙인 이름인가. 참이면 화면이 「우리 정의」라고 말한다 */
  own?: boolean;
};

/**
 * ⚠ 이번에 화면이 **실제로 쓰는 말만** 넣었다. 쓰지 않는 용어를 미리 채우면
 *   확인하지 않은 링크가 섞이고, 그러면 이 파일의 약속이 깨진다.
 *   `잠재산출`(CBO)·`연방기금 선물`(CME)은 출처를 확인할 수 없어 **일부러 뺐다.**
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "노동생산성",
    aka: ["시간당 산출", "output per hour", "labor productivity"],
    short: "한 시간 일해서 얼마를 만들어 내는가. 미국 비농업 부문 기준입니다.",
    role: "공급 쪽 힘의 핵심 지표입니다. 이것이 오르면 같은 노동으로 더 많이 만들 수 있어, 수요를 줄이지 않고도 물가 압력이 낮아질 수 있습니다.",
    url: "https://www.bls.gov/productivity/",
    sourceLabel: "미 노동통계국(BLS) 생산성·비용 프로그램",
    checked: "2026-09-13",
    checkMethod: "content",
  },
  {
    term: "단위노동비용",
    aka: ["ULC", "unit labor cost"],
    short: "물건 하나를 만드는 데 드는 인건비입니다. 임금이 올라도 생산성이 더 오르면 내려갑니다.",
    role: "임금 상승이 물가로 번지는지를 가르는 자리입니다. 임금이 올라도 이 값이 얌전하면, 그 임금은 생산성이 내고 있는 것입니다.",
    url: "https://www.bls.gov/productivity/",
    sourceLabel: "미 노동통계국(BLS)",
    checked: "2026-09-13",
    checkMethod: "content",
  },
  {
    term: "실질금리",
    aka: ["실질 수익률", "TIPS 금리", "real yield"],
    short: "물가 상승분을 뺀 금리입니다. 물가연동국채(TIPS)가 시장에서 그 값을 매깁니다.",
    role: "투자가 넘어야 하는 문턱입니다. 사업이 벌어들이는 실질 수익이 이 값보다 낮으면, 빌려서 투자할 이유가 없어집니다.",
    url: "https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics",
    sourceLabel: "미 재무부 금리 통계(실질 수익률 곡선)",
    checked: "2026-09-13",
    checkMethod: "status",
  },
  {
    term: "명목 GDP",
    aka: ["nominal GDP", "경상 GDP"],
    short: "물가 상승분을 빼지 않은, 지금 돈 단위로 센 경제 규모입니다.",
    role: "부채를 갚는 힘은 실질이 아니라 **명목**으로 자랍니다. 세금도 이자도 명목으로 내기 때문에, 부채 지속가능성을 볼 때는 이쪽을 씁니다.",
    url: "https://www.bea.gov/data/gdp/gross-domestic-product",
    sourceLabel: "미 경제분석국(BEA)",
    checked: "2026-09-13",
    checkMethod: "status",
  },
  {
    term: "실효 연방기금금리",
    aka: ["EFFR", "실효금리"],
    short: "은행끼리 하루짜리 돈을 빌릴 때 **실제로 거래된** 금리입니다.",
    role: "연준이 발표하는 것은 목표 「범위」이고, 이것은 그 안에서 시장이 만든 결과입니다. 선물이 거래하는 대상도 이 값입니다.",
    url: "https://www.newyorkfed.org/markets/reference-rates/effr",
    sourceLabel: "뉴욕 연준 기준금리(EFFR)",
    checked: "2026-09-13",
    checkMethod: "status",
  },
  {
    term: "기간 프리미엄",
    aka: ["term premium", "텀 프리미엄"],
    short: "돈을 오래 빌려주는 위험을 감수하는 값으로 요구하는 추가 금리입니다.",
    role: "장기금리가 오를 때 그것이 「경기가 좋아서」인지 「위험이 커져서」인지를 가릅니다. 여기가 벌어지면 자본 조달 비용이 이유 없이 비싸집니다.",
    url: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs",
    sourceLabel: "뉴욕 연준 ACM 기간 프리미엄",
    checked: "2026-09-13",
    checkMethod: "status",
  },
  {
    term: "연준의 세 가지 책무",
    aka: ["dual mandate", "연준 책무", "제2A조"],
    short:
      "법은 **최대 고용 · 물가 안정 · 적정한 장기금리** 셋을 적었습니다. 흔히 「두 가지 책무」라 부르는 것은 관행적 축약어입니다.",
    role: "장기금리 관리는 「숨은」 책무가 아니라 **법에 쓰인** 책무입니다. 다만 연준이 특정 수준을 겨냥한다는 뜻은 아닙니다.",
    url: "https://www.federalreserve.gov/aboutthefed/section2a.htm",
    sourceLabel: "연방준비법 제2A조 (연준 공식 페이지)",
    checked: "2026-09-13",
    checkMethod: "status",
  },
  {
    /** ⭐ 우리가 붙인 이름이다. 표준 지표가 아니다. */
    term: "생산성–실질금리 격차",
    aka: ["PRYS"],
    short:
      "생산성이 벌어 주는 실질 수익률에서 돈을 빌리는 실질 비용을 뺀 값입니다. 0보다 크면 빌려서 투자할 값이 있습니다.",
    role: "AI 투자가 계속 굴러갈 수 있는지를 가르는 자리입니다. 0 아래로 내려가면 실질 자금비용이 생산성 수익을 넘어섭니다.",
    sourceLabel: "Woodsman 정의 (표준 지표가 아닙니다)",
    own: true,
  },
  {
    /** ⭐ 같은 이유로 우리 것이다. */
    term: "성장–조달 격차",
    aka: ["Growth-Funding Spread"],
    short: "명목 경제성장률에서 10년 국채 금리를 뺀 값입니다. 0보다 크면 경제가 이자보다 빨리 자랍니다.",
    role: "정부 부채가 굴러가는지를 봅니다. ⚠ 민간 투자 여력과는 **다른 질문**입니다 — 이 값이 플러스인데도 생산성–실질금리 격차는 마이너스일 수 있습니다.",
    sourceLabel: "Woodsman 정의 (표준 지표가 아닙니다)",
    own: true,
  },
];

const BY_TERM = new Map<string, GlossaryEntry>();
for (const entry of GLOSSARY) {
  BY_TERM.set(entry.term, entry);
  for (const alias of entry.aka ?? []) BY_TERM.set(alias, entry);
}

/** 용어나 별칭으로 찾는다. ⚠ 없으면 undefined — 화면은 링크 없이 그냥 글자로 둔다. */
export function findTerm(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term);
}

/** 화면에 쓸 출처 문구. ⚠ 우리 정의는 「우리 것」이라고 먼저 말한다. */
export function sourceNote(entry: GlossaryEntry): string {
  if (entry.own) return `${entry.sourceLabel} — 우리가 계산해 붙인 이름입니다.`;
  const how = entry.checkMethod === "content" ? "본문 확인" : "응답 확인";
  return `${entry.sourceLabel} · 링크 ${entry.checked} ${how}`;
}

/** 사전 순. 화면의 용어 목록이 쓴다. */
export function orderedGlossary(): GlossaryEntry[] {
  return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "ko"));
}
