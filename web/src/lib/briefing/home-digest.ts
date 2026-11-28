/**
 * 홈 브리핑 블록에 무엇을 올릴지 — 「오늘의 브리핑」 큰 카드 + 「이번 주 주요 이슈」 목록(2026-11-28).
 *
 * 계획: `docs/설계_홈_섹션계획.md` 1-c (2026-11-15 운영자 아이디어 · 11/28 클릭 비교 뒤 구현).
 * - 최신이 싱싱하면(`isBriefingFresh`) 최신 1편은 큰 카드, 그 아래 **다음 6편**을 목록으로.
 * - ⭐ 운영자 결정(11/28): 최신이 오래됐으면 큰 카드만 빼고 **최근 7편 목록은 남긴다**(제목 「최근 브리핑」).
 *   지난 글을 「오늘의」로 보이지 않게 하면서 브리핑 상세로 가는 길은 끊지 않는다.
 * - ⚠ 「최근 7일」이 아니라 「최근 7편」 — 쉰 날이 빈칸이 되지 않게.
 * - ⚠ 전문·요약은 목록에 싣지 않는다(상세 페이지와 중복 · 홈 길이). 날짜 + 제목 첫 문장(운영자 결정 11/28)만.
 */
import { isBriefingFresh } from "../home-layout";

/** 홈 블록에 올리는 브리핑 수(큰 카드 포함). */
export const HOME_BRIEFING_COUNT = 7;

/**
 * 제목(두 문장짜리 리드)의 첫 문장. 마침표·물음표·느낌표 뒤에 공백이나 끝이 오는 첫 자리에서 자른다.
 * ⚠ 「3.59%」 같은 숫자 안의 점은 뒤에 공백이 없어 자르지 않는다. 문장 끝을 못 찾으면 전체를 돌려준다.
 */
export function firstSentence(headline: string): string {
  const text = headline.trim();
  const m = /^(.+?[.!?])(?=\s|$)/.exec(text);
  return m ? m[1] : text;
}

export type HomeBriefingItem = { date: string; title: string };

export type HomeBriefingDigest<T> = {
  /** 큰 카드 — 최신이 싱싱할 때만 */
  featured?: T;
  /** 목록 — 큰 카드가 있으면 그 다음 6편, 없으면 최근 7편 */
  list: HomeBriefingItem[];
};

/**
 * `briefings`는 공개본 최신순. 하나도 없으면 null(블록을 그리지 않는다).
 * `today`는 서울 날짜 YYYY-MM-DD.
 */
export function homeBriefingDigest<T extends { date: string; headline: string }>(
  briefings: T[],
  today: string,
): HomeBriefingDigest<T> | null {
  const top = briefings.slice(0, HOME_BRIEFING_COUNT);
  if (top.length === 0) return null;
  const fresh = isBriefingFresh(top[0].date, today);
  const rest = fresh ? top.slice(1) : top;
  return {
    featured: fresh ? top[0] : undefined,
    list: rest.map((b) => ({ date: b.date, title: firstSentence(b.headline) })),
  };
}
