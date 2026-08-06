/**
 * 방문·조회 집계 규칙 — 순수 함수.
 *
 * ## 무엇을 세고 무엇을 세지 않나
 * **(경로, 날짜, 합계)**만 센다. 쿠키를 심지 않고 IP·UA·리퍼러를 저장하지 않는다.
 * 티스토리 클릭 집계(`lib/outbound.ts`)와 같은 규칙이고, `/privacy`의
 * "회원정보를 수집하지 않는다"와 어긋나지 않게 유지한다.
 *
 * 그래서 **개인별 방문자 수(UV)는 낼 수 없다.** 낼 수 있는 것은 페이지뷰다.
 * 이름을 "방문자"라고 쓰면 없는 정확도를 파는 것이라, 화면에도 **조회수**로 적는다.
 *
 * ## 새로고침을 어떻게 다루나
 * 서버는 누가 눌렀는지 모른다. 대신 브라우저가 **같은 세션에서 같은 경로는 한 번만** 보낸다
 * (`sessionStorage`, 서버로 가지 않는 값). 완벽한 중복 제거는 아니지만,
 * 쿠키 없이 할 수 있는 선까지다.
 */
import { safeNextPath } from "./access";
import { clickDateKey } from "./outbound";

/** 집계 날짜(KST). ⚠ 티스토리 클릭과 **같은 함수**를 쓴다 — 두 지표의 '오늘'이 달라지면 안 된다. */
export const viewDateKey = clickDateKey;

/** 집계에서 빼는 경로. 운영 화면과 기계용 경로는 콘텐츠가 아니다. */
const EXCLUDED_PREFIXES = ["/admin", "/api", "/login", "/register", "/go/", "/_next"];

/**
 * 기록할 경로로 정리한다. 기록할 수 없으면 null.
 *
 * ⚠ 쿼리스트링을 **버린다.** 검색어·UTM에 개인정보가 실려 올 수 있고, 같은 글이 여러 줄로
 *    쪼개져 집계가 흩어진다.
 */
export function normalizePath(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  const noQuery = raw.split(/[?#]/)[0].trim();
  // ⚠ "우리 사이트 안의 경로인가"는 이미 `access.safeNextPath`가 판정한다.
  //    직접 만들면 `/\evil.com` 같은 변형을 빠뜨린다(실제로 빠뜨렸다).
  //    여기 저장된 경로는 관리자 화면에 **링크로 렌더**되므로 그냥 두면 안 된다.
  if (safeNextPath(noQuery, "") === "") return null;
  if (noQuery.includes("..")) return null;
  if (noQuery.length > 200) return null;

  const path = noQuery.length > 1 ? noQuery.replace(/\/+$/, "") : "/";
  if (EXCLUDED_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p))) {
    return null;
  }
  return path;
}

/**
 * 크롤러·봇이면 true.
 *
 * ⚠ UA는 **판정에만 쓰고 저장하지 않는다.** 봇을 세면 "사람이 몇 번 봤나"가 아니라
 *    "구글이 몇 번 왔나"가 되어 지표가 쓸모없어진다.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // UA 없는 요청은 사람이 아니라고 본다
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|preview|headless|lighthouse|pagespeed|monitor|curl|wget|python-requests|axios|node-fetch/i.test(
    userAgent,
  );
}

/** `/insights/three-bucket` → `three-bucket`. 글이 아니면 null. */
export function postSlugFromPath(path: string): string | null {
  const match = /^\/insights\/([a-z0-9][a-z0-9-]*)$/.exec(path);
  return match ? match[1] : null;
}

export type DailyCount = { date: string; count: number };

/**
 * 최근 N일을 **빠짐없이** 채운다.
 * 값이 없는 날을 건너뛰면 막대그래프에서 날짜 간격이 거짓말을 한다(주말이 사라진다).
 */
export function fillDailySeries(rows: DailyCount[], days: number, now = new Date()): DailyCount[] {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const out: DailyCount[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = viewDateKey(new Date(now.getTime() - i * 86_400_000));
    out.push({ date, count: byDate.get(date) ?? 0 });
  }
  return out;
}

/**
 * 전주 대비 증감률(%). 앞 기간이 0이면 **비교하지 않는다**(undefined) —
 * 0에서 1로 늘어난 것을 "+100%"로 적으면 성장처럼 읽힌다.
 */
export function changePct(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type ViewSummary = {
  today: number;
  week: number;
  /** 전주 대비 증감률. 앞 기간이 0이면 undefined(비교하지 않는다) */
  weekChangePct?: number;
  /** 최근 7일 — 값이 없는 날도 0으로 채워져 있다 */
  daily: DailyCount[];
};

/**
 * 최근 14일치 일별 합계 하나로 오늘·이번 주·전주·그래프를 모두 낸다.
 *
 * ## 왜 계산을 repository에서 뺐나
 * 기간을 어떻게 자르는지(오늘은 언제부터, 한 주는 며칠인지)는 **판단**이지 질의가 아니다.
 * 여기 있어야 테스트로 고정된다 — 경계 하루가 밀리면 지표가 통째로 어긋난다.
 */
export function summarizeViews(rows: DailyCount[], now = new Date()): ViewSummary {
  const today = viewDateKey(now);
  const dayKey = (back: number) => viewDateKey(new Date(now.getTime() - back * 86_400_000));

  const sumBetween = (from: string, to: string) =>
    rows.filter((r) => r.date >= from && r.date <= to).reduce((sum, r) => sum + r.count, 0);

  const week = sumBetween(dayKey(6), today);
  const prevWeek = sumBetween(dayKey(13), dayKey(7));

  return {
    today: rows.find((r) => r.date === today)?.count ?? 0,
    week,
    weekChangePct: changePct(week, prevWeek),
    daily: fillDailySeries(rows, 7, now),
  };
}
