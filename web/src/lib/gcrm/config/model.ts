/**
 * GCRM v2 — 모델 상수. **가중치와 임계는 설정 6벌에만 있다.** 계산 코드는 숫자를 모른다.
 * 명세: `docs/GCRM_설계점검_v2.md` §2-16.
 *
 * ## ⚠ 명세는 YAML을 말하지만 우리는 TS 데이터 파일이다
 * Worker는 실행 중에 파일을 읽지 못한다(`CLAUDE.md` §4 · `lib/scores/config.ts`가 같은 이유로
 * 같은 선택을 했다). **뜻은 그대로 지키고 형식만 바꿨다** — 숫자는 여기 한 곳에만 있고,
 * 바뀌면 `configHash()`가 바뀌며, 테스트가 합계를 대조한다.
 *
 * ## 용어 (명세 §2-1 · 원칙 1)
 * 조류 `tide` · 바람 `wind` · 파도 `wave`. **`current`라는 식별자를 만들지 않는다.**
 * 「현재 레짐」은 `active_regime`이다.
 */

export const MODEL_VERSION = "GCRM_2.0";

export type Axis = "tide" | "wind" | "wave";
export const AXES: readonly Axis[] = ["tide", "wind", "wave"] as const;

/**
 * 레짐 축 가중치.
 * - `core` — 종합 점수(§2-2 [4] overall)
 * - `transition` — 레짐 전이 증거 RTE. ⚠ **`wave`가 0이다**(§2-14 · B-10).
 *   파도가 뒷문으로 레짐을 바꾸지 못하게 하는 것이 이 모델의 가장 중요한 설계 판단이다.
 */
export const AXIS_WEIGHTS = {
  core: { tide: 0.5, wind: 0.35, wave: 0.15 },
  transition: { tide: 0.35, wind: 0.45, wave: 0.0, rts_slow: 0.2 },
} as const;

/**
 * 시간축 안에서 창(window)들을 합성하는 가중치 (§2-4).
 *
 * ⚠ **여기서만 쓴다.** `effective_weight = base_weight × staleness × evidence`에
 *   다시 곱하지 않는다 — 명세 B-6이 지적한 이중 계산이다.
 */
export const HORIZON_WEIGHTS = {
  tide: { M1: 0.35, M3: 0.3, M6: 0.2, M12: 0.15 },
  wind: { W1: 0.45, W4: 0.35, W13: 0.2 },
  wave: { D1: 0.5, D3: 0.3, D5: 0.2 },
} as const;

export type HorizonKey = "M1" | "M3" | "M6" | "M12" | "W1" | "W4" | "W13" | "D1" | "D3" | "D5";

/**
 * 창 길이 — ⚠ **일수가 아니라 관측 수**다. 공표 주기마다 다르다.
 *
 * 일수로만 두면 월간 지표에서 「3개월 창」이 63관측(≈5년)이 된다. 같은 이름의 창이
 * 계열마다 다른 기간을 뜻하게 되고, 그렇게 나온 점수를 나란히 놓으면 비교가 아니다.
 *
 * ⚠ **표에 없는 창은 그 주기에서 `MISSING`이다.** 0으로 채우지 않고 남은 창으로
 * 가중치를 재정규화한다. 예: 분기 지표에 1개월 창은 없다.
 */
export const HORIZON_OBS: Record<"d" | "w" | "m" | "q", Partial<Record<HorizonKey, number>>> = {
  // 일간 — 영업일 기준
  d: { M1: 21, M3: 63, M6: 126, M12: 252, W1: 5, W4: 20, W13: 65, D1: 1, D3: 3, D5: 5 },
  // 주간 — 파도는 없다(주간 계열로 하루를 볼 수 없다)
  w: { M1: 4, M3: 13, M6: 26, M12: 52, W1: 1, W4: 4, W13: 13 },
  // 월간 — 조류만
  m: { M1: 1, M3: 3, M6: 6, M12: 12 },
  // 분기 — 조류만. ⚠ 1개월 창이 없다
  q: { M3: 1, M6: 2, M12: 4 },
};

