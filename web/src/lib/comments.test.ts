import { describe, expect, it } from "vitest";
import {
  canSubmitComment,
  countByTab,
  findBannedWord,
  initialCommentStatus,
  isCommentAction,
  isPubliclyVisible,
  matchesTab,
  needsAttention,
  parseBannedWords,
  resolveCommentAction,
  resolveCommentTab,
  validateCommentBody,
  COMMENT_MAX_LENGTH,
} from "./comments";

const c = (over: Partial<{ id: string; status: string; reported: boolean }> = {}) =>
  ({
    id: over.id ?? "c1",
    status: (over.status ?? "VISIBLE") as "VISIBLE" | "PENDING" | "HIDDEN",
    reported: over.reported ?? false,
  }) as const;

describe("탭 해석", () => {
  it("모르는 값은 '전체'로 떨어진다", () => {
    expect(resolveCommentTab(undefined)).toBe("all");
    expect(resolveCommentTab("")).toBe("all");
    expect(resolveCommentTab("승인대기")).toBe("all");
    expect(resolveCommentTab("__proto__")).toBe("all");
  });

  it("아는 값은 그대로 쓴다", () => {
    expect(resolveCommentTab("pending")).toBe("pending");
    expect(resolveCommentTab("reported")).toBe("reported");
    expect(resolveCommentTab("hidden")).toBe("hidden");
  });
});

describe("탭 필터", () => {
  const list = [
    c({ id: "1", status: "VISIBLE" }),
    c({ id: "2", status: "PENDING" }),
    c({ id: "3", status: "HIDDEN", reported: true }),
    c({ id: "4", status: "VISIBLE", reported: true }),
  ];

  it("신고됨은 상태와 무관하게 걸린다 — 노출 중인 신고 댓글을 놓치면 안 된다", () => {
    const reported = list.filter((x) => matchesTab(x, "reported")).map((x) => x.id);
    expect(reported).toEqual(["3", "4"]);
  });

  it("개수는 탭별로 따로 센다(합계가 전체를 넘을 수 있다)", () => {
    expect(countByTab(list)).toEqual({ all: 4, pending: 1, reported: 2, hidden: 1 });
  });

  it("손봐야 하는 것은 승인대기 + 신고됨을 중복 없이 센다", () => {
    expect(needsAttention([...list, c({ id: "5", status: "PENDING", reported: true })])).toBe(4);
  });
});

describe("금지어", () => {
  it("공백·빈 항목·중복을 걷어내고 소문자로 모은다", () => {
    expect(parseBannedWords(" 광고 , 광고,, AD ,")).toEqual(["광고", "ad"]);
    expect(parseBannedWords(undefined)).toEqual([]);
    expect(parseBannedWords("")).toEqual([]);
  });

  it("⚠ 대문자로 우회되지 않는다", () => {
    expect(findBannedWord("이건 AD 입니다", parseBannedWords("ad"))).toBe("ad");
  });

  it("걸리지 않으면 undefined", () => {
    expect(findBannedWord("평범한 의견입니다", parseBannedWords("광고,욕설"))).toBeUndefined();
  });
});

describe("새 댓글의 초기 상태", () => {
  it("⚠ 승인제가 꺼져 있어도 금지어는 숨긴다", () => {
    expect(
      initialCommentStatus({
        body: "○○종목 지금 사면 3배 갑니다 광고",
        moderationOn: false,
        bannedWords: parseBannedWords("광고"),
      }),
    ).toBe("HIDDEN");
  });

  it("승인제가 켜져 있으면 승인대기", () => {
    expect(initialCommentStatus({ body: "좋은 글이네요", moderationOn: true, bannedWords: [] })).toBe(
      "PENDING",
    );
  });

  it("아무것도 안 걸리면 즉시 노출", () => {
    expect(
      initialCommentStatus({ body: "좋은 글이네요", moderationOn: false, bannedWords: [] }),
    ).toBe("VISIBLE");
  });
});

describe("공개 노출", () => {
  it("VISIBLE만 공개된다", () => {
    expect(isPubliclyVisible({ status: "VISIBLE" })).toBe(true);
    expect(isPubliclyVisible({ status: "PENDING" })).toBe(false);
    expect(isPubliclyVisible({ status: "HIDDEN" })).toBe(false);
  });
});

describe("작성 가능 여부 — 화면과 서버 액션이 같은 답을 써야 한다", () => {
  const base = {
    commentsGloballyEnabled: true,
    postCommentsEnabled: true,
    requireLoginToComment: true,
    isLoggedIn: true,
  };

  it("전역 스위치가 꺼져 있으면 로그인해도 못 쓴다", () => {
    expect(canSubmitComment({ ...base, commentsGloballyEnabled: false })).toBe(false);
  });

  it("글별로 잠겨 있으면 못 쓴다", () => {
    expect(canSubmitComment({ ...base, postCommentsEnabled: false })).toBe(false);
  });

  it("로그인 요구가 켜져 있는데 비로그인이면 못 쓴다", () => {
    expect(canSubmitComment({ ...base, isLoggedIn: false })).toBe(false);
  });

  it("로그인 요구가 꺼져 있으면 비로그인도 쓸 수 있다", () => {
    expect(canSubmitComment({ ...base, requireLoginToComment: false, isLoggedIn: false })).toBe(
      true,
    );
  });
});

describe("관리자 조작", () => {
  it("모르는 조작은 받지 않는다", () => {
    expect(isCommentAction("approve")).toBe(true);
    expect(isCommentAction("purge")).toBe(false);
    expect(isCommentAction("")).toBe(false);
  });

  it("⚠ 승인·숨김 둘 다 신고 표시를 내린다 — 안 그러면 신고됨 탭에서 사라지지 않는다", () => {
    expect(resolveCommentAction("approve")).toEqual({
      kind: "status",
      status: "VISIBLE",
      reported: false,
    });
    expect(resolveCommentAction("hide")).toEqual({
      kind: "status",
      status: "HIDDEN",
      reported: false,
    });
  });

  it("삭제는 상태 변경이 아니다", () => {
    expect(resolveCommentAction("delete")).toEqual({ kind: "delete" });
  });
});

describe("본문 검증", () => {
  it("빈 내용·공백만은 거부한다", () => {
    expect(validateCommentBody("   ")).toEqual({ error: "내용을 입력해주세요." });
  });

  it("앞뒤 공백은 잘라서 저장한다", () => {
    expect(validateCommentBody("  의견입니다  ")).toEqual({ body: "의견입니다" });
  });

  it("상한을 넘으면 거부한다", () => {
    const over = validateCommentBody("가".repeat(COMMENT_MAX_LENGTH + 1));
    expect("error" in over).toBe(true);
  });
});
