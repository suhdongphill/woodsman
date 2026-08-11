/**
 * AI·반도체 버블 모니터 카탈로그 — 순수 값.
 *
 * 옵시디언 볼트 `05_Methodology/AI·반도체 버블 신호 모니터 설계서.md`의 5레이어 점수 모델과
 * 하드 트리거를 옮긴 것이다(볼트 화면은 `00_Dashboard/메모리 버블 트리거.html`).
 *
 * ## 왜 정의가 코드인가
 * 거시 지표와 같은 이유다 — 바뀌는 것은 **값**이지 레이어 구성·가중치·임계값이 아니다.
 * 그것들은 판단이 담긴 문장이라 버전 관리가 되는 편이 맞다. 값과 트리거 상태만 DB에 쌓는다.
 *
 * ⚠ 점수는 **0·1·2** 세 칸뿐이다. 더 촘촘하게 만들고 싶어지지만, 지표 절반이 정성 판단이라
 *    소수점을 붙이면 없는 정밀도가 생긴다(설계서의 결정).
 */
import type { BubbleLayer, BubbleTriggerDef, ScoreBand } from "./types";

export const BUBBLE_LAYERS: BubbleLayer[] = [
  {
    id: "L1",
    name: "CAPEX 펀더멘털",
    weight: 1.5,
    note: "버블의 진원지",
    indicators: [
      {
        key: "capex_yoy",
        label: "ΣCAPEX(TTM) YoY",
        rule: "<20% · 20~40% · >40%",
        scale: { op: "gt", t1: 20, t2: 40 },
        source: "SEC EDGAR (MSFT·GOOGL·AMZN·META·ORCL)",
      },
      {
        key: "capex_to_ocf",
        label: "ΣCAPEX / 영업현금흐름",
        rule: "<50% · 50~70% · >70%",
        scale: { op: "gt", t1: 50, t2: 70 },
        source: "SEC EDGAR (5사 TTM)",
      },
      {
        key: "roi_gap",
        label: "CAPEX YoY − 매출 YoY",
        rule: "<0%p · 0~15%p · >15%p",
        scale: { op: "gt", t1: 0, t2: 15 },
        source: "SEC EDGAR · 세그먼트 미공개로 총매출 대용",
      },
      {
        key: "debt_funded",
        label: "총부채 증가분 / CAPEX",
        rule: "<10% · 10~30% · >30%",
        scale: { op: "gt", t1: 10, t2: 30 },
        source: "SEC EDGAR (5사 TTM) · ORCL은 LongTermNotesAndLoans 계열 태그",
      },
      {
        key: "circular_flag",
        label: "순환·벤더파이낸싱 정황",
        rule: "없음 · 1건 · 2건+",
        source: "웹 조사 + 사용자 판단(2026-07-22 점검)",
      },
      {
        key: "capex_accel",
        label: "ΣCAPEX 증가율의 가속도(2차 미분)",
        rule: "가속 지속 · 둔화 · 마이너스 전환",
        source: "Groundbreaker 「The Second Derivative」 (컨센 기반)",
      },
      {
        key: "rpo_concentration",
        label: "빅4 백로그 중 프리-프로핏 랩 비중",
        rule: "<20% · 20~40% · >40%",
        source: "Groundbreaker 「The Second Derivative」",
      },
      {
        key: "llm_token_spend",
        label: "LLM 토큰 지출 지수 (AI 수익화의 실물 증거)",
        rule: "증가 지속 · 횡보 · 감소 전환",
        source:
          "실리콘데이터 LLM Token Expenditure Index (경제학교 경읽남 257화 인용) · ⚠ 원지수 실수치·계열 정의 미확인",
      }
    ],
  },
  {
    id: "L2",
    name: "밸류에이션·집중도",
    weight: 1.5,
    note: "과열의 가격",
    indicators: [
      {
        key: "kr_fwd_pe",
        label: "KR 메모리 12M 선행 PER",
        rule: "<8배 · 8~10배 · >10배",
        source: "매크로 대시보드(Naver/IR)",
      },
      {
        key: "semi_ps",
        label: "미 반도체 8사 합산 P/S",
        rule: "<8배 · 8~14배 · >14배",
        scale: { op: "gt", t1: 8, t2: 14 },
        source: "EDGAR+Yahoo · SOX 선행PER 대용(임계값은 과거 레인지 기반 자체 보정)",
      },
      {
        key: "nvda_ev_sales",
        label: "엔비디아 EV/Sales",
        rule: "<15 · 15~25 · >25",
        scale: { op: "gt", t1: 15, t2: 25 },
        source: "EDGAR(주식수·매출·순현금) + Yahoo 종가",
      },
      {
        key: "concentration",
        label: "Mag7 시총 / S&P500",
        rule: "<30% · 30~35% · >35%",
        source: "Forbes 2026-06(34%)·타출처 32.24% — 둘 다 30~35% 구간",
      },
      {
        key: "peg",
        label: "핵심 반도체 가중 PEG",
        rule: "<1.5 · 1.5~2.5 · >2.5",
        scale: { op: "gt", t1: 1.5, t2: 2.5 },
        source: "Yahoo quoteSummary(crumb) — forwardPE ÷ 차년 EPS 성장률, 시총가중",
      }
    ],
  },
  {
    id: "L3",
    name: "실물 수급",
    weight: 1.2,
    note: "수요 검증 — 주가는 가는데 실물이 식는 괴리 탐지",
    indicators: [
      {
        key: "hbm_asp_trend",
        label: "메모리 계약가 3M 추세",
        rule: "상승 · 횡보 · 하락전환",
        source: "메리츠 김선우",
      },
      {
        key: "dram_momentum",
        label: "D램 가격 상승률 모멘텀",
        rule: "가속 · 둔화 · 마이너스 전환",
        source: "별주부전(소현철·박세익)",
      },
      {
        key: "capex_guidance",
        label: "하이퍼스케일러 가이던스",
        rule: "상향 · 유지 · 하향",
        source: "실적시즌 수동",
      },
      {
        key: "equip_billings_yoy",
        label: "SEMI 장비 billings YoY",
        rule: ">10% · 0~10% · 마이너스 전환",
        scale: { op: "lt", t1: 10, t2: 0 },
        source: "SEMI WWSEMS (2026-06 발표) — 북투빌 폐지에 따른 대체",
      },
      {
        key: "memory_inventory",
        label: "메모리 재고일수 추세",
        rule: "감소 · 횡보 · 급증 (직전 4분기 평균 대비)",
        scale: { op: "gt", t1: -5, t2: 15 },
        source: "EDGAR InventoryNet/COGS · 삼성·하이닉스는 DART 미연결로 MU 단독",
      },
      {
        key: "tsmc_rev_yoy",
        label: "TSMC 월매출 YoY",
        rule: ">30% · 10~30% · <10%",
        scale: { op: "lt", t1: 30, t2: 10 },
        source: "TSMC IR 월매출 공시(2026-07-13 발표)",
      }
    ],
  },
  {
    id: "L4",
    name: "신용·유동성",
    weight: 1.0,
    note: "매크로 지표 대시보드 재사용 + 부채의 '양'이 아니라 '만기 구조'",
    indicators: [
      {
        key: "hy_oas",
        label: "HY OAS",
        rule: "<300bp · 300~400bp · >400bp",
        scale: { op: "gt", t1: 3.0, t2: 4.0 },
        source: "FRED BAMLH0A0HYM2",
      },
      {
        key: "vix",
        label: "VIX",
        rule: "<18 · 18~25 · >25",
        scale: { op: "gt", t1: 18, t2: 25 },
        source: "FRED VIXCLS",
      },
      {
        key: "move",
        label: "MOVE",
        rule: "<100 · 100~140 · >140",
        scale: { op: "gt", t1: 100, t2: 140 },
        source: "Yahoo ^MOVE",
      },
      {
        key: "tga_4w",
        label: "TGA 4주 변화",
        rule: "감소·안정 · 완만증가 · +$200B↑",
        scale: { op: "gt", t1: 0, t2: 200 },
        source: "FRED WDTGAL",
      },
      {
        key: "hyper_ig_leverage",
        label: "하이퍼스케일러 IG 레버리지",
        rule: "<1.0배 · 1.0~1.5배 · >1.5배 (총부채/EBITDA)",
        source: "Morgan Stanley (Groundbreaker 인용) · 임계값은 자체 보정",
      },
      {
        key: "asset_life_mismatch",
        label: "AI 자산 경제수명 vs 부채 만기 미스매치",
        rule: "정합(1~2배) · 3~5배 괴리 · 5배+ 괴리",
        source: "경제학교 특강 반론 리서치(반대 시각 조사) · 임계값은 자체 보정",
      }
    ],
  },
  {
    id: "L5",
    name: "센티먼트·구조신호",
    weight: 0.8,
    note: "정성 신호가 정점을 가장 잘 잡는다",
    indicators: [
      {
        key: "retail_froth",
        label: "리테일 심리(WSB)",
        rule: "정상 · 상승 · 급증·과열",
        source: "ApeWisdom(WSB)",
      },
      {
        key: "analyst_dispersion",
        label: "애널리스트 타깃 분산도",
        rule: "좁음 · 보통 · 확대",
        source: "JP모건(MarketWatch)",
      },
      {
        key: "narrative_flag",
        label: "'이번엔 다르다' 서사",
        rule: "수동 토글",
        source: "수동 판단(2026-07-22 점검에서 1→2 정정: value '강함'과 points 불일치 해소)",
      },
      {
        key: "insider_sell",
        label: "임원 매도 모멘텀(Form4)",
        rule: "<1.3배 · 1.3~2.5배 · >2.5배 (자기 1년 평균 대비)",
        scale: { op: "gt", t1: 1.3, t2: 2.5 },
        source: "EDGAR Form4 5사 장내 S/P · 임계값은 자체 보정",
      },
      {
        key: "ipo_froth",
        label: "AI·반도체 IPO/SPAC",
        rule: "낮음 · 보통 · 과열",
        source: "웹 조사 + 사용자 판단(2026-07-22 점검)",
      }
    ],
  },
];

