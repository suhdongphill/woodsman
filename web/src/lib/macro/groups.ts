/**
 * 거시 지표의 묶음(그룹) — **이 파일은 창구일 뿐이다.**
 *
 * 묶음 정의는 각 섹터 파일(`sectors/<key>.ts`) 안에 지표와 함께 있다.
 * 한 묶음을 손볼 때 두 파일을 오가지 않게 하려는 것이다(볼트 사양서 1-1).
 *
 * ## 왜 묶음으로 나누나
 * 지표를 40개 늘어놓으면 **처음 온 사람은 아무것도 못 읽는다.** 투자를 막 시작한 사람이
 * 알고 싶은 건 "지금 돈값(금리)이 어떤가", "물가가 잡히나" 같은 **질문**이지 시리즈 이름이
 * 아니다. 그래서 묶음을 질문으로 세우고 그 아래 지표를 둔다.
 *
 * URL의 `key`는 **영문 고정**이다(`/macro/rates`). 한글 URL은 공유·검색 결과에서
 * 퍼센트 인코딩으로 깨져 보이고, 이름을 다듬을 때마다 주소가 바뀐다.
 */
export type { MacroGroup, MacroGroupKey } from "./types";
export { MACRO_GROUPS, findMacroGroup, orderedMacroGroups } from "./registry";
