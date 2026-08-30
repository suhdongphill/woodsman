/**
 * 주소(slug) 만들기 — 순수 모듈.
 *
 * ## 왜 자동인가
 * 글마다 사람이 영문 주소를 정하면 **매번 규칙을 다시 떠올려야 한다.** 규칙이 흔들리면
 * 주소 체계가 흔들리고, 그러면 검색에도 손해다. 그래서 **제목에서 만들어 준다.**
 *
 * ## 규칙
 * 1. 제목 안의 **영문·숫자·티커는 살린다**(NVDA → `nvda`).
 * 2. 한글은 **사전에서 최장 일치로 영문 키워드**로 바꾼다(금리 → `rate`).
 * 3. ⚠ **사전에 없는 한글은 버린다.** 조사·서술어까지 로마자로 옮기면
 *    `wae-oreuneun-geosilkka` 같은 주소가 나온다 — 사람도 검색엔진도 못 읽는다.
 *    키워드가 하나도 안 나올 때만 로마자로 떨어진다.
 * 4. **연도를 붙인다.** 제목에 연도가 있으면 그것을, 없으면 넘겨받은 연도를 쓴다.
 *    거시 글은 "언제의 이야기인가"가 곧 정보다.
 * 5. 최대 5토막·80자.
 *
 * ⚠ **`year`를 인자로 받는다.** 안에서 `new Date()`를 부르면 순수하지 않아 테스트가
 *    해가 바뀔 때 깨진다.
 */

/**
 * 한글 → 영문 키워드 사전.
 *
 * ⚠ 이 사전은 **주소 체계 그 자체다.** 같은 개념을 매번 다른 영어로 적으면 주소가 흩어진다.
 * 새 단어는 여기에만 더한다 — 화면이나 액션에서 즉석으로 바꾸지 않는다.
 */
const DICT: Record<string, string> = {
  // 금리·통화
  금리: "rate", 기준금리: "policy-rate", 인하: "cut", 인상: "hike", 동결: "hold",
  연준: "fed", 연방준비제도: "fed", 한국은행: "bok", 통화정책: "monetary-policy",
  장단기: "yield-curve", 역전: "inversion", 국채: "treasury", 채권: "bonds",
  유동성: "liquidity", 양적긴축: "qt", 양적완화: "qe", 순유동성: "net-liquidity",
  // 물가·경기
  물가: "inflation", 인플레이션: "inflation", 인플레: "inflation", 디플레이션: "deflation",
  침체: "recession", 경기침체: "recession", 경기: "economy", 성장률: "growth",
  고용: "jobs", 실업률: "unemployment", 실업: "unemployment", 소비: "consumer",
  소비심리: "consumer-sentiment", 주택: "housing", 제조업: "manufacturing",
  // 시장·자산
  주식: "stocks", 주가: "stocks", 증시: "market", 시장: "market", 나스닥: "nasdaq",
  코스피: "kospi", 반도체: "semiconductor", 비트코인: "bitcoin", 암호화폐: "crypto",
  금값: "gold", 유가: "oil", 원유: "oil", 달러: "dollar", 환율: "fx", 원화: "won",
  엔화: "yen", 위안: "yuan", 배당: "dividend", 리츠: "reit", 등락: "swing",
  // 투자·포트폴리오
  포트폴리오: "portfolio", 리밸런싱: "rebalancing", 자산배분: "asset-allocation",
  분산: "diversification", 성장주: "growth-stocks", 가치주: "value-stocks",
  현금흐름: "cashflow", 밸류에이션: "valuation", 실적: "earnings", 매출: "revenue",
  버블: "bubble", 거품: "bubble", 조정: "correction", 하락: "drawdown", 상승: "rally",
  손실: "loss", 수익률: "return", 원금: "principal", 계좌: "account", 투자일지: "journal",
  // 산업·주제
  인공지능: "ai", 데이터센터: "datacenter", 전력: "power", 전기차: "ev",
  이차전지: "battery", 방산: "defense", 바이오: "bio", 조선: "shipbuilding",
  // 나라
  미국: "us", 한국: "korea", 중국: "china", 일본: "japan", 유럽: "europe",
  // 글의 성격
  전망: "outlook", 분석: "analysis", 정리: "notes", 원칙: "principles",
  기록: "log", 공지: "notice", 전략: "strategy", 점검: "check", 캘린더: "calendar",
};

/** 최장 일치를 위해 긴 단어부터 본다 — "기준금리"가 "금리"보다 먼저 걸려야 한다. */
const DICT_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);

const MAX_TOKENS = 5;
const MAX_LENGTH = 80;

/** 한글 음절 → 로마자(개정 로마자 표기법 근사). 사전이 하나도 안 걸릴 때만 쓴다. */
const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","k","n","n","n","t","l","l","l","l","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

function romanizeSyllable(code: number): string {
  const i = code - 0xac00;
  return CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
}

function romanize(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= 0xac00 && code <= 0xd7a3 ? romanizeSyllable(code) : ch;
  }
  return out;
}

function clean(token: string): string {
  return token.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** 제목에 적힌 연도(1900~2099) — 있으면 그것이 이 글의 연도다. */
function yearInTitle(title: string): string | null {
  const m = title.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

/**
 * 제목에서 주소를 만든다.
 *
 * @param year 제목에 연도가 없을 때 붙일 연도(호출부가 넘긴다 — 이 함수는 시계를 안 본다)
 */
export function slugify(title: string, year: number): string {
  const titleYear = yearInTitle(title);
  // 연도는 따로 붙이므로 본문 토막에서는 뺀다(중복 방지).
  const source = title.replace(/\b(19|20)\d{2}\b/g, " ");

  const tokens: string[] = [];
  const push = (t: string) => {
    const c = clean(t);
    if (c && !tokens.includes(c)) tokens.push(c);
  };

  // 한글 구간은 사전으로, 그 밖은 그대로 — 원문 순서를 지킨다.
  let rest = source.toLowerCase();

  while (rest.length > 0) {
    const key = DICT_KEYS.find((k) => rest.startsWith(k));
    if (key) {
      push(DICT[key]);

      rest = rest.slice(key.length);
      continue;
    }
    const m = rest.match(/^[a-z0-9]+/);
    if (m) {
      push(m[0]);
      rest = rest.slice(m[0].length);
      continue;
    }
    rest = rest.slice(1);
  }

  // 사전에도 영문에도 걸린 게 없으면 그제야 로마자로 떨어진다.
  if (tokens.length === 0) {
    for (const word of romanize(source).split(/[^a-z0-9]+/i)) push(word.toLowerCase());
  }

  const yearPart = titleYear ?? String(year);
  // 연도가 한 자리를 차지하므로 본문 토막은 그만큼 줄인다.
  const head = tokens.slice(0, MAX_TOKENS - 1);
  const slug = clean([...head, yearPart].join("-")).slice(0, MAX_LENGTH).replace(/-$/, "");

  // ⚠ 빈 주소를 돌려주지 않는다 — 저장이 막히고 이유도 안 보인다.
  return slug === yearPart || slug === "" ? `insight-${yearPart}` : slug;
}

/**
 * 이미 쓰이는 주소를 피해 다음 자리를 찾는다.
 *
 * ⚠ 충돌을 **오류로 막지 않는다.** 예전에는 "다른 글이 쓰고 있습니다"로 저장을 거절했는데,
 *    그러면 쓰던 사람이 주소를 손으로 고쳐야 했다. 대신 비켜서 저장하고 **비켰다고 말한다**.
 */
export function nextAvailableSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`.slice(0, MAX_LENGTH);
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${used.size + 1}`.slice(0, MAX_LENGTH);
}
