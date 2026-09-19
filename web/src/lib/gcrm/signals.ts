/**
 * GCRM v2 — 채널 확인 · 신호 승격 · 급성 경보 (명세 §2-10 ~ §2-12). 순수 함수.
 *
 * ## ⚠ 이 파일이 막는 실패 모드
 * 위험회피 국면에서 SOX · VIX · S&P · VVIX는 **함께 움직인다.** 넷을 「4개 시장의 확인」으로 세면
 * 하나의 요인을 네 번 센 것이고, **확신만 커지고 정보는 늘지 않는다**(명세 B-9).
 * 그래서 확인은 **서로 다른 채널** 기준으로 세고, 같은 채널 안은 몇 개가 움직이든 **1표**다.
 *
 * ## 승격은 인과가 아니라 시간 창 전파다 (§A-2)
 * 파도가 바람을 「일으킨」 것이 아니다. 같은 계열을 5일 창으로 보면 파도, 13주 창으로 보면 바람이다.
 * 승격이란 **짧은 창의 부호가 긴 창에서도 같아졌다**는 관찰이고, 그래서 계산 가능한 질문이 된다.
 *
 * ## ⚠ 급성 경보는 레짐을 바꾸지 않는다 (§2-12)
 * 백분위는 상한이 100이라 한 지표가 기둥을 지배하지 못하는 대신 **극단의 강도를 잃는다** —
 * VIX 41과 VIX 78이 백분위로는 둘 다 99번째다. 그 차이를 잡는 자리가 **원시값 임계**다.
 * 그러나 잡은 결과로 레짐 코드를 건드리지는 않는다. 배너만 띄운다.
 * 승격 경로와는 **독립**이라 둘 다 동시에 켜질 수 있다.
 */
import { GCRM_INDICATOR_BY_CODE, type ChannelCode } from "./config/indicators";
import { CONFIRMATION, countChannels, weightedConfirmation } from "./config/channels";
import { WAVE_TO_WIND, WIND_TO_TIDE, ACUTE, STAGES, type StageCode } from "./config/promotion";
import type { Direction } from "./alignment";

/** 한 지표가 한 방향으로 움직였다는 관찰. */
export type Movement = {
  indicator: string;
  direction: Direction;
};

/** 지표 코드에서 채널을 읽는다. ⚠ 채널을 인자로 따로 받지 않는다 — 두 곳에 적으면 어긋난다. */
export function channelsOf(indicator: string): ChannelCode[] {
  return GCRM_INDICATOR_BY_CODE.get(indicator)?.channels ?? [];
}

export type Confirmation = {
  /** 서로 다른 채널 수. ⚠ 같은 채널 안의 지표가 몇 개든 1이다 */
  channelCount: number;
  channels: ChannelCode[];
  /** PRICE+CREDIT+FUNDING이 모두 있으면 1.25배 */
  weighted: number;
  hasCombo: boolean;
  /** 채널별로 어떤 지표가 표를 만들었는지 — 화면이 「왜 3채널인가」를 말할 수 있어야 한다 */
  byChannel: Record<string, string[]>;
};

/**
 * 확인 집계 (§2-10).
 *
 * ⚠ **방향이 섞인 것을 한 채널로 묶지 않는다.** 같은 채널에서 하나는 우호, 하나는 스트레스로
 * 움직였다면 그 채널은 확인이 아니다. 그래서 `direction`을 받아 방향별로 센다.
 */
