import { describe, expect, it } from "vitest";
import {
  COMMENT_WINDOW_SECONDS,
  DUPLICATE_WINDOW_SECONDS,
  MAX_COMMENTS_PER_WINDOW,
  MAX_REPORTS_PER_WINDOW,
  RECENT_SCAN_LIMIT,
  checkCommentThrottle,
  checkReportThrottle,
  humanizeWait,
  normalizeForDuplicate,
  windowStart,
  type RecentComment,
} from "./comment-throttle";

const T0 = new Date("2026-08-22T10:00:00.000Z");
const secondsAgo = (s: number) => new Date(T0.getTime() - s * 1000).toISOString();

/** 창 안에 `n`건이 고르게 들어 있는 최근 목록(최신순). */
function recentBurst(n: number, gap = 10): RecentComment[] {
  return Array.from({ length: n }, (_, i) => ({
    body: `서로 다른 내용 ${i}`,
    createdAt: secondsAgo(i * gap),
  }));
}

describe("중복 정규화", () => {
  it("대소문자·앞뒤 공백·줄바꿈은 같은 글로 본다", () => {
    expect(normalizeForDuplicate("  Spam\nSpam  ")).toBe(normalizeForDuplicate("spam spam"));
  });

  it("⚠ 문장부호는 지우지 않는다 — 다른 말이 같은 말이 되면 정상 댓글이 막힌다", () => {
    expect(normalizeForDuplicate("좋다.")).not.toBe(normalizeForDuplicate("좋다?"));
  });
});

describe("중복 방지", () => {
  it("같은 내용을 다시 보내면 거절한다", () => {
    const verdict = checkCommentThrottle({
      recent: [{ body: "광고입니다", createdAt: secondsAgo(3600) }],
      body: "  광고입니다  ",
      now: T0,
    });
    expect(verdict).toEqual({ kind: "deny", reason: "duplicate", message: expect.any(String) });
  });

  it("⚠ 속도보다 먼저 본다 — 기다렸다 또 보내게 두지 않는다", () => {
    const recent = recentBurst(MAX_COMMENTS_PER_WINDOW);
    recent[0] = { body: "같은 글", createdAt: secondsAgo(5) };
    const verdict = checkCommentThrottle({ recent, body: "같은 글", now: T0 });
    expect(verdict).toMatchObject({ reason: "duplicate" });
  });

  it("내용이 다르면 통과한다", () => {
    const verdict = checkCommentThrottle({
      recent: [{ body: "다른 글", createdAt: secondsAgo(10) }],
      body: "새 글",
      now: T0,
    });
    expect(verdict.kind).toBe("allow");
  });

  it("빈 본문은 중복으로 뭉치지 않는다 — 길이 검사는 validateCommentBody가 한다", () => {
    const verdict = checkCommentThrottle({
      recent: [{ body: "   ", createdAt: secondsAgo(10) }],
      body: "   ",
      now: T0,
    });
    expect(verdict.kind).toBe("allow");
  });
});

describe("속도 제한", () => {
  it("상한 직전까지는 받는다", () => {
    const verdict = checkCommentThrottle({
      recent: recentBurst(MAX_COMMENTS_PER_WINDOW - 1),
      body: "새 글",
      now: T0,
    });
    expect(verdict.kind).toBe("allow");
  });

  it("상한에 닿으면 거절하고 얼마나 기다려야 하는지 말해 준다", () => {
    const verdict = checkCommentThrottle({
      recent: recentBurst(MAX_COMMENTS_PER_WINDOW),
      body: "새 글",
      now: T0,
    });
    expect(verdict).toMatchObject({ kind: "deny", reason: "too-fast" });
    if (verdict.kind === "deny") expect(verdict.message).toMatch(/뒤에 다시/);
  });

  it("창을 벗어난 것은 세지 않는다 — 어제 쓴 글이 오늘을 막지 않는다", () => {
    const old = Array.from({ length: MAX_COMMENTS_PER_WINDOW }, (_, i) => ({
      body: `옛 글 ${i}`,
      createdAt: secondsAgo(COMMENT_WINDOW_SECONDS + 60 + i),
    }));
    expect(checkCommentThrottle({ recent: old, body: "새 글", now: T0 }).kind).toBe("allow");
  });

  it("⚠ 잘려 온 목록도 결론을 바꾸지 않는다 — 상한보다 넉넉히 읽는다", () => {
    expect(RECENT_SCAN_LIMIT).toBeGreaterThan(MAX_COMMENTS_PER_WINDOW);
  });

  it("읽을 수 없는 시각은 판정에서 뺀다 — 없는 확신을 팔지 않는다", () => {
    const broken = Array.from({ length: MAX_COMMENTS_PER_WINDOW }, (_, i) => ({
      body: `깨진 ${i}`,
      createdAt: "언젠가",
    }));
    expect(checkCommentThrottle({ recent: broken, body: "새 글", now: T0 }).kind).toBe("allow");
  });
});

describe("창 계산", () => {
  it("windowStart는 그만큼 과거를 가리킨다", () => {
    expect(windowStart(T0, 60)).toBe(secondsAgo(60));
  });

  it("⚠ 중복 창이 속도 창보다 길다 — 도배는 '빠르게'가 아니라 '같은 걸 계속'이다", () => {
    expect(DUPLICATE_WINDOW_SECONDS).toBeGreaterThan(COMMENT_WINDOW_SECONDS);
  });

  it("0분 뒤라고 말하지 않는다", () => {
    expect(humanizeWait(0)).toBe("1초");
    expect(humanizeWait(59)).toBe("59초");
    expect(humanizeWait(61)).toBe("2분");
  });
});

describe("신고", () => {
  it("처음 신고는 받는다", () => {
    expect(checkReportThrottle({ alreadyReported: false, recentReportCount: 0 })).toEqual({
      kind: "allow",
    });
  });

  it("이미 신고한 것은 다시 세지 않는다", () => {
    expect(
      checkReportThrottle({ alreadyReported: true, recentReportCount: 0 }),
    ).toMatchObject({ reason: "already" });
  });

  it("한 사람이 창 안에서 도배하면 막는다", () => {
    expect(
      checkReportThrottle({ alreadyReported: false, recentReportCount: MAX_REPORTS_PER_WINDOW }),
    ).toMatchObject({ reason: "too-many" });
  });
});
