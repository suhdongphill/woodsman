/**
 * GCRM v2 — 설정 6벌을 한 자리에 모은다 (명세 §2-16).
 *
 * 명세의 `config/gcrm/{model,indicators,pillars,channels,regimes,promotion}.yaml`과
 * **하나씩 대응**한다. 이름을 맞춰 둔 이유는 명세와 코드를 나란히 놓고 읽기 위해서다.
 *
 * ⚠ 이 파일은 **모으기만** 한다. 검증은 `validate.ts`, 지문은 `hash.ts`다.
 */
import { GCRM_INDICATORS } from "./indicators";
import { GCRM_PILLARS } from "./pillars";
import { GCRM_CHANNELS, CONFIRMATION, CHANNEL_BREADTH_DENOMINATOR } from "./channels";
import { GCRM_REGIMES, REGIME_PRIORITY, REGIME_EDGES, DWELL_EXEMPT, BLOCK_TRANSITION_BELOW_COVERAGE } from "./regimes";
import { STAGES, WAVE_TO_WIND, WIND_TO_TIDE, ACUTE, RTS_SLOW } from "./promotion";
import {
  MODEL_VERSION,
  AXIS_WEIGHTS,
  HORIZON_WEIGHTS,
  HORIZON_DAYS,
  GATES,
  DIRECTION,
  DIR_AGREEMENT,
  ALIGNMENT_BANDS,
  CONFIDENCE_WEIGHTS,
  CONFIDENCE_BANDS,
  EVIDENCE_FACTOR,
  STALENESS_FACTOR,
  STALE_DROP_CYCLES,
  SENSITIVITY,
  DISPLAY,
} from "./model";

export * from "./model";
export * from "./indicators";
export * from "./pillars";
export * from "./channels";
export * from "./regimes";
export * from "./promotion";
export * from "./hash";

/**
 * 지문에 들어가는 설정의 전부.
 *
 * ⚠ **계산에 쓰는 값은 빠짐없이 여기 있어야 한다.** 빠진 값이 있으면 그 값을 고쳐도 지문이
 * 그대로라서, 「같은 설정인데 다른 숫자」가 나온다. 재현성이 장식이 되는 자리가 정확히 여기다.
 * ⚠ 표시 전용 값(`nameKo`·`note`·`historyNote`)도 넣는다 — 뺄 이유가 없고,
 *   빼기 시작하면 「무엇이 계산용인가」를 매번 판단해야 한다.
 */
export const GCRM_CONFIG = {
  model: {
    MODEL_VERSION,
    AXIS_WEIGHTS,
    HORIZON_WEIGHTS,
    HORIZON_DAYS,
    GATES,
    DIRECTION,
    DIR_AGREEMENT,
    ALIGNMENT_BANDS,
    CONFIDENCE_WEIGHTS,
    CONFIDENCE_BANDS,
    EVIDENCE_FACTOR,
    STALENESS_FACTOR,
    STALE_DROP_CYCLES,
    SENSITIVITY,
    DISPLAY,
  },
  indicators: GCRM_INDICATORS,
  pillars: GCRM_PILLARS,
  channels: { GCRM_CHANNELS, CONFIRMATION, CHANNEL_BREADTH_DENOMINATOR },
  regimes: {
    GCRM_REGIMES,
    REGIME_PRIORITY,
    REGIME_EDGES,
    DWELL_EXEMPT,
    BLOCK_TRANSITION_BELOW_COVERAGE,
  },
  promotion: { STAGES, WAVE_TO_WIND, WIND_TO_TIDE, ACUTE, RTS_SLOW },
} as const;

/** 명세의 파일 이름과 같은 순서. 지문은 이 순서로 직렬화된다. */
export const CONFIG_PARTS = ["model", "indicators", "pillars", "channels", "regimes", "promotion"] as const;
