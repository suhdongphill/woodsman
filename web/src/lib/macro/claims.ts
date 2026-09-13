/**
 * 주장 등급 — **어디까지가 사실이고 어디부터가 우리 해석인가.**
 *
 * ## 왜 만드나
 * 거시 이야기는 사실과 추론과 가설이 한 문단에 섞여 나온다. 섞이면 **가장 강한 주장이
 * 가장 약한 주장의 신뢰도까지 끌어내린다** — 법에 쓰인 사실 옆에 근거 없는 단정이 나란히
 * 있으면 독자는 둘 다 의심한다. 그래서 문장마다 등급을 달고, 사실에는 1차 출처를 붙인다.
 *
 * ## 등급
 * | 등급 | 뜻 | 요구 |
 * |---|---|---|
 * | `Fact` | 원문·공식 발표로 확인된다 | ⚠ **1차 출처 URL과 확인일이 반드시 있다** |
 * | `Inference` | 관측과 정합하지만 당사자가 그렇게 말한 적은 없다 | 왜 그렇게 읽는지 |
 * | `Hypothesis` | 우리(또는 시장)의 해석이다. 틀릴 수 있다 | 무엇을 보면 갈릴지 |
 * | `Rejected` | 흔히 말하지만 **사실이 아니다** | 왜 아닌지 |
 *
 * ## ⚠ `Rejected`를 굳이 싣는 이유
 * 「연준이 장기금리를 직접 통제한다」처럼 **그럴듯해서 자꾸 재등장하는 문장**이 있다.
 * 안 쓰기로만 하면 다음 사람이 또 쓴다. **틀렸다고 적어 두는 것이 규칙을 지키는 방법**이다
 * (요구서 §31의 금지 문장 목록을 여기로 옮겼다).
 */

export type ClaimGrade = "Fact" | "Inference" | "Hypothesis" | "Rejected";

/** 요구서의 경쟁가설. ⚠ 한 방향을 미리 정답으로 두지 않는다. */
export type HypothesisKey = "H1" | "H2" | "H3" | "H4" | "H5";

export const HYPOTHESIS_LABEL: Record<HypothesisKey, string> = {
  H1: "수요 먼저 — AI 투자가 생산성보다 먼저 물가를 올린다",
  H2: "생산성 주도 — 공급이 늘어 물가가 내린다",
  H3: "신용으로 굴리는 자본형성 — 재정이 민간 투자의 마중물이 된다",
  H4: "자본 구축(crowding-out) — 재정·AI 차입이 자본비용을 먼저 올린다",
  H5: "생산적 유인(crowding-in) — 공공투자가 민간투자를 불러온다",
};

export const GRADE_LABEL: Record<ClaimGrade, string> = {
  Fact: "사실",
  Inference: "추론",
  Hypothesis: "가설",
  Rejected: "사실 아님",
};

export type Claim = {
  id: string;
  /** 주장 문장 그대로 */
  statement: string;
  grade: ClaimGrade;
  /** 왜 그 등급인가 — ⚠ 등급만 달고 이유를 안 적으면 등급이 장식이 된다 */
  why: string;
  /** 1차 출처. ⚠ `Fact`면 필수다 */
  url?: string;
  sourceLabel?: string;
  /** 링크 확인일. ⚠ `Fact`면 필수다 */
  checked?: string;
  /** 이 주장이 걸린 가설 */
  hypothesis?: HypothesisKey[];
};

