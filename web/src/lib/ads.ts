/**
 * 광고 노출 설계 — 순수 설정 모듈.
 *
 * ## 왜 이렇게 나눴나
 * AdSense는 "스크립트를 넣는 것"과 "광고 자리를 만드는 것"이 별개다.
 * 자리(ad unit)마다 슬롯 ID가 따로 있고, 심사 전에는 어느 것도 채워지지 않는다.
 * 그래서 **어디에 둘지는 코드로 고정**하고, **무엇을 켤지는 관리자 화면**에서 정한다.
 *
 * ## ⚠ 2026-08-30: 환경변수에서 관리자 설정으로 옮겼다
 * 전에는 `ADSENSE_*` 환경변수였다. 값을 바꾸려면 **재배포**가 필요했고, 문제가 생겼을 때
 * 즉시 내릴 수 없었다. 운영지침 §1(코드를 고쳐야만 바뀌는 운영값을 만들지 않는다)에도 어긋난다.
 *
 * ⚠ 퍼블리셔·슬롯 ID는 **비밀이 아니다** — HTML에 그대로 실리는 공개값이라 DB에 둔다.
 *    AI API 키와 혼동하지 말 것. 그쪽은 **절대 DB에 넣지 않는다**(env 변수명만 기록한다).
 *
 * ## 배치 원칙 (AdSense 정책 + 사용자 경험)
 * 1. **콘텐츠가 먼저.** 첫 화면을 광고가 덮지 않는다. 본문을 다 읽은 뒤에 만나게 둔다.
 * 2. **오조작 유발 금지.** 버튼·링크·내비게이션 바로 옆에 붙이지 않는다.
 *    실수 클릭은 수익이 아니라 계정 정지 사유다.
 * 3. **광고임을 표시한다.** 기사처럼 보이는 광고는 정책 위반이다.
 * 4. **자리를 미리 잡는다.** 로드 후 밀려나면(CLS) 검색 순위와 사용성이 같이 깎인다.
 * 5. **콘텐츠 없는 화면에는 넣지 않는다.** 로그인·관리자·정책 문서·에러 화면 제외.
 * 6. ⚠ **티스토리 CTA가 광고보다 위다**(운영지침 §4). 자리 경쟁이 붙으면 광고를 내린다 —
 *    이 사이트의 1순위 지표는 광고 수익이 아니라 「티스토리로 넘어간 클릭」이다.
 *
 * ## ⚠ 등록과 노출은 다른 스위치다
 * ID를 다 넣어도 `enabled`가 꺼져 있으면 **아무것도 그리지 않는다.**
 * 정착 전에 값만 넣어 두고 싶을 때가 있고, 문제가 생기면 재배포 없이 즉시 내려야 한다.
 */

/** 광고 자리 — 이름이 곧 배치 의도다. */
export type AdPlacement =
  /** 글 본문이 끝난 자리 — 다 읽은 독자에게. 가장 값이 높다. */
  | "article-end"
  /** 목록 화면에서 카드 묶음이 끝난 자리 */
  | "feed-end"
  /** 콘텐츠 페이지 하단(푸터 위) */
  | "content-bottom";

export const AD_PLACEMENTS: AdPlacement[] = ["article-end", "feed-end", "content-bottom"];

export const AD_PLACEMENT_LABEL: Record<AdPlacement, string> = {
  "article-end": "글 본문 끝",
  "feed-end": "목록 끝",
  "content-bottom": "페이지 하단",
};

/** 자리마다 미리 잡아둘 최소 높이(px) — 로드 후 콘텐츠가 밀리지 않게. */
export const AD_MIN_HEIGHT: Record<AdPlacement, number> = {
  "article-end": 280,
  "feed-end": 280,
  "content-bottom": 100,
};

/** 관리자 화면이 저장하는 값. */
export type AdsSettings = {
  /** ⚠ 이 스위치가 꺼져 있으면 ID가 다 있어도 아무것도 그리지 않는다 */
  enabled: boolean;
  clientId: string | null;
  slots: Partial<Record<AdPlacement, string | null>>;
};

export const EMPTY_ADS_SETTINGS: AdsSettings = {
  enabled: false,
  clientId: null,
  slots: {},
};

const CLIENT_ID_PATTERN = /^ca-pub-\d{10,}$/;
const SLOT_PATTERN = /^\d{6,}$/;

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * 퍼블리셔 ID. **형식이 맞을 때만** 유효로 본다.
 * ⚠ 오타난 ID로 요청을 쏘지 않는다 — 잘못된 값은 없느니만 못하다.
 */
export function adsenseClientId(settings: AdsSettings): string | null {
  const id = clean(settings.clientId);
  return id && CLIENT_ID_PATTERN.test(id) ? id : null;
}

/** 형식만 검사한다 — 저장할 때 쓴다(켜짐 여부와 무관). */
export function isValidClientId(raw: string): boolean {
  return CLIENT_ID_PATTERN.test(raw.trim());
}

export function isValidSlotId(raw: string): boolean {
  return SLOT_PATTERN.test(raw.trim());
}

/**
 * 지금 실제로 광고가 나가는가.
 * ⚠ **스위치와 ID가 둘 다** 있어야 한다.
 */
export function isAdsLive(settings: AdsSettings): boolean {
  return settings.enabled && adsenseClientId(settings) !== null;
}

/**
 * 해당 자리의 슬롯 ID. 퍼블리셔 ID와 슬롯 ID가 **둘 다** 있어야 광고를 그린다.
 * 슬롯 ID 없이 ins 태그만 넣으면 빈 영역이 남는다.
 */
export function adSlotId(placement: AdPlacement, settings: AdsSettings): string | null {
  if (!isAdsLive(settings)) return null;
  const slot = clean(settings.slots[placement]);
  return slot && SLOT_PATTERN.test(slot) ? slot : null;
}

/**
 * 설정 상태를 사람이 읽을 수 있게 — 관리자 화면에서 쓴다.
 *
 * ⚠ **"등록됐다"와 "나가고 있다"를 구분해서 보여 준다.** 둘을 한 칸으로 합치면
 *    ID를 넣어 두고 꺼 둔 상태가 "설정 안 됨"처럼 보인다.
 */
export function adsStatus(settings: AdsSettings): {
  clientConfigured: boolean;
  live: boolean;
  placements: { placement: AdPlacement; label: string; configured: boolean; live: boolean }[];
} {
  const clientConfigured = adsenseClientId(settings) !== null;
  return {
    clientConfigured,
    live: isAdsLive(settings),
    placements: AD_PLACEMENTS.map((placement) => {
      const slot = clean(settings.slots[placement]);
      return {
        placement,
        label: AD_PLACEMENT_LABEL[placement],
        configured: !!slot && SLOT_PATTERN.test(slot),
        live: adSlotId(placement, settings) !== null,
      };
    }),
  };
}

/**
 * ads.txt 한 줄. 퍼블리셔 ID가 없거나 형식이 아니면 **null**(파일 자체를 안 내보낸다).
 * ⚠ 잘못된 ID가 적힌 ads.txt는 없느니만 못하다.
 * ⚠ `ca-pub-` 접두사를 뗀 숫자만 쓰는 것이 규격이다.
 */
export function adsTxtBody(settings: AdsSettings): string | null {
  const id = adsenseClientId(settings);
  if (!id) return null;
  return `google.com, pub-${id.replace(/^ca-pub-/, "")}, DIRECT, f08c47fec0942fa0\n`;
}