/**
 * 총점 구간. 위에서부터 처음 `max`를 넘지 않는 구간이 지금 국면이다.
 * ⚠ `stance`는 **국면 설명**이지 매매 지시가 아니다 — 화면 문구도 그 선을 지킨다.
 */
export const SCORE_BANDS: ScoreBand[] = [
  { max: 20, regime: "확장 (Risk-On)", stance: "비중 확대 가능" },
  { max: 40, regime: "주의", stance: "신규는 선별" },
  { max: 60, regime: "경계", stance: "후기테마부터 축소" },
  { max: 80, regime: "위험", stance: "방어·현금 확대" },
  { max: 100, regime: "붕괴 초기", stance: "리스크오프" },
];

/**
 * 우선 경보 — 이 셋이 동시에 2점이면 "고전적 정점 패턴"이다.
 * 총점이 낮아도 따로 알린다(평균에 묻히기 때문).
 */
export const PRIORITY_ALERT = {
  keys: ["capex_to_ocf", "roi_gap", "equip_billings_yoy"] as const,
  text: "CAPEX 가속 + 수익전환 지연 + 실물수요 둔화 = 고전적 정점 패턴",
};

/** 하드 트리거 — 점수와 별개로 "이게 일어나면 판이 바뀐다"는 사건들. */
export const BUBBLE_TRIGGERS: BubbleTriggerDef[] = [
  {
    key: "trg1",
    text: "빅테크 4사 중 2곳 이상 CAPEX 가이던스 하향",
  },
  {
    key: "trg2",
    text: "DRAM 고정거래가격 3개월 연속 하락",
  },
  {
    key: "trg3",
    text: "HBM 신규 LTA 계약 6개월 이상 부재",
  },
  {
    key: "trg4",
    text: "SK하이닉스 12개월 선행 PER 8배 이상 진입",
  },
  {
    key: "trg5",
    text: "미국 10년물 5% 돌파 + ISM 제조업 PMI 45 이하 (감시계열: ISM 신규주문)",
  },
  {
    key: "trg6",
    text: "하이퍼스케일러가 CAPEX 삭감을 발표했는데 주가가 오른다 (리플렉시브 플립)",
  },
  {
    key: "trg7",
    text: "OpenAI 차기 마크(IPO 포함)가 요구 스텝업에 미달",
  },
  {
    key: "trg8",
    text: "엔캐리 청산 재발화 — 달러-엔 단기 급변(주 5%+) 또는 BOJ 예상 밖 인상",
  },
];

export function findBubbleIndicator(key: string) {
  for (const layer of BUBBLE_LAYERS) {
    const indicator = layer.indicators.find((i) => i.key === key);
    if (indicator) return { layer, indicator };
  }
  return undefined;
}

export const ALL_BUBBLE_INDICATORS = BUBBLE_LAYERS.flatMap((l) => l.indicators);
