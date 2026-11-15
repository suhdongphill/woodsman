/**
 * 「금리 방향」 카드의 인용 문구 — 순수 모듈(2026-11-15).
 *
 * 왜: 카드는 11/13 선물 기준 110%인데, 같은 주에 게시한 글은 11/12 스냅샷 118%를 썼다. **기준일이 다른 값이 같이 돌아다녔다.**
 * 글·브리핑에 옮길 때 쓰는 문구에 **선물 관측일**이 자동으로 붙게 한다 — 날짜 없는 확률은 옮기는 순간 「오늘 값」처럼 읽힌다.
 * ⚠ 숫자를 새로 계산하지 않는다. 카드가 보여 준 값 그대로 문장에 넣는다(채우지도 반올림을 바꾸지도 않는다).
 */
import { formatKstStamp } from "@/lib/format";

export type FedCitationInput = {
  /** 선물 시세의 날짜(관측일, YYYY-MM-DD) */
  observedOn: string;
  /** 「2026-12」 */
  contractMonth: string;
  /** 회의 하나만 걸린 계약이면 그 회의 날짜 */
  meeting?: string;
  singleMeeting: boolean;
  dir: "인상" | "인하";
  /** 카드의 큰 숫자 그대로(%) — 1을 넘을 수 있다(두 번이면 200%) */
  sharePct: number;
  currentRate: number;
  /** 회의 뒤 금리를 풀었으면 */
  rateAfter?: number;
  /** 선물 값을 받은 시각(ISO) — 없으면 문구에서 뺀다(지어내지 않는다) */
  fetchedAt?: string | null;
};

export function fedFuturesCitation(c: FedCitationInput): string {
  const what = c.singleMeeting && c.meeting
    ? `${c.meeting} 회의에서 25bp ${c.dir} 한 번을 ${c.sharePct}% 반영합니다`
    : `${c.dir} 쪽으로 25bp 한 번 대비 ${c.sharePct}%를 반영합니다(계약월 안 회의 누적)`;
  const path = c.rateAfter !== undefined
    ? `(현재 ${c.currentRate.toFixed(2)}% → 회의 뒤 ${c.rateAfter.toFixed(2)}%)`
    : `(현재 ${c.currentRate.toFixed(2)}%)`;
  const fetched = formatKstStamp(c.fetchedAt);
  const tail = ["출처: Woodsman(portfolio-solutions.net)", fetched ? `수집 ${fetched}` : ""].filter(Boolean).join(" · ");
  return `연방기금 선물 ${c.observedOn} 관측(${c.contractMonth} 계약) 기준, 시장은 ${what}${path}. ${tail}`;
}
