/**
 * 광고 노출 설계 — 순수 설정 모듈.
 *
 * ## 왜 이렇게 나눴나
 * AdSense는 "스크립트를 넣는 것"과 "광고 자리를 만드는 것"이 별개다.
 * 자리(ad unit)마다 슬롯 ID가 따로 있고, 심사 전에는 어느 것도 채워지지 않는다.
 * 그래서 **어디에 둘지는 코드로 고정**하고, **켤지 말지는 환경변수**로 둔다.
 *
 * ## 배치 원칙 (AdSense 정책 + 사용자 경험)
 * 1. **콘텐츠가 먼저.** 첫 화면을 광고가 덮지 않는다. 본문을 다 읽은 뒤에 만나게 둔다.
 * 2. **오조작 유발 금지.** 버튼·링크·내비게이션 바로 옆에 붙이지 않는다.
 *    실수 클릭은 수익이 아니라 계정 정지 사유다.
 * 3. **광고임을 표시한다.** 기사처럼 보이는 광고는 정책 위반이다.
 * 4. **자리를 미리 잡는다.** 로드 후 밀려나면(CLS) 검색 순위와 사용성이 같이 깎인다.
 * 5. **콘텐츠 없는 화면에는 넣지 않는다.** 로그인·관리자·정책 문서·에러 화면 제외.
 *
 * ## 심사 전 상태
 * `ADSENSE_CLIENT_ID`가 없으면 아무것도 렌더하지 않는다. 승인 전에 빈 슬롯을 깔아두면
 * 레이아웃만 망가지고 얻는 게 없다. 승인 후 슬롯 ID를 환경변수에 넣으면 그 자리부터 켜진다.
 */
import type { EnvSource } from "./env";

/** 광고 자리 — 이름이 곧 배치 의도다. */
export type AdPlacement =
  /** 글 본문이 끝난 자리 — 다 읽은 독자에게. 가장 값이 높다. */
  | "article-end"
  /** 목록 화면에서 카드 묶음이 끝난 자리 */
  | "feed-end"
  /** 콘텐츠 페이지 하단(푸터 위) */
  | "content-bottom";

const SLOT_ENV: Record<AdPlacement, string> = {
  "article-end": "ADSENSE_SLOT_ARTICLE_END",
  "feed-end": "ADSENSE_SLOT_FEED_END",
  "content-bottom": "ADSENSE_SLOT_CONTENT_BOTTOM",
};

/** 자리마다 미리 잡아둘 최소 높이(px) — 로드 후 콘텐츠가 밀리지 않게. */
export const AD_MIN_HEIGHT: Record<AdPlacement, number> = {
  "article-end": 280,
  "feed-end": 280,
  "content-bottom": 100,
};

const CLIENT_ID_PATTERN = /^ca-pub-\d{10,}$/;

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** 퍼블리셔 ID. 형식이 맞을 때만 유효로 본다(오타난 ID로 요청을 쏘지 않는다). */
export function adsenseClientId(source: EnvSource = process.env): string | null {
  const id = clean(source.ADSENSE_CLIENT_ID);
  return id && CLIENT_ID_PATTERN.test(id) ? id : null;
}

/** 스크립트를 넣을지 — 퍼블리셔 ID만 있으면 된다(심사용으로도 필요하다). */
export function isAdsEnabled(source: EnvSource = process.env): boolean {
  return adsenseClientId(source) !== null;
}

/**
 * 해당 자리의 슬롯 ID. 퍼블리셔 ID와 슬롯 ID가 **둘 다** 있어야 광고를 그린다.
 * 슬롯 ID 없이 ins 태그만 넣으면 빈 영역이 남는다.
 */
export function adSlotId(placement: AdPlacement, source: EnvSource = process.env): string | null {
  if (!isAdsEnabled(source)) return null;
  const slot = clean(source[SLOT_ENV[placement]]);
  return slot && /^\d{6,}$/.test(slot) ? slot : null;
}

/** 설정 상태를 사람이 읽을 수 있게 — 관리자 화면에서 쓴다. 값 자체는 노출하지 않는다. */
export function adsStatus(source: EnvSource = process.env): {
  clientConfigured: boolean;
  placements: { placement: AdPlacement; envName: string; configured: boolean }[];
} {
  return {
    clientConfigured: isAdsEnabled(source),
    placements: (Object.keys(SLOT_ENV) as AdPlacement[]).map((placement) => ({
      placement,
      envName: SLOT_ENV[placement],
      configured: adSlotId(placement, source) !== null,
    })),
  };
}
