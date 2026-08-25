/**
 * 거시 지표 카탈로그 — **이 파일은 창구일 뿐이다.**
 *
 * 실제 정의는 섹터별로 `sectors/<key>.ts`에 있고, 모아서 검증하는 일은 `registry.ts`가 한다
 * (볼트 인수인계 사양서 1-1 "섹터는 코드가 아니라 데이터다"를 따른 구조).
 * 화면·서버가 `@/lib/macro/catalog`을 계속 쓸 수 있게 이름만 다시 내보낸다.
 *
 * ## 왜 정의가 DB가 아니라 코드인가
 * 바뀌는 것은 **값**이지 정의가 아니다. 시리즈 ID·임계값·설명은 판단이 담긴 문장이라
 * 버전 관리가 되는 편이 맞고, 관리자가 실수로 지울 수 있는 곳에 둘 이유가 없다.
 * DB에는 **시계열(MacroPoint)과 수집 이력만** 쌓는다.
 */
export type {
  MacroDerived,
  MacroGroup,
  MacroGroupKey,
  MacroIndicator,
  MacroSector,
  MacroSignalRule,
  MacroSource,
  MacroTransform,
} from "./types";

export {
  MACRO_INDICATORS,
  MACRO_SECTORS,
  RECESSION_SIGNAL_KEYS,
  autoIndicators,
  derivedIndicators,
  findIndicator,
  headlineIndicators,
  indicatorsByGroup,
  manualIndicators,
  recessionSignalIndicators,
  validateSectors,
  withDerivedComponents,
} from "./registry";
