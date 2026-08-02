/**
 * 광고 설정 회귀 테스트.
 *
 * 여기가 깨지면 "심사도 안 났는데 광고 요청이 나간다" 또는
 * "잘못된 ID로 요청을 쏜다"는 뜻이다. 둘 다 계정 정지로 이어질 수 있다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AD_MIN_HEIGHT, adSlotId, adsStatus, adsenseClientId, isAdsEnabled } from "./ads";

const CLIENT = "ca-pub-1234567890123456";

describe("퍼블리셔 ID", () => {
  it("형식이 맞을 때만 유효하다", () => {
    expect(adsenseClientId({ ADSENSE_CLIENT_ID: CLIENT })).toBe(CLIENT);
    expect(adsenseClientId({ ADSENSE_CLIENT_ID: "  " + CLIENT + " " })).toBe(CLIENT);
  });

  it("오타·자리표시자는 거부한다", () => {
    for (const bad of ["", "  ", "pub-123", "ca-pub-", "ca-pub-abc", "ca-pub-123", "YOUR_ID_HERE"]) {
      expect(adsenseClientId({ ADSENSE_CLIENT_ID: bad }), bad).toBeNull();
    }
    expect(adsenseClientId({})).toBeNull();
  });

  it("설정이 없으면 광고를 켜지 않는다", () => {
    expect(isAdsEnabled({})).toBe(false);
    expect(isAdsEnabled({ ADSENSE_CLIENT_ID: CLIENT })).toBe(true);
  });
});

describe("광고 자리", () => {
  it("퍼블리셔 ID와 슬롯 ID가 둘 다 있어야 그린다", () => {
    // 슬롯만 있고 퍼블리셔가 없으면 안 된다
    expect(adSlotId("article-end", { ADSENSE_SLOT_ARTICLE_END: "1234567890" })).toBeNull();
    // 퍼블리셔만 있고 슬롯이 없어도 안 된다(빈 영역이 남는다)
    expect(adSlotId("article-end", { ADSENSE_CLIENT_ID: CLIENT })).toBeNull();
    // 둘 다 있어야 한다
    expect(
      adSlotId("article-end", { ADSENSE_CLIENT_ID: CLIENT, ADSENSE_SLOT_ARTICLE_END: "1234567890" }),
    ).toBe("1234567890");
  });

  it("숫자가 아닌 슬롯 ID는 거부한다", () => {
    expect(
      adSlotId("feed-end", { ADSENSE_CLIENT_ID: CLIENT, ADSENSE_SLOT_FEED_END: "slot-1" }),
    ).toBeNull();
  });

  it("모든 자리에 CLS 방지용 최소 높이가 있다", () => {
    for (const [placement, h] of Object.entries(AD_MIN_HEIGHT)) {
      expect(h, placement).toBeGreaterThan(0);
    }
  });

  it("상태 요약은 키 값을 노출하지 않는다", () => {
    const status = adsStatus({ ADSENSE_CLIENT_ID: CLIENT, ADSENSE_SLOT_FEED_END: "1234567890" });
    const json = JSON.stringify(status);
    expect(json).not.toContain(CLIENT);
    expect(json).not.toContain("1234567890");
    expect(status.clientConfigured).toBe(true);
  });
});

describe("배치 정책", () => {
  const APP = join(process.cwd(), "src", "app");

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }

  const withAds = walk(APP)
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ file: f, body: readFileSync(f, "utf8") }))
    .filter((p) => /<AdSlot\b/.test(p.body));

  it("실제로 광고를 배치한 화면이 있다", () => {
    expect(withAds.length).toBeGreaterThan(0);
  });

  it("관리자·로그인·정책 화면에는 광고를 넣지 않는다", () => {
    // 콘텐츠가 없는 화면의 광고는 AdSense 정책 위반이고, 운영 화면은 애초에 대상이 아니다.
    for (const p of withAds) {
      const normalized = p.file.replace(/\\/g, "/");
      expect(normalized, p.file).not.toMatch(
        /\/admin\/|\/login\/|\/register\/|\/privacy\/|\/disclaimer\/|\/about\//,
      );
    }
  });
});