/**
 * 백분위를 재는 **창의 길이** — 모든 지표가 **같은 햇수**를 본다 (2026-09-24 운영자 결정).
 *
 * ## ⚠ 왜 「관측 수」가 아니라 「햇수」인가
 * 명세는 `max_window: 2500`(≈10년) 한 값만 적었고, 우리는 그것을 **빈도와 무관하게** 72개 지표에
 * 그대로 붙여 두고 있었다. 관측 수로 자르므로 뜻이 빈도마다 갈렸다 —
 * 일간은 10년, 주간은 48년, 월간은 208년, 분기는 625년. **일간 24개만 잘리고 나머지 42개는 안 잘렸다.**
 * 같은 기둥 안에서 「최근 10년 백분위」와 「가진 역사 전부의 백분위」가 섞여 있었다는 뜻이다.
 * (경위: `docs/분석_정규화창_역사시작점.md`)
 *
 * ## 왜 20년인가
 * ⭐ **2008년과 2020년이 둘 다 분포 안에 들어온다.** 위험전이·유동성 기둥에서 「극단이 무엇인가」는
 * 금융위기가 창 안에 있어야 정해진다. 10년(2016~)이면 금리 사이클이 **하나뿐**이고,
 * 2008년을 못 본 분포에서 「사상 최악」을 말하게 된다.
 *
 * ⚠ **20이라는 수는 아직 검증된 값이 아니다.** 근거는 위 한 줄(사이클 둘·위기 둘)뿐이고,
 *   「창을 흔들면 점수가 얼마나 흔들리나」는 **P9 민감도가 재야** 근거가 된다. 그때까지 이 값은
 *   「근거 있는 선택이지 검증된 값이 아니다」로 읽는다.
 *
 * ⚠ **모든 지표가 20년을 채우지는 못한다.** ICE 신용(3.2년)·SOFR(7.5~8.4년)은 소급이 불가능하다.
 *   그 사실은 지우지 않고 **신뢰도의 `depth`**가 드러낸다(`confidence.ts`) — 짧은 자로 낸 점수는
 *   짧다고 말한다. ⭐ 못 채우는 것을 숨기지 않는 것이 이 선택의 나머지 절반이다.
 */
export const WINDOW_YEARS = 20;

/** 빈도별 20년 = 관측 수. 일간은 영업일 250, 주간 52, 월간 12, 분기 4를 한 해로 본다. */
export const WINDOW_OBS: Record<"d" | "w" | "m" | "q", number> = {
  d: 250 * WINDOW_YEARS,
  w: 52 * WINDOW_YEARS,
  m: 12 * WINDOW_YEARS,
  q: 4 * WINDOW_YEARS,
};

/**
 * 창 평균 분포를 믿을 수 있는 최소 조건 (명세에 없다 — 여기서 정했다).
 *
 * ## ⚠ 왜 필요한가 — 겹친 창은 독립 관측이 아니다
 * 「12개월 창 평균의 백분위」를 3년 이력으로 매기면 창이 567개 나오지만, **겹치지 않는 창은 셋**이다.
 * 겹친 창들은 거의 같은 값이라 분포가 두꺼워 보일 뿐이다.
 *
 * 근거: 겹치는 관측을 쓰면 **유효 표본이 대략 `T/k`(표본 길이 ÷ 창 길이)로 줄고**, 겹침이 커질수록
 * 유의성이 실제보다 커 보인다는 것은 장기 시계열 회귀 문헌의 오래된 결과다
 * (Hansen–Hodrick 1980 이래 · Valkanov 2003 · Hjalmarsson 2004는 t값을 √k로 되돌릴 것을 제안한다).
 * ⚠ 그 문헌은 **회귀의 t값**에 관한 것이고 백분위 추정에 그대로 적용되지는 않는다.
 *   여기서 가져오는 것은 「유효 표본 ≈ T/k」라는 원리까지이고, **문턱은 우리가 정한 것**이다.
 *
 * ## `minNonOverlap: 10`의 근거
 * 우리는 점수를 **5점 단위로 반올림해** 보여 준다(`DISPLAY`). 그보다 굵은 주장을 하지 않으려면
 * 백분위가 최소한 **십분위(decile)는 가릴 수 있어야** 한다 → 독립 관측 10개.
 *
 * ⚠ 처음에 3으로 뒀다가 2026-09-19에 고쳤다. **실측해 보니 3에서는 어떤 지표의 어떤 창도 걸리지 않았다** —
 *   근거도 없고 일도 하지 않는 숫자였다. 10에서는 창 10칸이 빠지고(SOFR 계열·HY/IG OAS·VVIX·SKEW의 장기 창),
 *   어떤 지표도 축 자체를 잃지는 않는다.
 */
