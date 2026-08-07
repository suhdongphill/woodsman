/**
 * 아웃바운드 경유 회귀 테스트.
 *
 * 가장 중요한 검사는 **오픈 리다이렉트 방지**다. 우리 도메인이 임의의 주소로
 * 사람을 보내는 경유지가 되면 피싱에 쓰이고 도메인 평판이 망가진다.
 */
import { describe, expect, it } from "vitest";
import {
  OUTBOUND_TARGETS,
  clickDateKey,
  isOutboundTarget,
  outboundDestinations,
  outboundHref,
  outboundPostHref,
  resolveOutbound,
} from "./outbound";

describe("오픈 리다이렉트 방지", () => {
  it("등록되지 않은 대상은 전부 거부한다", () => {
    const attacks = [
      "https://evil.com",
      "//evil.com",
      "http://evil.com",
      "post-",
      "post-../../etc",
      "javascript:alert(1)",
      "",
      "unknown",
      "TISTORY",
    ];
    for (const target of attacks) {
      expect(resolveOutbound(target), target).toBeNull();
    }
  });

  it("돌려주는 목적지는 항상 우리가 등록한 값에서만 나온다", () => {
    const allowed = new Set<string>(Object.values(OUTBOUND_TARGETS));
    for (const key of Object.keys(OUTBOUND_TARGETS)) {
      expect(allowed.has(resolveOutbound(key)!)).toBe(true);
    }
  });

  it("⚠ 글 조회 함수를 주지 않으면 post- 경유는 목적지가 없다", () => {
    expect(resolveOutbound("post-어떤글")).toBeNull();
  });

  it("티스토리 원문이 없는 글은 경유해도 목적지가 없다", () => {
    expect(resolveOutbound("post-self-post", () => null)).toBeNull();
  });

  it("티스토리 원문이 있는 글은 그 원문으로만 간다", () => {
    const url = "https://suhdp.tistory.com/entry/x";
    expect(resolveOutbound("post-tistory-post", () => url)).toBe(url);
  });
});

describe("등록 대상", () => {
  it("tistory 대상이 존재하고 티스토리 주소를 가리킨다", () => {
    expect(isOutboundTarget("tistory")).toBe(true);
    expect(resolveOutbound("tistory")).toContain("suhdp.tistory.com");
  });

  it("링크 헬퍼가 /go 경로를 만든다", () => {
    expect(outboundHref("tistory")).toBe("/go/tistory");
    expect(outboundPostHref("abc")).toBe("/go/post-abc");
  });
});

describe("집계 날짜", () => {
  it("KST 기준으로 하루를 자른다", () => {
    // UTC 2026-08-02 15:30 = KST 2026-08-03 00:30 → 다음 날로 세야 한다
    expect(clickDateKey(new Date("2026-08-02T15:30:00Z"))).toBe("2026-08-03");
    // UTC 2026-08-02 14:30 = KST 2026-08-02 23:30 → 아직 같은 날
    expect(clickDateKey(new Date("2026-08-02T14:30:00Z"))).toBe("2026-08-02");
  });

  it("사전순 비교가 시간순 비교와 같다(집계 쿼리가 이에 의존한다)", () => {
    const a = clickDateKey(new Date("2026-08-02T00:00:00Z"));
    const b = clickDateKey(new Date("2026-09-01T00:00:00Z"));
    expect(a < b).toBe(true);
  });
});

describe("목적지는 관리자가 저장한 값을 쓴다", () => {
  // 2026-08-07 점검: 저장한 티스토리 주소가 무시되고 코드 상수로만 나갔다.
  const saved = outboundDestinations({
    tistoryFeaturedUrl: "https://example.tistory.com/99",
    tistoryBlogUrl: "https://example.tistory.com",
  });

  it("설정값을 넘기면 그 주소로 간다", () => {
    expect(resolveOutbound("tistory", undefined, saved)).toBe("https://example.tistory.com/99");
    expect(resolveOutbound("tistory-home", undefined, saved)).toBe("https://example.tistory.com");
  });

  it("안 넘기면 코드 기본값으로 떨어진다 — DB를 못 읽어도 링크가 죽지 않는다", () => {
    expect(resolveOutbound("tistory")).toBe(OUTBOUND_TARGETS.tistory);
  });

  it("⚠ 설정값을 줘도 등록되지 않은 대상은 여전히 거부한다(오픈 리다이렉트 방지)", () => {
    expect(resolveOutbound("evil", undefined, saved)).toBeNull();
    expect(resolveOutbound("https://evil.com", undefined, saved)).toBeNull();
    expect(resolveOutbound("//evil.com", undefined, saved)).toBeNull();
  });
});
