import { describe, expect, it } from "vitest";
import {
  changePct,
  summarizeViews,
  fillDailySeries,
  isBotUserAgent,
  normalizePath,
  postSlugFromPath,
  viewDateKey,
} from "./analytics";
import { clickDateKey } from "./outbound";

describe("경로 정리", () => {
  it("보통 경로는 그대로 센다", () => {
    expect(normalizePath("/macro")).toBe("/macro");
    expect(normalizePath("/")).toBe("/");
  });

  it("⚠ 쿼리스트링을 버린다 — 검색어·UTM이 집계에 남으면 안 된다", () => {
    expect(normalizePath("/insights/abc?utm_source=x&q=내이름")).toBe("/insights/abc");
    expect(normalizePath("/macro#anchor")).toBe("/macro");
  });

  it("끝의 슬래시를 없애 같은 글이 두 줄로 쪼개지지 않게 한다", () => {
    expect(normalizePath("/macro/rates/")).toBe("/macro/rates");
  });

  it("⚠ 운영 화면과 기계용 경로는 세지 않는다", () => {
    for (const p of ["/admin", "/admin/macro", "/api/view", "/login", "/go/tistory", "/_next/x"]) {
      expect(normalizePath(p), p).toBeNull();
    }
  });

  it("⚠ 남의 사이트로 읽히는 경로·상대경로 탈출을 막는다", () => {
    expect(normalizePath("//evil.com")).toBeNull();
    expect(normalizePath("/a/../../etc")).toBeNull();
    expect(normalizePath("https://evil.com/x")).toBeNull();
    expect(normalizePath("")).toBeNull();
    expect(normalizePath("x".repeat(300))).toBeNull();
  });
});

describe("봇 판정", () => {
  it("크롤러는 세지 않는다", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
  });

  it("보통 브라우저는 센다", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("⚠ UA가 없으면 사람이 아니라고 본다", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
  });
});

describe("글 slug 추출", () => {
  it("인사이트 상세만 글로 센다", () => {
    expect(postSlugFromPath("/insights/three-bucket")).toBe("three-bucket");
    expect(postSlugFromPath("/insights")).toBeNull();
    expect(postSlugFromPath("/macro/rates")).toBeNull();
  });
});

describe("날짜 시리즈", () => {
  const now = new Date("2026-08-06T12:00:00+09:00");

  it("⚠ 값이 없는 날도 0으로 채운다 — 건너뛰면 그래프의 간격이 거짓말을 한다", () => {
    const series = fillDailySeries([{ date: viewDateKey(now), count: 5 }], 7, now);
    expect(series).toHaveLength(7);
    expect(series[6].count).toBe(5);
    expect(series[0].count).toBe(0);
    // 오름차순(과거 → 오늘)
    expect(series[0].date < series[6].date).toBe(true);
  });

  it("집계 날짜는 티스토리 클릭과 같은 규칙을 쓴다", () => {
    expect(viewDateKey(now)).toBe(clickDateKey(now));
  });
});

describe("조회 요약", () => {
  const now = new Date("2026-08-06T12:00:00+09:00");
  const day = (back: number) => viewDateKey(new Date(now.getTime() - back * 86_400_000));

  it("최근 14일 합계 하나로 오늘·이번 주·전주 비교를 낸다", () => {
    const rows = [
      { date: day(0), count: 10 },
      { date: day(3), count: 5 },
      { date: day(8), count: 3 }, // 전주
    ];
    const s = summarizeViews(rows, now);
    expect(s.today).toBe(10);
    expect(s.week).toBe(15);
    // 전주 3 → 이번 주 15
    expect(s.weekChangePct).toBe(400);
    expect(s.daily).toHaveLength(7);
  });

  it("⚠ 주 경계는 오늘 포함 7일이다 — 하루가 밀리면 지표가 통째로 어긋난다", () => {
    const s = summarizeViews([{ date: day(6), count: 1 }, { date: day(7), count: 99 }], now);
    expect(s.week).toBe(1); // 7일 전은 이번 주가 아니다
  });

  it("기록이 없으면 0으로, 비교는 하지 않는다", () => {
    const s = summarizeViews([], now);
    expect(s.today).toBe(0);
    expect(s.week).toBe(0);
    expect(s.weekChangePct).toBeUndefined();
  });
});

describe("증감률", () => {
  it("보통은 백분율로", () => {
    expect(changePct(120, 100)).toBe(20);
    expect(changePct(80, 100)).toBe(-20);
  });

  it("⚠ 앞 기간이 0이면 비교하지 않는다 — 0에서 1을 '+100%'로 적으면 성장처럼 읽힌다", () => {
    expect(changePct(1, 0)).toBeUndefined();
  });
});