export const HORIZON_GUARD = {
  /**
   * 분포에 최소 이만큼의 창이 있어야 한다.
   * ⚠ 30은 통계에서 흔히 쓰는 어림수일 뿐이다. `minNonOverlap`이 실제 방어선이고 이것은 하한이다.
   */
  minWindows: 30,
  /** ⚠ 겹치지 않는 창의 최소 수. `관측 수 ≥ minNonOverlap × 창 길이`여야 한다(위 근거 참조). */
  minNonOverlap: 10,
  /**
   * 남은 창들의 가중치 합이 이보다 작으면 그 축은 `MISSING`이다.
   * ⚠ 근거 없는 숫자다 — 「절반은 남아야 대표한다」는 직관뿐이다. 민감도 분석(§2-15) 대상이다.
   */
  minHorizonCoverage: 0.5,
} as const;

/**
 * 신선도 판정 경계 — **공표 주기의 배수**다 (§2-5).
 * `k = (as_of − 관측일) / 공표주기`.
 */
export const STALENESS_CYCLES = {
  /** k < 0.5 — 방금 나온 값 */
  fresh: 0.5,
  /** k < 1 — 정상 공표주기 이내 */
  withinCycle: 1,
  /** k < 2 — 한 주기 경과 */
  oneCycleLate: 2,
  /** k < 3 — 두 주기 경과 */
  twoCyclesLate: 3,
} as const;

/**
 * 공표 주기(달력일).
 *
 * ⚠ 일간을 1일이 아니라 **4일**로 잡는다. 1일로 잡으면 금요일에 나온 값이 화요일에 벌써
 * 세 주기(MISSING)가 되어 주말마다 지표가 사라진다. 4일은 「주말 + 공휴일 하루」를 덮는 값이다.
 *
 * ⚠ 포털에는 이미 같은 성격의 숫자가 있다 — `lib/macro/freshness.ts`의
 * `STALE_RULE = { d: 7, w: 19, m: 75, q: 228 }`(이만큼 지나면 화면이 「묵음」 배지를 띄운다).
 * 두 숫자가 조용히 어긋나지 않도록 **테스트가 대조한다**(`CLAUDE.md` §2-1).
 * 관계는 「포털이 먼저 경고하고, 더 지나면 GCRM이 계산에서 뺀다」 —
 * 화면 경고와 계산 제외의 문턱은 같을 이유가 없다.
 */
export const CYCLE_DAYS: Record<"d" | "w" | "m" | "q", number> = { d: 4, w: 7, m: 31, q: 92 };

/**
 * 커버리지 게이트 (§2-6).
 * ⚠ `INSUFFICIENT`는 0이 아니다. 상위 집계의 **분모에서 빠진다.**
 */
export const GATES = {
  pillarMinCoverage: 0.6,
  axisMinCoverage: 0.7,
  overallMinCoverage: 0.7,
} as const;

/**
 * 방향 판정 (§2-8). `lag`는 영업일, `deadband`는 점수.
 * ⚠ 불감대가 없으면 소수점 아래 흔들림으로 **화살표가 매일 뒤집힌다.**
 */
export const DIRECTION = {
  lag: { tide: 63, wind: 20, wave: 5 },
  deadband: { tide: 2.0, wind: 2.0, wave: 3.0 },
} as const;

/** 정렬도 방향 일치 점수 (§2-9). 점수 구간이 아니라 **결정 트리**가 상태를 정한다. */
export const DIR_AGREEMENT = {
  allSame: 100,
  twoSameOneFlat: 75,
  twoSameOneOpposite: 35,
  otherwise: 0,
} as const;

