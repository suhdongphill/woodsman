/**
 * Envelope 밴드 — **20주 이동평균 ±20%** — 순수 계산.
 *
 * ## 왜 계산으로 내는가
 * `docs/아이디어_노트.md` A4가 이유다. LG이노텍 보고서 §2의 밴드는 시세 시계열만 있으면
 * **사람이 쓸 필요가 없다.** 쓰는 비용을 낮추는 것이 보고서를 실제로 쓰게 만든다.
 *
 * ## ⚠ 이것은 매매 지시가 아니다
 * A4가 못 박아 둔 규칙 — **"손절 기준선"으로 렌더하지 않는다.**
 * 여기서는 밴드와 **현재 위치**까지만 낸다. 🟢신규매수/🔴손절 같은 대응은 사람이 §09에 쓴다.
 * `WOODSMAN_DOCTRINE`이 금지하는 것이 정확히 그 자리다.
 *
 * ## ⚠ 주(週) 단위다
 * 20**주** 이동평균이므로 일봉 20개가 아니다. 일봉을 주봉으로 접은 뒤(각 주의 마지막 종가)
 * 20개를 평균한다. 일봉 20개로 내면 완전히 다른 선이 되고, 그 사실이 화면에서 보이지 않는다.
 */
import type { QuotePoint } from "./types";
import { normalizeQuotes } from "./kpi";

/** 이동평균 구간 — 주 단위. 설계서 §2-B가 지정한 값이다. */
export const ENVELOPE_WEEKS = 20;

/** 밴드 폭 %. 중심선에서 위아래로 이만큼. */
export const ENVELOPE_PERCENT = 20;

export type WeeklyClose = {
  /** 그 주의 마지막 거래일 (YYYY-MM-DD) */
  date: string;
  close: number;
};

export type Envelope = {
  /** 중심선 — 20주 이동평균 */
  middle: number;
  /** 상단 (+20%) */
  upper: number;
  /** 하단 (−20%) */
  lower: number;
  /** 밴드를 낸 기준일 = 가장 최근 주의 마지막 거래일 */
  asOf: string;
  /** 계산에 실제로 쓴 주 수. `ENVELOPE_WEEKS`보다 적으면 화면이 그렇게 말한다 */
  weeks: number;
  /** 현재가 */
  price: number;
  /**
   * 현재가의 밴드 내 위치. 0=하단 · 50=중심선 · 100=상단.
   * ⚠ 밴드를 벗어나면 0 미만·100 초과가 그대로 나온다. **자르지 않는다** —
   *    "상단에 딱 붙었다"와 "상단을 30% 뚫었다"는 완전히 다른 상황이다.
   */
  position: number;
  /** 중심선 대비 괴리율 % */
  deviation: number;
};

/**
 * 일봉을 주봉으로 접는다 — 각 주의 **마지막 거래일 종가**.
 *
 * 주의 경계는 ISO 8601(월요일 시작)을 쓴다. 한국·미국 모두 주중 거래이므로
 * 월~금이 한 주로 묶인다.
 */
export function toWeeklyCloses(points: QuotePoint[]): WeeklyClose[] {
  const sorted = normalizeQuotes(points);
  const byWeek = new Map<string, WeeklyClose>();
  for (const p of sorted) {
    const key = isoWeekKey(p.date);
    if (!key) continue;
    // 오름차순이므로 나중에 오는 것이 그 주의 마지막 거래일이다.
    byWeek.set(key, { date: p.date, close: p.close });
  }
  return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

/** YYYY-Www — ISO 주 키. 형식이 아니면 undefined. */
export function isoWeekKey(date: string): string | undefined {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  // ISO: 목요일이 속한 해가 그 주의 해다.
  const day = (d.getUTCDay() + 6) % 7; // 월=0 … 일=6
  d.setUTCDate(d.getUTCDate() - day + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Envelope 밴드.
 *
 * ⚠ 주봉이 하나도 없으면 undefined다.
 * ⚠ 20주가 안 차면 **있는 만큼으로 내고 `weeks`에 몇 주인지 적는다.**
 *    계산을 거부하면 상장 1년 미만 종목의 §09가 통째로 빈다. 대신 몇 주짜리인지는 숨기지 않는다.
 */
export function buildEnvelope(
  points: QuotePoint[],
  options?: { weeks?: number; percent?: number },
): Envelope | undefined {
  const weeklyWindow = options?.weeks ?? ENVELOPE_WEEKS;
  const percent = options?.percent ?? ENVELOPE_PERCENT;

  const weekly = toWeeklyCloses(points);
  if (weekly.length === 0) return undefined;

  const window = weekly.slice(-weeklyWindow);
  const middle = window.reduce((sum, w) => sum + w.close, 0) / window.length;
  // ⚠ 중심선이 0이면 밴드도 괴리율도 뜻이 없다.
  if (middle === 0) return undefined;

  const upper = middle * (1 + percent / 100);
  const lower = middle * (1 - percent / 100);
  const price = weekly[weekly.length - 1].close;

  return {
    middle,
    upper,
    lower,
    asOf: weekly[weekly.length - 1].date,
    weeks: window.length,
    price,
    position: ((price - lower) / (upper - lower)) * 100,
    deviation: ((price - middle) / middle) * 100,
  };
}

/**
 * 밴드 위치를 **읽는 말**로.
 *
 * ⚠ 여기에 "사라/팔아라"를 넣지 않는다. 상태 서술까지만이다.
 */
export function describeEnvelope(envelope: Envelope): string {
  const dev = envelope.deviation;
  const where =
    envelope.position > 100
      ? "상단 밴드를 위로 벗어나 있습니다"
      : envelope.position < 0
        ? "하단 밴드를 아래로 벗어나 있습니다"
        : envelope.position >= 75
          ? "상단 밴드에 가깝습니다"
          : envelope.position <= 25
            ? "하단 밴드에 가깝습니다"
            : "밴드 중앙 부근입니다";

  const sign = dev >= 0 ? "+" : "";
  const base = `${envelope.weeks}주 이동평균 대비 ${sign}${dev.toFixed(1)}% — ${where}.`;

  // ⚠ 20주가 안 찼으면 그 사실을 문장이 말한다. 숨기면 같은 굵기의 판단으로 읽힌다.
  return envelope.weeks < ENVELOPE_WEEKS
    ? `${base} (⚠ ${ENVELOPE_WEEKS}주가 아직 차지 않아 ${envelope.weeks}주로 계산했습니다)`
    : base;
}
