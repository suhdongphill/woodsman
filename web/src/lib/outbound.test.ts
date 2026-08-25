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
  outboundStockHref,
  resolveOutbound, blogLinkForPost } from "./outbound";

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

describe("종목 보고서 경유 — stock-<ticker>", () => {
  it("저장해 둔 원문 URL로만 간다", () => {
    const url = "https://blog.tistory.com/42";
    expect(resolveOutbound("stock-TSM", undefined, undefined, () => url)).toBe(url);
  });

  it("⚠ 조회 함수를 주지 않으면 목적지가 없다 — 요청이 준 값을 따라가지 않는다", () => {
    expect(resolveOutbound("stock-TSM")).toBeNull();
  });

  it("원문을 안 적은 보고서는 목적지가 없다", () => {
    expect(resolveOutbound("stock-TSM", undefined, undefined, () => null)).toBeNull();
  });

  it("⚠ 국내 티커의 앞 0이 살아 있다 — 숫자로 다루면 005930이 5930이 된다", () => {
    let asked = "";
    resolveOutbound("stock-005930", undefined, undefined, (t) => {
      asked = t;
      return null;
    });
    expect(asked).toBe("005930");
  });

  it("경유 링크 모양", () => {
    expect(outboundStockHref("005930")).toBe("/go/stock-005930");
  });
});

describe("blogLinkForPost — 글 끝의 블로그 링크를 어디로 보낼 것인가", () => {
  /**
   * ⚠ 2026-08-25 사고 재현. 「직접 작성」 인사이트에 티스토리 원문 링크를 넣었는데
   *   화면이 그 값을 무시하고 대표 글로 보냈다. 입력란이 하는 일이 없는 상태였다.
   */
  it("⚠ 직접 작성 글이라도 원문 링크가 있으면 **그 글로** 간다", () => {
    const link = blogLinkForPost({
      slug: "rate-cut-2026",
      source: "SELF",
      externalUrl: "https://suhdp.tistory.com/12",
    });
    expect(link.kind).toBe("post");
    expect(link.kind === "post" && link.href).toBe("/go/post-rate-cut-2026");
  });

  it("원문 링크가 없으면 블로그 대표 글로 간다", () => {
    const link = blogLinkForPost({ slug: "rate-cut-2026", source: "SELF" });
    expect(link.kind).toBe("default");
    expect(link.kind === "default" && link.href).toBe("/go/tistory");
  });

  it("티스토리에서 가져온 글은 본문 위 원문 카드가 이미 링크를 줬으므로 붙이지 않는다", () => {
    expect(
      blogLinkForPost({
        slug: "x",
        source: "TISTORY",
        externalUrl: "https://suhdp.tistory.com/3",
      }).kind,
    ).toBe("none");
  });

  it("⚠ 티스토리 글인데 링크가 비었으면 대표 글로 보낸다 — 나가는 길을 없애지 않는다", () => {
    expect(blogLinkForPost({ slug: "x", source: "TISTORY" }).kind).toBe("default");
  });

  it("⚠ 어느 경우든 주소를 직접 내주지 않는다 — 경유해야 클릭이 세진다", () => {
    for (const post of [
      { slug: "a", source: "SELF", externalUrl: "https://suhdp.tistory.com/1" },
      { slug: "b", source: "SELF" },
    ]) {
      const link = blogLinkForPost(post);
      expect(link.kind === "none" || link.href.startsWith("/go/")).toBe(true);
    }
  });
});