/** 정렬도 구간 표시 (§2-9). 방향과 **반드시 함께** 보여 준다. */
export const ALIGNMENT_BANDS = [
  { min: 80, label: "강한 정렬" },
  { min: 65, label: "정렬" },
  { min: 45, label: "혼조" },
  { min: 25, label: "이탈" },
  { min: 0, label: "강한 이탈" },
] as const;

/**
 * 신뢰도 (§2-7). ⚠ **점수와 신뢰도를 곱하지 않는다.** 나란히 둘 뿐이다.
 * 화면에는 퍼센트가 아니라 밴드로 적는다(§D-1 — 버블 모니터와 정밀도 철학을 맞춘다).
 */
/**
 * 신뢰도 가중치.
 *
 * ⚠ 명세 §2-7의 넷은 `0.40·0.25·0.20·0.15`였다. 2026-09-24에 **다섯째 `depth`를 더하면서**
 *   넷의 **비율은 그대로 두고** 0.90배로 줄였다(0.40→0.36 …). 넷 사이의 상대적 뜻은 명세 그대로다.
 *
 * ## `depth` — 「말한 창을 얼마나 채웠나」
 * 창을 20년으로 통일했지만(`WINDOW_OBS`) 소급이 불가능해 못 채우는 지표가 있다.
 * ⚠ 커버리지는 이것을 못 잡는다 — **값이 있으면 켜진 것으로 센다.** 3.2년짜리 지표도
 *   커버리지에는 온전히 1로 들어간다. 그래서 「빈틈없다」로 읽히던 자리가 생겼다
 *   (2026-09-20 56: 바람의 100%가 일간 지표 둘에 얹혀 있던 일).
 *
 * ⚠ **0.10은 근거가 없다.** P9 민감도가 흔들어 보기 전에는 자리만 잡아 둔 값이다 —
 *   코드가 아니라 설정이 들고 있게 해서, 바꿀 때 지문이 바뀌고 이력에 남게 한다.
 */
export const CONFIDENCE_WEIGHTS = {
  coverage: 0.36,
  staleness: 0.225,
  evidence: 0.18,
  channelBreadth: 0.135,
  depth: 0.1,
} as const;

export const CONFIDENCE_BANDS = [
  { min: 85, label: "높음" },
  { min: 70, label: "보통" },
  { min: 55, label: "낮음" },
  { min: 0, label: "참고용" },
] as const;

/** 근거 계수 (§2-5 · C-4에서 6단계 → 4단계로 줄였다). */
export const EVIDENCE_FACTOR = {
  official: 1.0,
  market: 0.95,
  manual: 0.9,
  judgment: 0.7,
} as const;
export type EvidenceKind = keyof typeof EVIDENCE_FACTOR;

/**
 * 신선도 계수 (§2-5). **공표 주기 기준**으로 센다 —
 * 분기 지표를 하루 지났다고 깎지 않고, 일간 지표를 일주일 묵은 값으로 파도에 쓰지 않는다.
 */
export const STALENESS_FACTOR = {
  fresh: 1.0,
  withinCycle: 0.9,
  oneCycleLate: 0.7,
  twoCyclesLate: 0.5,
} as const;
/** 세 주기 이상 지나면 계수가 아니라 `MISSING`이다(분모에서 제외). */
export const STALE_DROP_CYCLES = 3;

/** 민감도 분석 (§2-15). */
export const SENSITIVITY = {
  /** 축 가중치 섭동 폭(pp). 나머지 둘은 **원래 비율대로 비례 재배분**한다. */
  axisDeltaPp: 5,
  /** 지표 `base_weight` 섭동 폭(비율). */
  indicatorDeltaRatio: 0.1,
  /** 이만큼 흔들리면 `MODEL_FRAGILITY_WARNING`. */
  fragileOverallDelta: 5,
  /** 한 지표가 기둥을 이만큼 움직이면 `DOMINANT_INDICATOR_WARNING`. */
  dominantPillarDelta: 3,
} as const;

/** 표시 규칙 (§D-1 · §2-20). 내부 저장은 소수 2자리, **화면은 5점 단위 정수**다. */
export const DISPLAY = {
  storeDecimals: 2,
  roundToNearest: 5,
} as const;
