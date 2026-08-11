/**
 * 체류·읽힘 집계 규칙 — 순수 함수.
 *
 * ## 왜 만들었나
 * 지금 있는 지표는 **조회수뿐**이라 "화면을 어떻게 고칠까"에 답하지 못한다.
 * 조회수가 높은데 3초 만에 나가는 화면과, 조회수가 낮아도 끝까지 읽히는 화면은
 * 정반대의 처방이 필요하다. 그걸 구분하려면 **머문 시간과 읽은 깊이**가 있어야 한다.
 *
 * ## ⚠ 개인을 식별하지 않는다 (`lib/analytics.ts`와 같은 규칙)
 * 쿠키·IP·UA를 저장하지 않는다. 저장하는 것은 여전히 **(경로, 날짜, 집계)**뿐이다.
 * 체류시간도 **개인의 세션이 아니라 브라우저가 잰 값 하나**를 익명으로 더한 것이다.
 * `/privacy`의 "회원정보를 수집하지 않는다"와 어긋나지 않게 유지한다.
 *
 * ## ⚠ 왜 평균이 아니라 버킷인가
 * 체류시간 평균은 거의 항상 거짓말을 한다. 탭을 열어 두고 점심 먹으러 간 한 사람이
 * 평균을 통째로 끌어올린다. **버킷(구간별 인원)**으로 쌓으면 그 한 명이 한 칸에 갇히고,
 * 중앙값·상위 구간 비율을 낼 수 있다. 저장 용량도 경로당 몇 개 정수로 끝난다.
 */

/**
 * 체류시간 구간(초). 각 값은 **그 구간의 하한**이다.
 * 마지막 칸은 상한이 없다(5분 이상).
 *
 * ⚠ 구간을 바꾸면 **과거 데이터와 비교가 깨진다.** 바꿔야 한다면 새 열을 만든다.
 */
export const DWELL_BUCKETS_SEC = [0, 5, 15, 30, 60, 180, 300] as const;

export const DWELL_BUCKET_LABELS = [
  "5초 미만",
  "5~15초",
  "15~30초",
  "30초~1분",
  "1~3분",
  "3~5분",
  "5분 이상",
] as const;

/** 스크롤 깊이 구간(%) — 하한값. */
export const SCROLL_BUCKETS_PCT = [0, 25, 50, 75, 100] as const;

export const SCROLL_BUCKET_LABELS = ["25% 미만", "25~50%", "50~75%", "75~100%", "끝까지"] as const;

/**
 * ⚠ 한 번에 인정하는 체류시간 상한(초). 30분.
 * 탭을 열어 둔 채 잊은 경우를 걸러 낸다. **가시 시간만 재도** 화면 켜 둔 채 자리를 뜨면 쌓인다.
 */
export const MAX_DWELL_SEC = 1800;

/** "튕겨 나갔다"고 보는 기준(초). 이보다 짧으면 화면을 읽은 것으로 치지 않는다. */
export const BOUNCE_UNDER_SEC = 5;

/** "실제로 읽었다"고 보는 기준 — 시간과 깊이를 **둘 다** 넘어야 한다. */
export const READ_MIN_SEC = 30;
export const READ_MIN_SCROLL_PCT = 50;

function bucketIndex(bounds: readonly number[], value: number): number {
  let index = 0;
  for (let i = 0; i < bounds.length; i++) {
    if (value >= bounds[i]) index = i;
  }
  return index;
}

/** 체류시간(초) → 버킷 번호. 음수·NaN은 0번으로 떨어진다. */
export function dwellBucket(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return bucketIndex(DWELL_BUCKETS_SEC, Math.min(seconds, MAX_DWELL_SEC));
}

/** 스크롤 깊이(%) → 버킷 번호. */
export function scrollBucket(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return bucketIndex(SCROLL_BUCKETS_PCT, Math.min(pct, 100));
}

