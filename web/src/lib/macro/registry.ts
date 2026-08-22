/**
 * 섹터 레지스트리 — 섹터 파일을 모아 검증하고, 화면이 쓰는 목록으로 편다.
 *
 * ## 볼트 인수인계 사양서에서 가져온 것
 * `05_Methodology/섹터 분석 파이프라인 — 인수인계 사양서.md`의 설계 원칙을 따른다.
 * - **1-1 섹터는 데이터다** — 섹터 하나 = 파일 하나(`sectors/<key>.ts`). 여기엔 등록만 한다.
 * - **1-2 이중축 금지** — 정의가 깨졌으면 조용히 넘어가지 않고 `validateSectors()`가 잡는다.
 *   (이 사이트는 지표 하나에 차트 하나라 축이 섞일 자리가 없다. 대신 같은 성격의 검증을
 *   키 중복·소스 누락에 건다.)
 * - **1-3 값을 지어내지 않는다** — 카탈로그에 값이 없다. 값은 DB에만 있다.
 *
 * ## 볼트와 일부러 다르게 한 것
 * 볼트 수집기는 `tf` 변환을 **수집 시점에** 적용해 저장한다(사양서 3-2). 여기서는
 * **원값을 저장하고 읽을 때 변환**한다. 발표 기관이 과거 값을 수정하면 원값이 있어야
 * 다시 계산할 수 있고, 변환 규칙을 고칠 때 데이터를 다시 받지 않아도 되기 때문이다.
 * 대신 사양서가 경고한 **이중 적용**을 막으려고 변환은 `lib/macro/series.ts` 한 곳에서만 한다.
 */
import { isMacroLayer } from "./layers";
import type { MacroGroup, MacroGroupKey, MacroIndicator, MacroSector } from "./types";

import { sector as rates } from "./sectors/rates";
import { sector as liquidity } from "./sectors/liquidity";
import { sector as inflation } from "./sectors/inflation";
import { sector as jobs } from "./sectors/jobs";
import { sector as fx } from "./sectors/fx";
import { sector as commodity } from "./sectors/commodity";
import { sector as consumer } from "./sectors/consumer";
import { sector as production } from "./sectors/production";
import { sector as housing } from "./sectors/housing";
import { sector as semi } from "./sectors/semi";

/** ⚠ 새 섹터는 여기 한 줄만 추가한다. */
export const MACRO_SECTORS: MacroSector[] = [
  rates,
  liquidity,
  inflation,
  jobs,
  fx,
  commodity,
  consumer,
  production,
  housing,
  semi,
];

export const MACRO_GROUPS: MacroGroup[] = MACRO_SECTORS.map((s) => s.group).sort(
  (a, b) => a.order - b.order,
);

export const MACRO_INDICATORS: MacroIndicator[] = MACRO_SECTORS.flatMap((s) => s.indicators);

/**
 * 정의 검증. 깨진 정의는 **조용히 반쯤 동작하지 않고** 목록으로 드러난다.
 * (볼트의 `sectors.validate()`와 같은 역할 — 테스트가 이 결과를 확인한다.)
 */
export function validateSectors(sectors: MacroSector[] = MACRO_SECTORS): string[] {
  const problems: string[] = [];
  const seenGroups = new Set<string>();
  const seenOrders = new Set<number>();
  const seenKeys = new Set<string>();

  for (const s of sectors) {
    if (seenGroups.has(s.group.key)) problems.push(`묶음 키 중복: ${s.group.key}`);
    seenGroups.add(s.group.key);

    // ⚠ 순서가 겹치면 정렬이 흔들려 **화면마다 묶음 차례가 달라진다.**
    if (seenOrders.has(s.group.order)) problems.push(`묶음 순서 중복: ${s.group.key}`);
    seenOrders.add(s.group.order);

    if (s.indicators.length === 0) problems.push(`${s.group.key}: 지표가 없다`);

    for (const i of s.indicators) {
      if (seenKeys.has(i.key)) problems.push(`지표 키 중복: ${i.key}`);
      seenKeys.add(i.key);

      if (i.group !== s.group.key) {
        problems.push(`${i.key}: 섹터 파일(${s.group.key})과 group(${i.group})이 다르다`);
      }
      if (i.source !== "MANUAL" && !i.sourceId) {
        problems.push(`${i.key}: 자동 수집인데 소스 ID가 없다`);
      }
      if (i.source === "MANUAL" && i.sourceId) {
        problems.push(`${i.key}: 수동 지표에 소스 ID가 있다`);
      }
      if (!/^https:\/\//.test(i.url)) problems.push(`${i.key}: 출처 링크가 없다`);
      if (!i.what || !i.why || !i.read) problems.push(`${i.key}: 초보자 설명(3줄)이 비었다`);

      /**
       * ⚠ 볼트 인수인계 사양서 §2-1의 게이트를 그대로 옮겼다.
       *    "정의가 깨졌으면 조용히 반쯤 동작하지 않는다."
       */
      if (!isMacroLayer(i.layer)) problems.push(`${i.key}: 레이어(L0~L6)가 없거나 모르는 값이다`);

      // 해석이 뒤집히는 지표에 뒤집히는 조건이 없으면, 그 지표는 읽는 사람을 속인다.
      if (i.type === "capacity_remaining" && !i.stateDependency?.trim()) {
        problems.push(`${i.key}: capacity_remaining인데 stateDependency가 비었다`);
      }

      // 예외를 근거 없이 늘리는 것이 신선도 기능을 죽이는 가장 빠른 길이다.
      if (i.staleDays !== undefined && !i.staleWhy?.trim()) {
        problems.push(`${i.key}: staleDays를 줬는데 근거(staleWhy)가 없다`);
      }
      if (i.staleWhy && i.staleDays === undefined) {
        problems.push(`${i.key}: staleWhy만 있고 staleDays가 없다`);
      }
    }
  }
  return problems;
}

export function findMacroGroup(key: string): MacroGroup | undefined {
  return MACRO_GROUPS.find((g) => g.key === key);
}

export function orderedMacroGroups(): MacroGroup[] {
  return MACRO_GROUPS;
}

export function findIndicator(key: string): MacroIndicator | undefined {
  return MACRO_INDICATORS.find((i) => i.key === key);
}

export function indicatorsByGroup(group: MacroGroupKey): MacroIndicator[] {
  return (MACRO_SECTORS.find((s) => s.group.key === group)?.indicators ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);
}

/** 침체 시그널로 쓰는 지표 — 홈과 허브 맨 위에 나온다. */
export const RECESSION_SIGNAL_KEYS = ["t10y2y", "sahm", "hy_spread", "ism_mfg", "vix"] as const;

export function recessionSignalIndicators(): MacroIndicator[] {
  return RECESSION_SIGNAL_KEYS.map((k) => findIndicator(k)).filter(
    (i): i is MacroIndicator => !!i,
  );
}

/** 홈 요약에 올리는 대표 지표. */
export function headlineIndicators(): MacroIndicator[] {
  return MACRO_INDICATORS.filter((i) => i.headline);
}

/** 서버가 직접 가져올 수 있는 지표(FRED·Yahoo). MANUAL은 제외. */
export function autoIndicators(): MacroIndicator[] {
  return MACRO_INDICATORS.filter((i) => i.source !== "MANUAL");
}

/** 손으로 넣어야 하는 지표. 관리자 화면이 이 목록으로 입력 폼을 만든다. */
export function manualIndicators(): MacroIndicator[] {
  return MACRO_INDICATORS.filter((i) => i.source === "MANUAL");
}

export { MACRO_LAYERS, MACRO_LAYER_LIST, layerDef } from "./layers";