export function confirmationOf(movements: Movement[], direction: Direction): Confirmation {
  const byChannel: Record<string, string[]> = {};
  const channels: ChannelCode[] = [];
  for (const m of movements) {
    if (m.direction !== direction) continue;
    for (const c of channelsOf(m.indicator)) {
      if (!byChannel[c]) {
        byChannel[c] = [];
        channels.push(c);
      }
      byChannel[c].push(m.indicator);
    }
  }
  const set = new Set(channels);
  return {
    channelCount: countChannels(channels),
    channels: [...set],
    weighted: weightedConfirmation(channels),
    hasCombo: CONFIRMATION.weightedCombo.every((c) => set.has(c)),
    byChannel,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 승격 (§2-11)
// ─────────────────────────────────────────────────────────────────────────

export type PromotionCheck = {
  ok: boolean;
  /** 못 올라간 이유들. ⚠ 통과해도 비어 있지 않을 수 있다(정보용) */
  reasons: string[];
  detail: Record<string, number | boolean | string[]>;
};

/**
 * 파도 경보 → 바람 확인.
 *
 * ```text
 * 5영업일 중 3일 이상 같은 방향  AND  서로 다른 3개 채널
 * ```
 * @param recentDirections 최근 영업일 방향(최신이 **마지막**). 5개 미만이면 판정하지 않는다
 */
export function waveToWind(
  recentDirections: (Direction | undefined)[],
  movements: Movement[],
  direction: Direction,
): PromotionCheck {
  const reasons: string[] = [];
  const window = recentDirections.slice(-WAVE_TO_WIND.windowDays);
  const sameDays = window.filter((d) => d === direction).length;

  if (window.length < WAVE_TO_WIND.windowDays) {
    reasons.push(`관측일이 ${window.length}일뿐이다(필요 ${WAVE_TO_WIND.windowDays}일) — 판정하지 않는다`);
  }
  if (sameDays < WAVE_TO_WIND.minDays) {
    reasons.push(`같은 방향이 ${sameDays}일(필요 ${WAVE_TO_WIND.minDays}일)`);
  }
  const conf = confirmationOf(movements, direction);
  if (conf.channelCount < WAVE_TO_WIND.minChannels) {
    reasons.push(
      `확인 채널이 ${conf.channelCount}개(필요 ${WAVE_TO_WIND.minChannels}개) — ` +
        `같은 채널 안의 지표는 몇 개든 1표다`,
    );
  }
  return {
    ok: reasons.length === 0,
    reasons,
    detail: { sameDays, windowLength: window.length, channelCount: conf.channelCount, channels: conf.channels },
  };
}

/**
 * 바람 확인 → 조류 이동.
 *
 * ```text
 * 3주 이상 지속  AND  서로 다른 3개 채널  AND  구조·실물 지표 1개 이상 동조
 * ```
 * ⚠ 금융 가격만으로는 조류가 옮겨 갔다고 말하지 않는다 — 가격은 되돌아온다.
 */
export function windToTide(
  persistenceWeeks: number,
  movements: Movement[],
  direction: Direction,
): PromotionCheck {
  const reasons: string[] = [];
  if (persistenceWeeks < WIND_TO_TIDE.minWeeks) {
    reasons.push(`지속이 ${persistenceWeeks}주(필요 ${WIND_TO_TIDE.minWeeks}주)`);
  }
  const conf = confirmationOf(movements, direction);
  if (conf.channelCount < WIND_TO_TIDE.minChannels) {
    reasons.push(`확인 채널이 ${conf.channelCount}개(필요 ${WIND_TO_TIDE.minChannels}개)`);
  }
  const structural = movements
    .filter((m) => m.direction === direction)
    .map((m) => m.indicator)
    .filter((code) => (WIND_TO_TIDE.structuralIndicators as readonly string[]).includes(code));
  if (structural.length < WIND_TO_TIDE.minStructuralConfirmations) {
    reasons.push(
      `구조·실물 지표 동조가 ${structural.length}개(필요 ${WIND_TO_TIDE.minStructuralConfirmations}개) — ` +
        "금융 가격만으로는 조류가 옮겨 갔다고 말하지 않는다",
    );
  }
  return {
    ok: reasons.length === 0,
    reasons,
    detail: {
      persistenceWeeks,
      channelCount: conf.channelCount,
      channels: conf.channels,
      structural,
    },
  };
}

export type StageResult = {
  stage: number;
  code: StageCode;
  nameKo: string;
  /** 왜 여기서 멈췄는가 */
  blockedBy: string[];
};

const stageAt = (n: number) => STAGES[n];

/**
 * 성숙도 판정 — 아래에서부터 조건을 통과하는 만큼 올라간다.
 *
 * ⚠ **건너뛰지 않는다.** 파도 경보를 거치지 않고 바람 확인으로 갈 수 없다 —
 * 승격은 「짧은 창에서 본 것이 긴 창에서도 보인다」의 누적이기 때문이다.
 */
export function maturityStage(input: {
  /** 파도 경보가 떠 있는가 (파도 축에서 방향이 잡혔는가) */
  waveAlert: boolean;
  recentDirections: (Direction | undefined)[];
  persistenceWeeks: number;
  movements: Movement[];
  direction: Direction;
  /** 레짐 상태 기계가 확정했는가 (P6에서 채운다) */
  regimeConfirmed?: boolean;
}): StageResult {
  if (!input.waveAlert) {
    return { ...stageAt(0), blockedBy: ["파도 축에서 방향이 잡히지 않았다"] };
  }
  const toWind = waveToWind(input.recentDirections, input.movements, input.direction);
  if (!toWind.ok) return { ...stageAt(1), blockedBy: toWind.reasons };

  const toTide = windToTide(input.persistenceWeeks, input.movements, input.direction);
  if (!toTide.ok) return { ...stageAt(2), blockedBy: toTide.reasons };

  if (!input.regimeConfirmed) {
    return { ...stageAt(3), blockedBy: ["레짐 상태 기계가 아직 확정하지 않았다(P6)"] };
  }
  return { ...stageAt(4), blockedBy: [] };
}

// ─────────────────────────────────────────────────────────────────────────
// 급성 경보 (§2-12)
// ─────────────────────────────────────────────────────────────────────────

/** 원시값 관측. ⚠ 백분위가 아니다. */
export type RawReading = {
  indicator: string;
  /** 수준 */
  level?: number;
  /** n영업일 변화. 키가 임계의 `changeDays`와 맞아야 한다 */
  changes?: Record<number, number>;
};

export type AcuteTrigger = {
  indicator: string;
  channel: ChannelCode;
  op: "gte" | "lte";
  threshold: number;
  actual: number;
  unit: string;
  note?: string;
};

export type AcuteResult = {
  /** `ACUTE_TRANSITION_WATCH` */
  watch: boolean;
  triggers: AcuteTrigger[];
  channels: ChannelCode[];
  channelCount: number;
  /**
   * ⚠ **항상 `false`다.** 타입이 리터럴이라 컴파일러가 다른 값을 막는다 —
   * 급성 경보로 레짐을 바꾸는 코드를 쓸 수 없다.
   */
  regimeChange: false;
  /** 왜 경보가 아닌가 */
  reason?: string;
};

/**
 * 급성 경보 (§2-12).
 *
 * ```text
 * IF 원시값 임계 충족 AND 서로 다른 채널 3개 이상:
 *     ACUTE_TRANSITION_WATCH = True
 *     REGIME_CHANGE          = False        // 항상
 * ```
 */
export function acuteWatch(readings: RawReading[]): AcuteResult {
  const byCode = new Map(readings.map((r) => [r.indicator, r]));
  const triggers: AcuteTrigger[] = [];

  for (const t of ACUTE.thresholds) {
    const r = byCode.get(t.indicator);
    if (!r) continue;
    const changeDays = "changeDays" in t ? (t.changeDays as number) : undefined;
    const actual = changeDays === undefined ? r.level : r.changes?.[changeDays];
    if (actual === undefined || !Number.isFinite(actual)) continue;

    const hit = t.op === "gte" ? actual >= t.value : actual <= t.value;
    if (!hit) continue;
    triggers.push({
      indicator: t.indicator,
      channel: t.channel,
      op: t.op,
      threshold: t.value,
      actual,
      unit: t.unit,
      ...(t.note ? { note: t.note } : {}),
    });
  }

  const channels = [...new Set(triggers.map((t) => t.channel))];
  const channelCount = channels.length;
  const watch = channelCount >= ACUTE.minChannels;

  return {
    watch,
    triggers,
    channels,
    channelCount,
    regimeChange: false,
    ...(watch
      ? {}
      : {
          reason:
            triggers.length === 0
              ? "원시값 임계를 넘은 지표가 없다"
              : `임계를 넘은 채널이 ${channelCount}개다(필요 ${ACUTE.minChannels}개) — ` +
                "같은 채널 안의 지표는 몇 개든 1표다",
        }),
  };
}

/** 24시간 뒤 자동 해제 (§2-12). 조건이 유지되면 갱신된다. */
export function acuteExpired(raisedAtIso: string, nowIso: string): boolean {
  const hours = (Date.parse(nowIso) - Date.parse(raisedAtIso)) / 3_600_000;
  return hours >= ACUTE.autoClearHours;
}
