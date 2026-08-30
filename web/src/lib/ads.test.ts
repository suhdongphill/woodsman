/**
 * 광고 설정 회귀 테스트.
 *
 * ⚠ 2026-08-30: 소스를 환경변수에서 **관리자 설정**으로 옮기면서 다시 썼다.
 *    핵심 규칙은 그대로다 — 형식이 틀린 ID로 요청을 쏘지 않고,
 *    **스위치가 꺼져 있으면 아무것도 그리지 않는다.**
 */
import { describe, expect, it } from "vitest";
import {
  AD_MIN_HEIGHT,
  AD_PLACEMENTS,
  EMPTY_ADS_SETTINGS,
  adSlotId,
  adsStatus,
  adsTxtBody,
  adsenseClientId,
  isAdsLive,
  isValidClientId,
  isValidSlotId,
  type AdsSettings,
} from "./ads";

const CLIENT = "ca-pub-1234567890123456";
const live: AdsSettings = {
  enabled: true,
  clientId: CLIENT,
  slots: { "article-end": "1234567890", "feed-end": null, "content-bottom": "9876543210" },
};

describe("퍼블리셔 ID", () => {
  it("형식이 맞으면 받는다(앞뒤 공백은 다듬는다)", () => {
    expect(adsenseClientId({ ...live, clientId: `  ${CLIENT} ` })).toBe(CLIENT);
  });

  it("⚠ 형식이 아니면 null — 오타난 ID로 요청을 쏘지 않는다", () => {
    for (const bad of ["", "  ", "pub-123", "ca-pub-", "ca-pub-abc", "ca-pub-123", "YOUR_ID"]) {
      expect(adsenseClientId({ ...live, clientId: bad }), bad).toBeNull();
    }
    expect(adsenseClientId(EMPTY_ADS_SETTINGS)).toBeNull();
  });
});

describe("⚠ 등록과 노출은 다른 스위치다", () => {
  it("ID가 다 있어도 꺼져 있으면 아무것도 안 나간다", () => {
    const off = { ...live, enabled: false };
    expect(isAdsLive(off)).toBe(false);
    expect(adSlotId("article-end", off)).toBeNull();
    expect(adsStatus(off).clientConfigured).toBe(true); // 등록은 돼 있다
    expect(adsStatus(off).live).toBe(false); // 나가지는 않는다
  });

  it("켜져 있어도 ID가 없으면 안 나간다", () => {
    const noId = { ...live, clientId: null };
    expect(isAdsLive(noId)).toBe(false);
    expect(adSlotId("article-end", noId)).toBeNull();
  });
});

describe("슬롯", () => {
  it("퍼블리셔 ID와 슬롯이 둘 다 있어야 그린다", () => {
    expect(adSlotId("article-end", live)).toBe("1234567890");
    expect(adSlotId("feed-end", live)).toBeNull();
  });

  it("⚠ 숫자가 아닌 슬롯은 무시한다 — 빈 자리만 남는다", () => {
    expect(adSlotId("article-end", { ...live, slots: { "article-end": "slot-1" } })).toBeNull();
  });

  it("자리마다 최소 높이가 있다 — 로드 후 콘텐츠가 밀리지 않게", () => {
    for (const p of AD_PLACEMENTS) expect(AD_MIN_HEIGHT[p]).toBeGreaterThan(0);
  });
});

describe("입력 검증", () => {
  it("저장 전에 형식을 본다", () => {
    expect(isValidClientId(CLIENT)).toBe(true);
    expect(isValidClientId("ca-pub-12")).toBe(false);
    expect(isValidSlotId("1234567890")).toBe(true);
    expect(isValidSlotId("12345")).toBe(false);
  });
});

describe("ads.txt", () => {
  it("ca-pub- 접두사를 떼고 규격대로 적는다", () => {
    expect(adsTxtBody(live)).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    );
  });

  it("⚠ ID가 없으면 null — 잘못된 ads.txt는 없느니만 못하다", () => {
    expect(adsTxtBody(EMPTY_ADS_SETTINGS)).toBeNull();
    expect(adsTxtBody({ ...live, clientId: "ca-pub-abc" })).toBeNull();
  });

  it("⚠ 스위치와 무관하게 ID만 있으면 낸다 — 심사 중에도 ads.txt는 있어야 한다", () => {
    expect(adsTxtBody({ ...live, enabled: false })).not.toBeNull();
  });
});

describe("상태 요약", () => {
  it("등록됨과 나가는 중을 나눠서 준다", () => {
    const s = adsStatus(live);
    expect(s.clientConfigured).toBe(true);
    expect(s.live).toBe(true);
    expect(s.placements.find((p) => p.placement === "article-end")?.live).toBe(true);
    expect(s.placements.find((p) => p.placement === "feed-end")?.configured).toBe(false);
  });
});