/**
 * 브라우저가 보낸 값을 **믿을 수 있는 범위로** 좁힌다.
 * ⚠ 비콘은 누구나 부를 수 있다. 여기서 자르지 않으면 한 번의 호출로 통계가 망가진다.
 */
export function sanitizeEngagement(input: {
  dwellSec?: unknown;
  scrollPct?: unknown;
}): { dwellSec: number; scrollPct: number } | null {
  const dwell = Number(input.dwellSec);
  const scroll = Number(input.scrollPct);

  if (!Number.isFinite(dwell) || dwell < 0) return null;
  if (!Number.isFinite(scroll) || scroll < 0) return null;

  return {
    dwellSec: Math.min(Math.round(dwell), MAX_DWELL_SEC),
    scrollPct: Math.min(Math.round(scroll), 100),
  };
}

/** 한 경로·하루치 집계 원본. 버킷 배열은 인원수다. */
export type EngagementRow = {
  path: string;
  date: string;
  /** 체류시간을 보고한 표본 수 (조회수와 다르다 — 못 보낸 이탈이 있다) */
  samples: number;
  dwellBuckets: number[];
  scrollBuckets: number[];
  /** 시간·깊이를 둘 다 넘은 표본 수 */
  reads: number;
};

/**
 * 버킷에서 중앙값을 **근사**한다.
 *
 * ⚠ 정확한 중앙값이 아니라 **중앙값이 든 구간의 하한**이다. 이름을 `median`이라 붙이면
 *    없는 정확도를 파는 것이라, 화면에도 "중앙 구간"으로 적는다.
 */
export function medianBucketIndex(buckets: number[]): number | undefined {
  const total = buckets.reduce((sum, n) => sum + n, 0);
  if (total === 0) return undefined;

  const half = total / 2;
  let cumulative = 0;
  for (let i = 0; i < buckets.length; i++) {
    cumulative += buckets[i];
    if (cumulative >= half) return i;
  }
  return buckets.length - 1;
}

export type EngagementView = {
  path: string;
  views: number;
  samples: number;
  /** 체류시간 중앙 구간 라벨. 표본이 없으면 undefined */
  dwellLabel?: string;
  dwellBucket?: number;
  /** 5초 미만 비율(%) — 높을수록 첫 화면에서 튕긴다 */
  bouncePct?: number;
  /** 끝까지 내려간 비율(%) */
  fullScrollPct?: number;
  /** 시간·깊이를 둘 다 넘은 비율(%) */
  readPct?: number;
  /** 이 화면을 거쳐 티스토리로 나간 클릭 */
  outboundClicks: number;
  /** 조회 대비 티스토리 전환율(%) */
  outboundPct?: number;
};

