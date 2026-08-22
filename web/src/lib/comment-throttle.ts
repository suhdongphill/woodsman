/**
 * 댓글 작성·신고의 속도 제한과 중복 방지 — 순수 함수.
 *
 * ## 왜
 * 2026-08-17 점검이 낮음으로 잡았다: **댓글 작성·신고에 아무 제한이 없었다.**
 * 특히 신고는 로그인조차 요구하지 않아, 화면에 보이는 댓글 id를 그대로 다시 보내면
 * 누구나 모든 댓글을 '신고됨'으로 만들 수 있었다. 관리자 화면의 '신고됨' 탭과
 * 대시보드 배지가 통째로 못 쓰게 되는 것이 이 구멍의 실제 값이다.
 *
 * ## ⚠ 왜 Rate Limiting 바인딩을 쓰지 않았나
 * `lib/beacon-guard.ts`에 적어 둔 2026-08-15 실측대로, Cloudflare Rate Limiting은
 * **꾸준한 남용만 막고 병렬 폭주는 통째로 빠져나간다.** 남용은 정확히 뒤쪽 방식으로 온다.
 * 댓글은 초당 수천 건이 오는 경로가 아니므로 **D1을 한 번 더 읽는 값을 치르고**
 * 정확히 세는 쪽을 골랐다(비콘과 반대 판단이다 — 비콘은 양이 많아 그럴 수 없었다).
 *
 * ## ⚠ IP를 저장하지 않는다
 * 익명 작성자를 IP로 구분하면 제한은 정확해지지만 **방문자 IP가 DB에 남는다.**
 * 그 대신 익명은 **글 단위 공유 버킷**으로 센다 — 같은 글에 익명 댓글이 창 안에
 * {@link MAX_COMMENTS_PER_WINDOW}건을 넘으면 다음 사람도 잠시 막힌다.
 * 정확도를 조금 내주고 개인정보를 안 남기는 쪽을 골랐다. 커뮤니티를 열어 익명 글이
 * 실제로 늘면 다시 판단해야 한다.
 *
 * ## 판단은 여기, 질의는 repository, 조립은 actions
 * 이 파일은 Date와 문자열만 만진다. DB·React·환경을 모른다.
 */

/** 이 창 안에서 셀 수 있는 작성 횟수. 사람이 이어서 두세 개 쓰는 건 정상이다. */
export const COMMENT_WINDOW_SECONDS = 10 * 60;

/** 창 안 최대 작성 수. ⚠ 익명은 글 단위 공유 버킷이라 이 값이 곧 그 글의 상한이다. */
export const MAX_COMMENTS_PER_WINDOW = 5;

/**
 * 같은 내용을 다시 받지 않는 기간.
 * ⚠ 작성 제한(10분)보다 훨씬 길다 — 도배는 "빠르게"가 아니라 "같은 걸 계속"이다.
 */
export const DUPLICATE_WINDOW_SECONDS = 24 * 60 * 60;

/** 신고를 세는 창과 상한. 한 사람이 한 시간에 이만큼까지만 신고할 수 있다. */
export const REPORT_WINDOW_SECONDS = 60 * 60;
export const MAX_REPORTS_PER_WINDOW = 10;

/**
 * 판정에 쓸 최근 댓글을 몇 건까지 읽어 오면 되나.
 * ⚠ {@link MAX_COMMENTS_PER_WINDOW}보다 넉넉해야 한다 — 잘려서 덜 세면 제한이 헐거워진다.
 *   이 값을 넘게 잘려도 개수 판정은 이미 상한을 넘으므로 결론이 바뀌지 않는다.
 */
export const RECENT_SCAN_LIMIT = 20;

export type RecentComment = {
  body: string;
  /** ISO 문자열. 파싱할 수 없으면 그 행은 판정에서 뺀다(없는 확신을 팔지 않는다). */
  createdAt: string;
};

export type ThrottleVerdict =
  | { kind: "allow" }
  | { kind: "deny"; reason: "too-fast" | "duplicate"; message: string };

/**
 * 중복 판정을 위한 정규화.
 *
 * ⚠ 대소문자·공백·줄바꿈만 지운다. 문장부호까지 지우면 서로 다른 글이 같은 글로 뭉쳐
 *   정상 댓글이 막힌다("좋다."와 "좋다?"는 다른 말이다).
 */
export function normalizeForDuplicate(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 이 시각으로부터 `seconds`초 전(ISO). SQL의 `createdAt >= ?`에 그대로 넣는다. */
export function windowStart(now: Date, seconds: number): string {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

function parseTime(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** 초를 사람이 읽는 말로. "0분 뒤"라고 하지 않는다. */
export function humanizeWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s}초`;
  return `${Math.ceil(s / 60)}분`;
}

/**
 * 지금 이 댓글을 받아도 되는가.
 *
 * `recent`는 **중복 창(24시간) 안의 같은 작성자(익명이면 같은 글) 댓글**을 최신순으로 준다.
 * 개수 판정과 중복 판정을 한 번에 하려고 한 질의로 합쳤다 — D1 왕복을 늘리지 않기 위해서다.
 *
 * ⚠ 중복을 속도보다 **먼저** 본다. 같은 글을 다시 보낸 사람에게 "너무 빠릅니다"라고 하면
 *   기다렸다가 또 보낸다. 이유를 정확히 말해야 행동이 바뀐다.
 */
export function checkCommentThrottle(input: {
  recent: RecentComment[];
  body: string;
  now: Date;
}): ThrottleVerdict {
  const nowMs = input.now.getTime();
  const target = normalizeForDuplicate(input.body);

  if (target && input.recent.some((c) => normalizeForDuplicate(c.body) === target)) {
    return {
      kind: "deny",
      reason: "duplicate",
      message: "같은 내용을 이미 남기셨습니다.",
    };
  }

  const withinRate: number[] = [];
  for (const c of input.recent) {
    const t = parseTime(c.createdAt);
    if (t === null) continue;
    if ((nowMs - t) / 1000 < COMMENT_WINDOW_SECONDS) withinRate.push(t);
  }

  if (withinRate.length < MAX_COMMENTS_PER_WINDOW) return { kind: "allow" };

  // 가장 오래된 것이 창을 벗어나는 순간 한 자리가 빈다. 그 시각을 그대로 알려 준다.
  const oldest = Math.min(...withinRate);
  const wait = COMMENT_WINDOW_SECONDS - (nowMs - oldest) / 1000;
  return {
    kind: "deny",
    reason: "too-fast",
    message: `댓글을 너무 빠르게 남기고 있습니다. ${humanizeWait(wait)} 뒤에 다시 시도해주세요.`,
  };
}

export type ReportVerdict =
  | { kind: "allow" }
  | { kind: "deny"; reason: "already" | "too-many" };

/**
 * 이 신고를 받아도 되는가.
 *
 * ⚠ 이미 신고한 것은 **거절이 아니라 없던 일로 본다**(`already`). 호출부는 조용히
 *   성공처럼 끝내야 한다 — "이미 신고했습니다"라고 말해 주면 남의 신고 여부까지 알려 준다.
 */
export function checkReportThrottle(input: {
  alreadyReported: boolean;
  recentReportCount: number;
}): ReportVerdict {
  if (input.alreadyReported) return { kind: "deny", reason: "already" };
  if (input.recentReportCount >= MAX_REPORTS_PER_WINDOW) {
    return { kind: "deny", reason: "too-many" };
  }
  return { kind: "allow" };
}
