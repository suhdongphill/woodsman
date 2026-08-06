/**
 * 섹션(글이 쌓이는 자리) 정의 — 순수 값.
 *
 * ## 왜 섹션을 두나
 * 화면마다 "그 화면에 대해 쓴 글"이 이어 붙어야 한다. 거시 지표 화면 아래에는 지표를 읽고
 * 쓴 글이, 포트폴리오 아래에는 편입·리밸런싱을 설명한 글이 쌓이는 식이다.
 * 발행할 때마다 **그 섹션의 프레임이 한 편씩 길어진다.**
 *
 * 인사이트(`/insights`)는 전체 목록이라 성격이 다르다 — 나머지 섹션의 글도 여기서 다시 읽힌다.
 */
import type { PostSection } from "./types";

export const SECTION_LABEL: Record<PostSection, string> = {
  HOME: "홈",
  MACRO: "거시 지표",
  PORTFOLIO: "포트폴리오",
  JOURNAL: "투자일지",
  INSIGHT: "인사이트",
};

/** 섹션 프레임의 제목·설명. 화면마다 다른 문구를 코드에 흩뿌리지 않게 여기 모은다. */
export const SECTION_FRAME: Record<PostSection, { title: string; subtitle: string }> = {
  HOME: {
    title: "기록",
    subtitle: "이 사이트를 어떻게 굴리고 있는지 남긴 글입니다.",
  },
  MACRO: {
    title: "지표를 읽고 쓴 글",
    subtitle: "위 숫자를 어떻게 해석했는지, 무엇이 바뀌었는지 적습니다.",
  },
  PORTFOLIO: {
    title: "포트폴리오에 대해 쓴 글",
    subtitle: "왜 이렇게 나눴고 무엇을 바꿨는지 설명합니다.",
  },
  JOURNAL: {
    title: "일지에 붙이는 글",
    subtitle: "한 건의 매매보다 긴 호흡의 기록입니다.",
  },
  INSIGHT: {
    title: "인사이트",
    subtitle: "시장이 아니라 원칙을 다룹니다.",
  },
};

export const SECTIONS: PostSection[] = ["HOME", "MACRO", "PORTFOLIO", "JOURNAL", "INSIGHT"];
