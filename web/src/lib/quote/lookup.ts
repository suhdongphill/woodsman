/**
 * 티커 조회 — Yahoo 차트 응답의 `meta`에서 **종목의 신원**을 읽는다. 순수 함수.
 *
 * ## 왜 필요한가
 * 대표 포트폴리오에 종목을 넣을 때 이름·시장·통화·현재가를 **전부 손으로 쳤다.**
 * 그래서 티커만 치고 Enter를 누르면 나머지가 빈 종목이 그대로 등록됐다.
 * 조회를 먼저 하면 그 칸들이 채워지고, 사람은 **확인만** 하면 된다.
 *
 * ## ⚠ `shortName`을 믿지 않는다
 * 코스닥 종목(`035720.KQ`)의 `shortName`이 `"035720.KQ,0P0000AN5S,1145416"`처럼
 * **식별자 나열로 온다**(2026-08-17 실측). `longName`을 먼저 쓰고, 없을 때만 shortName을 쓴다.
 * 둘 다 이상하면 **이름을 만들어 내지 않는다** — 사람이 직접 적게 둔다.
 */

export type TickerProfile = {
  /** 종목명. ⚠ 못 읽으면 undefined — 티커를 이름으로 쓰지 않는다 */
  name?: string;
  /** 거래소 이름 (NasdaqGS · KSE · KOSDAQ) */
  exchange?: string;
  /** 통화 (USD · KRW) */
  currency?: string;
  /** 조회 시점의 종가 */
  price?: number;
  /** 그 값의 거래일 (YYYY-MM-DD) */
  asOf?: string;
  /** EQUITY · ETF · MUTUALFUND 등. ⚠ 그대로 보여 준다 — ETF를 주식으로 적지 않게 */
  instrumentType?: string;
};

type YahooMeta = {
  shortName?: unknown;
  longName?: unknown;
  currency?: unknown;
  fullExchangeName?: unknown;
  exchangeName?: unknown;
  instrumentType?: unknown;
  regularMarketPrice?: unknown;
  regularMarketTime?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * 이름으로 쓸 수 있는 값인가.
 *
 * ⚠ 쉼표로 이어 붙인 식별자 나열(`"035720.KQ,0P0000AN5S,1145416"`)을 걸러낸다.
 *    이런 값이 종목명 칸에 들어가면 공개 화면에 그대로 나간다.
 */
export function looksLikeName(value: string | undefined): boolean {
  if (!value) return false;
  if (value.includes(",")) return false;
  // 숫자·점만으로 이뤄진 값은 티커지 이름이 아니다.
  if (/^[\d.]+$/.test(value)) return false;
  return true;
}

/** Yahoo 차트 응답 → 종목 신원. 못 읽은 칸은 **비워 둔다**(지어내지 않는다). */
export function parseTickerProfile(json: unknown): TickerProfile | undefined {
  const result = (json as { chart?: { result?: { meta?: YahooMeta }[] } })?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) return undefined;

  const long = str(meta.longName);
  const short = str(meta.shortName);
  // ⚠ longName 먼저. shortName은 코스닥에서 식별자 나열로 오는 일이 있다.
  const name = looksLikeName(long) ? long : looksLikeName(short) ? short : undefined;

  const stamp = num(meta.regularMarketTime);

  return {
    name,
    exchange: str(meta.fullExchangeName) ?? str(meta.exchangeName),
    currency: str(meta.currency),
    price: num(meta.regularMarketPrice),
    asOf: stamp ? new Date(stamp * 1000).toISOString().slice(0, 10) : undefined,
    instrumentType: str(meta.instrumentType),
  };
}

/**
 * 조회 결과가 **쓸 만한가**.
 *
 * ⚠ 이름도 가격도 못 읽었으면 조회에 실패한 것으로 본다. 빈 결과를 성공으로 처리하면
 *    "조회했는데 아무것도 안 채워졌다"가 되어, 손으로 친 것과 구분이 안 된다.
 */
export function isUsableProfile(profile: TickerProfile | undefined): profile is TickerProfile {
  return !!profile && (profile.name !== undefined || profile.price !== undefined);
}