function pct(part: number, whole: number): number | undefined {
  if (whole <= 0) return undefined;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * 한 경로의 집계를 화면이 쓰는 모양으로.
 * ⚠ 표본이 없으면 숫자를 만들지 않는다(undefined). 0%로 적으면 "재 봤더니 0"으로 읽힌다.
 */
export function toEngagementView(
  row: EngagementRow & { views: number; outboundClicks: number },
): EngagementView {
  const samples = row.samples;
  const dwellIndex = medianBucketIndex(row.dwellBuckets);
  const bounce = row.dwellBuckets[0] ?? 0;
  const full = row.scrollBuckets[SCROLL_BUCKETS_PCT.length - 1] ?? 0;

  return {
    path: row.path,
    views: row.views,
    samples,
    dwellBucket: dwellIndex,
    dwellLabel: dwellIndex === undefined ? undefined : DWELL_BUCKET_LABELS[dwellIndex],
    bouncePct: pct(bounce, samples),
    fullScrollPct: pct(full, samples),
    readPct: pct(row.reads, samples),
    outboundClicks: row.outboundClicks,
    outboundPct: pct(row.outboundClicks, row.views),
  };
}

/**
 * 화면 개편의 **우선순위 점수**.
 *
 * ## 왜 조회수 정렬이 아닌가
 * 조회수로 줄 세우면 항상 홈이 1등이고, "그래서 뭘 고쳐야 하나"에 답하지 않는다.
 * 고칠 값어치는 **"사람이 많이 오는데 잘 안 읽히거나, 읽히는데 블로그로 안 넘어가는 화면"**에 있다.
 *
 * 점수 = 조회수(규모) × 문제 강도. 문제 강도는 두 가지를 본다.
 * - **이탈**: 5초 미만 비율이 높다 → 첫 화면이 답을 못 준다
 * - **전환 부재**: 읽히는데(readPct 높음) 티스토리 클릭이 없다 → CTA 자리가 틀렸다
 *
 * ⚠ 이 점수는 **어디부터 볼지 정하는 순서**이지 화면의 품질 등급이 아니다.
 */
export function redesignPriority(v: EngagementView): number {
  if (v.views <= 0) return 0;

  // 표본이 없으면 문제 강도를 모른다 — 규모만 약하게 반영한다(0으로 두면 목록에서 사라진다).
  if (v.samples === 0) return v.views * 0.1;

  const bounce = (v.bouncePct ?? 0) / 100;
  const read = (v.readPct ?? 0) / 100;
  const converted = (v.outboundPct ?? 0) / 100;

  // 읽히는데 안 넘어가면 놓친 기회가 크다. 안 읽히면 애초에 넘어갈 수 없으니 곱해 준다.
  const missedHandoff = read * Math.max(0, 1 - converted * 10);

  return Math.round(v.views * (bounce * 0.6 + missedHandoff * 0.4) * 10) / 10;
}

/** 우선순위가 높은 순으로. 동점이면 조회수가 많은 쪽이 먼저. */
export function sortByRedesignPriority(views: EngagementView[]): EngagementView[] {
  return views
    .slice()
    .sort((a, b) => redesignPriority(b) - redesignPriority(a) || b.views - a.views);
}

/**
 * 경로를 묶음으로 접는다 — `/insights/abc` → `/insights/*`.
 *
 * 글이 늘어나면 개별 경로가 수백 줄이 되어 **화면 단위 판단이 불가능**해진다.
 * 화면을 고치는 것이 목적이므로 템플릿 단위로 보는 눈이 따로 필요하다.
 */
export function templatePath(path: string): string {
  const rules: [RegExp, string][] = [
    [/^\/insights\/[^/]+$/, "/insights/*"],
    [/^\/board\/[^/]+$/, "/board/*"],
    [/^\/stocks\/[^/]+$/, "/stocks/*"],
    [/^\/macro\/bubble$/, "/macro/bubble"],
    [/^\/macro\/[^/]+$/, "/macro/*"],
    [/^\/journal\/[^/]+$/, "/journal/*"],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(path)) return label;
  }
  return path;
}

/** 같은 템플릿끼리 합친다. 버킷은 자리별로 더한다. */
export function rollupByTemplate(
  rows: (EngagementRow & { views: number; outboundClicks: number })[],
): (EngagementRow & { views: number; outboundClicks: number })[] {
  const byTemplate = new Map<string, EngagementRow & { views: number; outboundClicks: number }>();

  for (const row of rows) {
    const key = templatePath(row.path);
    const found = byTemplate.get(key);
    if (!found) {
      byTemplate.set(key, {
        ...row,
        path: key,
        dwellBuckets: [...row.dwellBuckets],
        scrollBuckets: [...row.scrollBuckets],
      });
      continue;
    }
    found.views += row.views;
    found.samples += row.samples;
    found.reads += row.reads;
    found.outboundClicks += row.outboundClicks;
    row.dwellBuckets.forEach((n, i) => (found.dwellBuckets[i] = (found.dwellBuckets[i] ?? 0) + n));
    row.scrollBuckets.forEach((n, i) => (found.scrollBuckets[i] = (found.scrollBuckets[i] ?? 0) + n));
  }
  return [...byTemplate.values()];
}
