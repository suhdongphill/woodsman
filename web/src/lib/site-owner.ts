/**
 * 운영자 실명 — 순수 모듈(2026-11-15).
 *
 * ⚠ 공개 화면은 필명 Woodsman만 쓴다. 실명은 `/privacy` 「개인정보 보호 책임자」 **한 곳**에만 나간다(법정 고지).
 *   그 값을 여기 한 곳에 두고, 개인정보 페이지와 **공개 글 관문**(브리핑 등)이 같이 쓴다.
 * 계기: 11/15 브리핑 원고 첫 문단에 「<이름>님 질문…」이 들어 있었는데 관문이 실명을 검사하지 않았다
 *   (그날은 제목·SNS 문제로 따로 막혔다 — 그것만 고쳐 다시 올렸으면 실명이 공개될 뻔했다).
 */
export const OWNER_REAL_NAME = "서동필";

/** 성을 뺀 이름 — 원고는 「동필님」처럼 이름만 부르는 경우가 많다 */
const GIVEN_NAME = OWNER_REAL_NAME.slice(1);

const REAL_NAME_RE = new RegExp(`${OWNER_REAL_NAME}|${GIVEN_NAME}`, "g");

/** 공개 글에 남은 실명 조각(앞뒤 몇 글자와 함께). 없으면 빈 배열. ⚠ 하나라도 있으면 저장하지 않는다. */
export function realNameResidue(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(REAL_NAME_RE)) {
    const at = m.index ?? 0;
    out.push(text.slice(Math.max(0, at - 6), at + m[0].length + 8).replace(/\s+/g, " ").trim());
  }
  return out;
}
