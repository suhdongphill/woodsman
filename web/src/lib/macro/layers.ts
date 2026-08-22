/**
 * 인과 레이어 L0~L6 — 지표를 주제가 아니라 **메커니즘상의 위치**로 읽는다.
 *
 * 볼트 인수인계 사양서 [[지표 출처·신선도·판정원장]] §2-1의 `sectors.LAYERS`를 옮겨 온 것이다.
 * ⚠ 사양서 §7이 "layers 사전을 화면 쪽에 다시 하드코딩하지 말고 **데이터에서 읽을 것**"이라
 *    했다. 이 파일이 사이트 쪽의 그 데이터다 — 화면은 여기서만 읽는다.
 *
 * ## ⚠ 레이어는 시간 선행 주장이 아니다
 * L6이 아래에 있다고 **후행한다는 뜻이 아니다.** 다른 레이어의 상태를 사람이 보고한
 * 결과라는 뜻이다. (섹터 사양서 COMMON 규칙: 서베이는 선행지표가 아니라 확인지표다.)
 * 이 문장을 화면에도 그대로 낸다 — 안 적으면 "위에 있는 게 먼저 움직인다"로 읽힌다.
 */

export const MACRO_LAYER_KEYS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"] as const;
export type MacroLayer = (typeof MACRO_LAYER_KEYS)[number];

export type MacroLayerDef = {
  key: MacroLayer;
  label: string;
  /** 뜻 — 툴팁에 그대로 쓴다 */
  desc: string;
  /** 예시 지표(이 사이트에 있는 것으로 적는다) */
  examples: string;
};

export const MACRO_LAYERS: Record<MacroLayer, MacroLayerDef> = {
  L0: {
    key: "L0",
    label: "정책·제도",
    desc: "정책 당국이 직접 정하는 조건. 시장이 바꿀 수 없는 것.",
    examples: "기준금리, 규제, 발행계획",
  },
  L1: {
    key: "L1",
    label: "스톡·잔액",
    desc: "남아 있는 완충 여력. 흐름이 아니라 잔량이다.",
    examples: "준비금, TGA, 역레포, 원유재고",
  },
  L2: {
    key: "L2",
    label: "가격·할인율",
    desc: "시장이 즉시 반영하는 분모.",
    examples: "금리, 스프레드, 환율, 유가",
  },
  L3: {
    key: "L3",
    label: "실물 플로우",
    desc: "실제로 일어난 생산·소비·고용·투자.",
    examples: "CPI, 고용, 산업생산, CAPEX",
  },
  L4: {
    key: "L4",
    label: "자산가격",
    desc: "주가·지수·밸류에이션 그 자체.",
    examples: "SOX, 선행 PER",
  },
  L5: {
    key: "L5",
    label: "레버리지·변동성",
    desc: "움직임을 과장하는 계수.",
    examples: "VIX, MOVE, 미결제약정",
  },
  L6: {
    key: "L6",
    label: "심리·서베이",
    desc: "참여자가 보고한 체감. ⚠ 선행이 아니라 확인이다.",
    examples: "ISM, CCI, NAHB, 미시간",
  },
};

/** 화면에서 순서대로 돌 때 쓴다. */
export const MACRO_LAYER_LIST: MacroLayerDef[] = MACRO_LAYER_KEYS.map((k) => MACRO_LAYERS[k]);

/**
 * 지표의 성격.
 * - `level`  수준 그 자체
 * - `change` 변화율·증감
 * - `capacity_remaining` **남은 완충 여력** — ⚠ 해석이 뒤집히는 종류다
 *
 * ⚠ 스톡과 플로우를 같은 눈으로 읽으면 틀린다. "역레포 감소 = 유동성 공급"은
 *   **잔액이 남아 있을 때만** 성립하고, 고갈 구간에서는 같은 감소가 완충장치 소멸을 뜻한다.
 *   그래서 `capacity_remaining`은 뒤집히는 조건(`stateDependency`)을 쓰지 않으면
 *   `validateSectors()`가 로드 자체를 거부한다(볼트 §2-1과 같은 게이트).
 */
export type MacroIndicatorType = "level" | "change" | "capacity_remaining";

export function isMacroLayer(raw: string): raw is MacroLayer {
  return (MACRO_LAYER_KEYS as readonly string[]).includes(raw);
}

export function layerDef(key: MacroLayer): MacroLayerDef {
  return MACRO_LAYERS[key];
}

/** 레이어 순서로 정렬할 때의 서열. */
export function layerRank(key: MacroLayer): number {
  return MACRO_LAYER_KEYS.indexOf(key);
}

/** 레이어별로 묶는다 — 오버레이·목록에서 "어느 층을 보고 있나"를 낼 때 쓴다. */
export function groupByLayer<T extends { layer: MacroLayer }>(
  items: T[],
): { def: MacroLayerDef; items: T[] }[] {
  return MACRO_LAYER_LIST.map((def) => ({
    def,
    items: items.filter((i) => i.layer === def.key),
  })).filter((g) => g.items.length > 0);
}
