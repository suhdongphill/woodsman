/**
 * 홈이 무엇을 그리는가 — 순수 판단 모듈.
 *
 * ## 왜 뺐나
 * 홈 라우트(`app/(public)/page.tsx`)가 400줄이었고, 그 안에 **데이터 로드 · 조립 · 문구 ·
 * "값이 없을 때 어떻게 하나"의 판단**이 전부 섞여 있었다. 그래서 홈의 규칙을 확인하려면
 * 화면을 띄우는 수밖에 없었다(CLAUDE.md §1이 경고하는 그 상태다).
 *
 * 이제 **어떤 블록을 어떤 순서로 그릴지는 여기서만** 정하고, 화면은 그 결과를 그린다.
 *
 * ## ⚠ 이 파일이 지금 지키는 것은 "현재 홈과 똑같이"다
 * 홈을 콘텐츠 중심으로 바꾸는 일(`docs/설계_홈_콘텐츠중심_재편.md`)은 **Step 2 이후**다.
 * Step 1은 **겉모습을 한 줄도 바꾸지 않고** 쪼개기만 한다 — 섞으면 "쪼개다 깨진 것"과
 * "옮기다 깨진 것"을 구분할 수 없다. 그래서 아래 규칙은 지금 화면 그대로다.
 */

/** 홈의 블록. ⚠ 배열의 **순서가 곧 화면의 순서**다. */
export const HOME_BLOCKS = [
  /** 첫 화면 — 문구 + 계좌 요약 카드 */
  "hero",
  /** 넣은 돈과 불어난 돈 (자금 흐름 차트) */
  "capitalFlow",
  /** 지금 경제는 어떤 상태인가 (침체 신호 + 헤드라인 지표) */
  "macro",
  /** 어떻게 기록하나요 (운영 원칙 3장) */
  "principles",
  /** 홈 섹션으로 발행한 글 */
  "homePosts",
  /** 최신 인사이트 + 티스토리 CTA */
  "latestInsights",
  /** 최근 투자일지 + 종목 보고서 */
  "journalAndReports",
] as const;

export type HomeBlock = (typeof HOME_BLOCKS)[number];

/** 홈이 실제로 쥐고 있는 것. ⚠ 여기 없는 값으로 블록을 정하지 않는다. */
export type HomeContent = {
  /** 계좌 스냅숏이 있어 성과 곡선을 그릴 수 있나 */
  hasAccountCurve: boolean;
  /** 홈 섹션으로 발행한 글 수 */
  homePostCount: number;
};

/**
 * 그릴 블록을 순서대로 돌려준다.
 *
 * ⚠ **"값이 없으면 뺀다"와 "값이 없다고 적는다"를 여기서 한 곳으로 정한다.**
 *    지금은 두 블록만 조건부다 — 나머지는 값이 없어도 자기 자리에서 "아직 없다"고 말한다
 *    (빈 칸을 0으로 만들지 않는다는 규칙의 화면 쪽 얼굴이다).
 */
export function visibleHomeBlocks(content: HomeContent): HomeBlock[] {
  return HOME_BLOCKS.filter((block) => {
    switch (block) {
      /** 스냅숏이 없으면 그릴 곡선 자체가 없다. 0원짜리 차트를 그리지 않는다. */
      case "capitalFlow":
        return content.hasAccountCurve;
      /** 홈에 쌓인 글이 없으면 빈 프레임만 남는다. */
      case "homePosts":
        return content.homePostCount > 0;
      default:
        return true;
    }
  });
}

/** 화면이 `blocks.includes(...)`를 반복해 부르지 않게. */
export function hasBlock(blocks: HomeBlock[], block: HomeBlock): boolean {
  return blocks.includes(block);
}
