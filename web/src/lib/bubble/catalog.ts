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
 * ⚠ 점수는 **0·1·2** 세 칸뿐이다. 더 촘촘하게 만들고 싶어지지만, 등급·공시 건수처럼 원래 단계로 나오는
 *    지표가 있고 경계값 상당수가 자체 보정이라 소수점을 붙이면 없는 정밀도가 생긴다(설계서의 결정).
 *    (2026-10-26 전에는 「지표 절반이 정성 판단」이 이유였다 — 정성 토글을 뺀 뒤 이유를 고쳐 적었다.)
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
        /**
         * ⚠ 2026-10-26: 「웹 조사 + 사용자 판단」 → **SEC 공시로 확인된 계약만 센다.** 보도만 있는 협상은 세지 않는다
         *   (NVDA 10-K의 OpenAI 투자는 "There is no assurance" — 확정 공시가 아니라 0건).
         */
        key: "circular_flag",
        label: "순환·벤더파이낸싱 계약 (공시 확인분)",
        rule: "없음 · 1건 · 2건+ (8-K·10-Q·10-K에 적힌 것만)",
        source:
          "SEC 공시 — 예: AMD 8-K(OpenAI 신주인수권 최대 1.6억 주 × $0.01) · NVDA 10-Q(보증 한도 $105B) · AMZN 10-Q(OpenAI 우선주·Anthropic 투자) · MSFT 10-K(OpenAI 특수관계자)",
      },
      {
        /**
         * ⚠ 2026-10-26: 출처를 뉴스레터에서 **회사 공시**로 바꿨다. 비중을 숫자로 공시한 것은 MSFT뿐이다
         *   — 「상업 RPO의 약 45%가 OpenAI」(FY26 2분기 실적 발표). AMZN은 계약 규모만, ORCL·GOOGL은 공시에 이름이 없다.
         *   공시가 없는 회사를 추정으로 채우지 않는다.
         */
        key: "rpo_concentration",
        label: "빅테크 백로그 중 적자 AI 랩 비중 (공시 기준)",
        rule: "<20% · 20~40% · >40%",
        source:
          "MSFT 실적 발표(상업 RPO의 약 45%가 OpenAI) · AMZN 10-Q(OpenAI·Anthropic 계약 규모) · ⚠ ORCL·GOOGL은 비중 미공시",
      },
      // ⚠ 2026-10-26 뺐다(근거 부족) — 판정 행은 DB에 남지만 점수에서 빠진다(점수는 카탈로그 키만 읽는다).
      //   capex_accel: CAPEX 증가율 **감속**이 하락에 앞선다는 연구를 못 찾았다. 근거는 반대쪽(투자 급증 기업의 이후 수익률 저조 —
      //     Titman·Wei·Xie 2004, JFQA)뿐이고 그건 capex_yoy가 이미 잰다. 회계연도가 회사마다 달라 2차 미분은 잡음이 크다.
      //   llm_token_spend: 유튜브 인용이었고 원지수(Silicon Data)는 유료 · 공개 시계열이 없다 · 지출 총액이 아니라 토큰당 가중 가격이다.
    ],
  },
  {
    id: "L2",
    name: "밸류에이션·집중도",
    weight: 1.5,
    note: "과열의 가격",
    indicators: [
      {
        // ⚠ 2026-10-26: 이름이 「12M 선행 PER」였는데 원천은 올해 컨센 추정EPS 기준 PER이다(볼트 원천 주석 「12M 선행 아님」).
        //   라벨을 정의에 맞췄다. 눈금은 rule 그대로 붙였다(볼트 동기화가 대조한다).
        key: "kr_fwd_pe",
        label: "KR 메모리 컨센 추정 PER (SK하이닉스·삼성전자 평균)",
        rule: "<8배 · 8~10배 · >10배",
        scale: { op: "gt", t1: 8, t2: 10 },
        source: "Naver 증권 추정PER(FnGuide 컨센 추정EPS 기준 · 12M 선행 아님) — 볼트 fetch-bubble-auto.py",
      },
      {
        /**
         * ⚠ 2026-09-14 운영자 결정: 바구니를 **고정**했다 — NVDA·AVGO·AMD·MU·INTC·QCOM·TXN·AMAT.
         *   그 전까지 「8사」의 종목 목록이 어디에도 적혀 있지 않아, 채점마다 같은 바구니였는지 확인할 수 없었다.
         *   ⚠ 이 목록을 바꾸면 과거 값과 비교가 끊긴다 — 바꾸면 채점 근거에 적는다.
         */
        key: "semi_ps",
        label: "미 반도체 8사 합산 P/S",
        rule: "<8배 · 8~14배 · >14배",
        scale: { op: "gt", t1: 8, t2: 14 },
        source: "EDGAR+Yahoo · 8사 고정(NVDA·AVGO·AMD·MU·INTC·QCOM·TXN·AMAT) · SOX 선행PER 대용(임계값은 과거 레인지 기반 자체 보정)",
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
        scale: { op: "gt", t1: 30, t2: 35 },
        // ⚠ 2026-10-26: 기사(Forbes) → 원자료. 문턱은 연구 근거를 못 찾아 자체 보정이다.
        source: "SSGA SPY 일간 보유내역(xlsx) — Mag7(GOOGL+GOOG 합산) 지수 비중 · 임계값은 자체 보정",
      },
      {
        /**
         * ⭐ 2026-10-26 추가(운영자: 버블 연구논문 등 객관적 근거로) — Greenwood·Shleifer·You (2019, JFE 131(1)).
         *   1928~2014 미국 업종: 2년 **시장 초과** 수익률이 50% · 100% · 150%를 넘으면 이후 2년 안에 고점 대비 40% 하락할
         *   확률이 20% · 53% · 80%(논문 Table 3, NBER WP 23191판으로 확인). 논문은 원수익률 조건도 함께 건다.
         * ⚠ 같은 논문이 런업 뒤 **평균 수익률은 평범**했다고 쓴다(Fama의 반론이 맞은 부분 · 오탐 47%).
         *   그래서 이 점수는 「곧 떨어진다」가 아니라 **「꼬리위험이 커졌다」**로 읽는다. 업종 단위 결과라 단일 종목에 쓰지 않는다.
         */
        key: "sox_runup",
        label: "반도체 업종 2년 런업 (SOX, 시장 초과)",
        rule: "<50% · 50~100% · ≥100% (2년 원수익률·S&P500 대비 초과수익률 중 작은 값)",
        scale: { op: "gt", t1: 50, t2: 100 },
        source:
          "Greenwood·Shleifer·You (2019) 「Bubbles for Fama」 JFE — 초과 런업 50/100/150%에서 2년 내 40% 하락 확률 20/53/80% · 값: Yahoo ^SOX·^GSPC 월말 종가",
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
        /**
         * ⚠ 2026-10-26: 출처를 개인 애널리스트에서 **TrendForce 분기 계약가 보도자료(무료 전문)**로 바꾸고,
         *   같은 것을 두 번 세던 `dram_momentum`(유튜브 출처)을 여기로 합쳤다. ⚠ 뜻이 바뀌어 **새 키**다 — 옛 키(`hbm_asp_trend`)의
         *   판정은 옛 정의로 매긴 것이라 이 지표의 점수로 세지 않는다(라벨과 값이 어긋나는 것이 가장 비싼 실패다).
         *   HBM 계약가는 공개 시계열이 없다(주간 Bulletin 유료) — 일반 D램 계약가로 잰다.
         */
        key: "dram_contract_outlook",
        label: "D램 계약가 다음 분기 전망 (QoQ)",
        rule: "상승 전망 · 보합(±3%) · 하락 전망",
        source: "TrendForce 분기 계약가 보도자료(예: 2026-09-30 「4Q26 일반 D램 계약가 +10~15% QoQ」) · 문턱 ±3%는 자체 보정",
      },
      // ⚠ 2026-10-26 뺐다: hbm_asp_trend(개인 애널리스트 출처 · 위 새 키로 대체) · dram_momentum(위와 같은 것을 두 번 셌고 출처가 유튜브).
      {
        key: "capex_guidance",
        label: "하이퍼스케일러 가이던스",
        rule: "상향 · 유지 · 하향",
        source: "실적 발표·8-K(EX-99.1)의 CAPEX 전망 문장",
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
    // ⚠ 2026-10-26: 예전 문구 「부채의 '양'이 아니라 '만기 구조'」 — 만기 미스매치 지표를 뺀 뒤로 맞지 않았다.
    note: "시장 전체의 신용·변동성 + AI 인프라를 빚으로 짓는 주체(하이퍼스케일러·네오클라우드·오라클)의 신용",
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
        /**
         * ⚠ 2026-09-14 운영자 결정: 원천을 **Yahoo `^MOVE` → 국채 실현변동성**으로 바꿨다. Yahoo `^MOVE`는 ICE MOVE가 아니다
         *   (설계서 자본레짐 §0 · 9/13 확인). 거시 카탈로그 `ust10y_rvol`(10년물 일간 변화 20일 실현변동성, bp)을 쓴다.
         * ⚠ 키(`move`)는 유지한다 — 운영 DB의 판정 행이 이 키로 쌓여 있다. 이름과 원천 문장만 바꾼다.
         * ⚠ 문턱 100/140은 MOVE의 것을 **자체 보정 없이** 옮겼다 — 운영 대조(2020-03 222 · 2022-10 159 · 2023-03 144 · 2021-06 48)상
         *   국면은 겹치지만, 실현값은 충격 초기에 MOVE보다 늦다. 교정 전까지 「자체 보정」 표시.
         */
        key: "move",
        label: "국채 변동성 (실현, MOVE 대용)",
        rule: "<100bp · 100~140bp · >140bp",
        scale: { op: "gt", t1: 100, t2: 140 },
        source: "거시 카탈로그 ust10y_rvol — FRED DGS10 일간 변화 20일 실현변동성(bp) · ⚠ MOVE 아님 · 임계값은 MOVE 문턱 이식(자체 보정 전)",
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
        rule: "<1.0배 · 1.0~1.5배 · >1.5배 (5사 Σ총차입 / ΣEBITDA)",
        scale: { op: "gt", t1: 1.0, t2: 1.5 },
        // ⚠ 2026-10-26: 뉴스레터가 인용한 증권사 수치 → EDGAR에서 직접 계산(볼트 fetch-bubble-auto.py와 같은 정의).
        //   운용리스는 차입에 넣지 않는다 — 평가사 「조정 레버리지」와 다르다.
        source:
          "SEC EDGAR 5사 TTM — Σ총차입(금융리스 포함) ÷ Σ(영업이익+감가상각) · 임계값은 자체 보정(공개된 평가사 문턱은 ORCL뿐 — S&P 「4.5배 초과 지속 시 하향」)",
      },
      {
        /**
         * ⭐ 2026-10-26 추가(운영자 요청) — 네오클라우드의 차입 스트레스. 기준 주체는 CoreWeave(공개 무담보채가 있는 유일한 곳).
         *   Nebius는 전환사채뿐이라 신용 스프레드 대용이 안 된다 · Lambda·Crusoe는 공개 부채 지표가 없다.
         * ⚠ 자동 채점이 안 된다 — 144A 채권이고 CDS는 단말기 전용이다. 채점 때 수익률·스프레드의 출처와 날짜를 값에 적는다.
         * 근거: 1000bp = S&P의 부실(distressed) 정의(국채 대비 1000bp 이상). 500bp 경계는 자체 보정.
         *   연준 FSR(2026-05-08)이 AI 위험으로 "부채로 조달하는 설비투자"를 짚었다. 반대 근거: GPU·투자등급 고객 계약을 담보로 한
         *   DDTL은 회사 등급보다 높게 평가된다(2026-03 무디스 A3) — 무담보채 스트레스가 담보부 사모신용으로 그대로 옮겨가지는 않는다.
         */
        key: "neocloud_credit",
        label: "네오클라우드 신용 스트레스 (CoreWeave 무담보채)",
        rule:
          "스프레드 <500bp · 500~1000bp · ≥1000bp — 평가사 부정적 전망·강등 또는 신규 DDTL 가산금리가 직전보다 100bp+ 넓어지면 한 칸 올린다(최대 2)",
        source:
          "CoreWeave 8-K·10-Q(DDTL 가산금리: 3월 SOFR+2.25% → 5월 +4.50% → 8월 +5.50% · 고객 2곳이 매출 62% · 2분기 이자비용 $6.4억 > 영업손실) · S&P 부실 정의 1000bp · 연준 FSR 2026-05",
      },
      {
        /**
         * ⭐ 2026-10-26 추가(운영자: 「오라클도 주요 모니터링 대상이 아닌지」) — 오라클은 L1의 5사 합산에 묻혀 있었다.
         *   차입으로 짓는 AI 데이터센터 · RPO $664B · FCF 5분기 연속 음수 · 미개시 리스 약정 $288B(10-Q).
         * ⚠ CDS·개별 채권 스프레드는 무료로 매일 받을 곳이 없어 채점에 쓰지 않는다(보도에만 간헐적으로 나온다 — 값 칸의 참고로만).
         * 근거: BBB-/Baa3는 투자등급의 마지막 칸이다(평가사 등급 정의). 「4분기 FCF 음수 = 1점」은 자체 보정.
         * 반대 근거: OCF 사상 최대 · 고객 선급금 · 주식 $200억 발행으로 자본 보강 · 매출 10% 이상 단일 고객 없음.
         */
        key: "oracle_credit",
        label: "오라클 신용 (등급 사다리 + FCF 부호)",
        rule:
          "3사 BBB 이상·전망 안정+·4분기 FCF 양 · BBB-/Baa3 또는 부정적 전망 또는 4분기 FCF 음 · 투기등급 강등 또는 BBB-/Baa3에서 부정적 전망·감시",
        source:
          "Oracle 8-K(EX-99.1 FCF 표)·10-Q(차입금·리스 약정) · 등급은 증권신고서(FWP·424B2) 예상 등급란과 평가사 발표 · 2026-10: S&P BBB-(7/9, 2차 출처) · Moody's Baa2 부정적 · Fitch BBB",
      },
      {
        /**
         * ⚠ 2026-10-26: 「경제수명 vs 부채 만기」(유튜브 강의 출처 · 수치 없음) → **10-K의 서버 감가 내용연수 공시**로 바꿨다.
         *   뜻이 바뀌어 **새 키**다(옛 `asset_life_mismatch` 판정은 세지 않는다).
         *   예: AMZN 2025 10-K 「일부 서버·네트워크 장비 6년 → 5년」(감가 +$14억) · 반대 방향: META 5.5년으로 연장.
         */
        key: "server_useful_life",
        label: "서버 감가 내용연수 공시 변화 (5사 + CoreWeave)",
        rule: "연장·유지 · 혼재 · 단축 공시가 2곳+",
        source: "각사 10-K 감가상각 정책 주석(MSFT·GOOGL·AMZN·META·ORCL·CRWV) · 문턱은 자체 보정",
      },
    ],
  },
  {
    id: "L5",
    name: "센티먼트·구조신호",
    weight: 0.8,
    // ⚠ 2026-10-26: 예전 문구 「정성 신호가 정점을 가장 잘 잡는다」는 근거가 없었다. 정성 토글을 빼고 원자료가 있는 것만 남겼다.
    note: "투자자 쏠림 — 관심·내부자 매도·IPO 첫날 수익률(원자료가 있는 것만)",
    indicators: [
      {
        /**
         * ⚠ 2026-10-26 근거를 붙였다 — 관심이 쏠린 종목의 이후 수익률이 낮다(Barber·Huang·Odean·Schwarz 2022, JF:
         *   Robinhood 매수 상위의 20일 비정상수익 −4.7%). ⚠ 다만 **WSB 언급 수 자체**가 반전을 예측한다는 동료심사 논문은 못 찾았다
         *   (WSB 추천의 예측력은 GME 뒤 사라졌다 — RFS 2024). 그래서 문턱은 자체 보정이고, 이 층의 가중치(0.8)는 낮게 둔다.
         */
        key: "retail_froth",
        label: "리테일 심리(WSB)",
        rule: "<1.2배 · 1.2~1.5배 · >1.5배 (반도체 언급 비중 / 직전 스냅샷 평균)",
        scale: { op: "gt", t1: 1.2, t2: 1.5 },
        source: "ApeWisdom(WSB 언급) · 근거: Barber 외(2022, JF) 관심 쏠림 → 이후 저조 · 임계값은 자체 보정",
      },
      // ⚠ 2026-10-26 뺐다(근거 부족·실효성 없음):
      //   analyst_dispersion: 학술 근거(Diether·Malloy·Scherbina 2002, JF)는 **EPS 예측 분산**이고 효과가 **소형주**에 집중됐다
      //     — 목표가 분산·초대형주에 쓰면 근거 밖이다. 출처도 기사(MarketWatch)였다.
      //   narrative_flag: 「이번엔 다르다」 서사를 객관적으로 재는 방법이 없는 수동 토글이었다. 런업의 객관적 대용은 L2 `sox_runup`.
      {
        key: "insider_sell",
        label: "임원 매도 모멘텀(Form4)",
        rule: "<1.3배 · 1.3~2.5배 · >2.5배 (자기 1년 평균 대비)",
        scale: { op: "gt", t1: 1.3, t2: 2.5 },
        source: "EDGAR Form4 5사 장내 S/P · 임계값은 자체 보정",
      },
      {
        /**
         * ⚠ 2026-10-26: 「웹 조사 + 사용자 판단」 → **Jay Ritter IPO 통계**(플로리다대, 연 갱신)의 첫날 평균 수익률.
         *   문턱은 원자료의 역사 구간이다 — 1980~2025 평균 19.0% · 1999년 71.2% · 2000년 56.3%(2024 15.3% · 2025 29.3%).
         * ⚠ 연 단위라 늦고 AI만 따로 가르지 않는다. 적자 IPO 비율은 2020~21년에도 2000년 수준이라 단독 신호로 쓰지 않는다.
         * ⚠ 뜻이 바뀌어 **새 키**다(옛 `ipo_froth` 「AI·반도체 IPO/SPAC」 판정은 세지 않는다).
         */
        key: "ipo_first_day",
        label: "미국 IPO 첫날 평균 수익률",
        rule: "<20%(장기 평균) · 20~40% · >40%(1999·2000년 쪽)",
        scale: { op: "gt", t1: 20, t2: 40 },
        source: "Jay Ritter 「IPO Statistics」(site.warrington.ufl.edu/ritter) · 1980~2025 평균 19.0% · 1999 71.2% · 2000 56.3%",
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

/** 트리거 키 → 정의. ⚠ 문장의 원본은 여기다 — 저장소는 **키만** 담는다. */
export function findBubbleTrigger(key: string): BubbleTriggerDef | undefined {
  return BUBBLE_TRIGGERS.find((t) => t.key === key);
}