export const CLAIMS: Claim[] = [
  // ── 연준의 책무 ────────────────────────────────────────────────
  {
    id: "fed-mandate-three",
    statement:
      "연준의 법정 목표에는 최대 고용·물가 안정과 함께 **적정한 장기금리**가 들어 있다.",
    grade: "Fact",
    why: "연방준비법 제2A조 원문에 'moderate long-term interest rates'가 세 목표 중 하나로 적혀 있다. 흔히 말하는 「두 가지 책무(dual mandate)」는 관행적 축약어다.",
    url: "https://www.federalreserve.gov/aboutthefed/section2a.htm",
    sourceLabel: "연방준비법 제2A조 (연준 공식 페이지)",
    checked: "2026-09-13",
  },
  {
    id: "fed-mandate-potential",
    statement:
      "법은 통화·신용 총량을 **경제의 장기 생산 잠재력에 상응하게** 유지하라고 적었다.",
    grade: "Fact",
    why: "같은 제2A조 문장이다 — 'commensurate with the economy's long run potential to increase production'. 통화·신용을 잠재생산에 맞춘다는 문장이 법에 있다.",
    url: "https://www.federalreserve.gov/aboutthefed/section2a.htm",
    sourceLabel: "연방준비법 제2A조",
    checked: "2026-09-13",
    hypothesis: ["H2"],
  },
  {
    id: "fed-targets-10y",
    statement: "연준이 10년 국채 금리를 특정 수준으로 겨냥한다.",
    grade: "Rejected",
    why: "그런 목표를 발표한 적도, 규정에 둔 적도 없다. 「적정한 장기금리」가 법에 있다는 것과 「특정 수치를 겨냥한다」는 것은 다른 말이다.",
  },
  {
    id: "fed-manages-long-rates",
    statement:
      "연준이 대차대조표 축소 속도와 단기자금 운영으로 장기금리를 사실상 관리하고 있다.",
    grade: "Inference",
    why: "관측과 정합하고 시장이 널리 그렇게 읽는다. 다만 연준이 그 목적을 말한 적은 없고, 우리 화면으로 그 의도를 증명할 방법도 없다.",
  },
  {
    id: "fiscal-dominance",
    statement: "이것은 연준이 재무부의 부채 조달을 돕는 재정 지배(fiscal dominance)다.",
    grade: "Hypothesis",
    why: "시장의 해석이다. 무엇을 보면 갈리는가 — 물가가 목표를 넘는데도 장기금리 안정을 위해 긴축을 늦추는 선택이 반복되면 이 가설이 강해진다.",
    hypothesis: ["H3"],
  },

  // ── AI 투자와 물가 ────────────────────────────────────────────
  {
    id: "ai-capex-inflation",
    statement: "AI 자본지출이 전력·장비·건설 쪽 가격 압력을 만들고 있다.",
    grade: "Inference",
    why: "반도체·전력·제조업 건설 계열이 함께 오르는 것은 관측된다. 다만 그 상승분 중 얼마가 AI 때문인지를 우리 자료로 분리하지 못한다.",
    hypothesis: ["H1"],
  },
  {
    id: "ai-productivity",
    statement: "AI 도입이 미국 전체의 생산성을 끌어올리고 있다.",
    grade: "Hypothesis",
    why: "생산성 증가율이 실제로 높아지고 있으나, 그것이 AI 때문인지 다른 요인인지 총량 통계로는 가릴 수 없다. 산업별 생산성이 AI 도입률 높은 쪽에서 먼저 벌어지면 이 가설이 강해진다.",
    hypothesis: ["H2"],
  },
  {
    id: "supply-side-turn",
    statement: "미국 정부가 수요 억제에서 공급 확대 쪽으로 정책을 선회했다.",
    grade: "Inference",
    why: "보조금·산업정책의 방향으로는 그렇게 읽힌다. 그러나 공식적으로 그런 전환을 선언한 문서는 없다. **정책 의도를 단정하지 않는다.**",
    hypothesis: ["H2", "H3", "H5"],
  },

  // ── ⚠ 자꾸 재등장하는 틀린 문장들 (요구서 §31) ──────────────────
  {
    id: "productivity-instant-cpi",
    statement: "생산성이 오르면 물가가 곧바로 내려간다.",
    grade: "Rejected",
    why: "생산성은 잠재 공급을 늘릴 뿐이고, 물가는 그 공급이 실제로 쓰일 때 반응한다. 시차가 있고, 수요가 더 빨리 늘면 물가는 오히려 오른다.",
  },
  {
    id: "debt-is-liquidity",
    statement: "정부 부채가 늘면 그만큼 유동성이 늘어난다.",
    grade: "Rejected",
    why: "국채를 민간이 사면 예금이 재무부로 옮겨갈 뿐이다. 유동성이 되는지는 그 돈이 **어디로 쓰이고 은행이 신용을 만드는지**에 달려 있다. 그것을 재는 것이 신용창출 축이다.",
    hypothesis: ["H3", "H4"],
  },
  {
    id: "hike-always-right",
    statement: "물가가 오르면 금리 인상이 항상 맞는 대응이다.",
    grade: "Rejected",
    why: "공급 제약에서 온 물가는 수요를 줄여도 잘 안 내려가고, 대신 투자와 고용을 깎는다. 원인이 수요인지 공급인지를 먼저 갈라야 한다 — 이 화면이 하려는 일이 그것이다.",
    hypothesis: ["H1", "H2"],
  },
  {
    id: "ai-capex-always-productive",
    statement: "AI 자본지출은 언제나 생산성으로 돌아온다.",
    grade: "Rejected",
    why: "투자와 산출은 다른 숫자다. 과거 투자 붐에서도 상당 부분이 중복·과잉으로 남았다. 그래서 이 화면은 **투자(CAPEX)를 생산성으로 계산하지 않는다.**",
    hypothesis: ["H1", "H2"],
  },
];

const BY_ID = new Map(CLAIMS.map((c) => [c.id, c]));

export function findClaim(id: string): Claim | undefined {
  return BY_ID.get(id);
}

export function claimsByGrade(grade: ClaimGrade): Claim[] {
  return CLAIMS.filter((c) => c.grade === grade);
}

export function claimsFor(hypothesis: HypothesisKey): Claim[] {
  return CLAIMS.filter((c) => c.hypothesis?.includes(hypothesis));
}

/**
 * ⚠ `Fact`는 1차 출처와 확인일 없이 존재할 수 없다.
 *
 * 테스트가 이걸 부른다. 출처 없는 「사실」이 하나라도 섞이면 등급 체계 전체가 장식이 된다 —
 * 독자는 우리가 확인했는지 아닌지 구분할 방법이 없어진다.
 */
export function factsMissingSource(): Claim[] {
  return CLAIMS.filter((c) => c.grade === "Fact" && (!c.url || !c.checked));
}
