---
날짜: 2026-09-16
작성: Claude (Cowork) — 운영자(Woodsman) 요청으로 ChatGPT 설계 프롬프트를 저장소 기준으로 다듬음
요청: 「Global Capital Regime Monitor Portal — 개발 설계 프롬프트」(ChatGPT)를 Claude Code 개발요구서로.
      ① 이미 있는 변수와 중복 금지 ② ChatGPT를 팩트체크하고 논리 오류는 기존 연구 방법과 비교해 우위면 채택 · 아니면 유지 · 둘 다 부족하면 개선
      ③ Global Capital Regime을 앞단으로 — **금리 정보 하단**에 한 줄 요약 + 주요 점수 프레임 (⚠ v0.2의 「유동성 카드 하단」은 오독 · 2026-09-16 운영자 정정)
상태: **v0.2 — 델타 개발요구서.** 원문 전체를 다시 짓지 않는다. 「팩트체크 · 비교 판정 · 이미 있음 · 충돌 · 새로 필요」만 적는다
관련: `docs/설계_자본레짐엔진.md`(v0.7) · `docs/설계_점수계산명세_v1.md`(명세 v1.0) · `docs/계획_시장관찰포털_2026-09-14.md` ·
`docs/woodsman_개발요구서_v2.md` 운영자 원칙 ①~⑦ · `docs/운영지침.md` §0 · `web/CLAUDE.md`
---

# Global Capital Regime — 개발요구서 (Capital 흐름 첫 조각)

## 0. Claude Code에 붙여넣을 지시문

```text
docs/개발요구서_GlobalCapitalRegime_2026-09-16.md 를 읽고 작업한다.

먼저 읽을 것(순서대로): web/CLAUDE.md → docs/운영지침.md §0 → docs/설계_자본레짐엔진.md 10~12장
→ docs/설계_점수계산명세_v1.md → docs/계획_시장관찰포털_2026-09-14.md 「다음 세션 인수인계」 → 이 요구서.

규칙
1. 3장 「비교 판정」이 이 작업의 기준이다. 「채택」은 반영하고, 「유지」는 ChatGPT 쪽으로 고치지 않으며, 「개선」은 적힌 개선안으로 짓는다.
2. 4장 「이미 있음」에 있는 키·점수·테이블은 새로 만들지 않는다. 같은 뜻의 새 이름을 만들면 실패다.
3. 6장 조각은 G0부터 순서대로, 한 조각 = 한 배포. G1(홈 앞단 프레임)이 첫 코드 조각이다.
   각 조각 끝에 설계서 개정표 · CHANGELOG · 테스트를 같이 고친다.
4. 원자료가 없으면 missing. 점수·데이터를 추정으로 채우지 않는다. ChatGPT 보고서의 점수를 시드·기본값·테스트 기대값으로 쓰지 않는다.
5. 가중치·문턱은 lib/scores/config.ts에만 두고, 바꾸면 MODEL_VERSION을 올린다.
6. 새 외부 출처는 운영 수집 결과로 확인한 뒤에만 「해결」이라 적는다(S2-b 교훈).
7. 시작 전에 G0의 결정표를 나(운영자)에게 보여 주고 답을 받는다.
```

---

## 1. 배경과 목표

- 운영자는 ChatGPT에서 매일 **Global Capital Regime Monitor** 보고서(HTML)를 받는다. 목표는 그 보고서의 항목을
  **포털이 직접 계산**하게 하는 것이다(설계서 10장과 같은 목표).
- 이번 ChatGPT 프롬프트는 9/13에 받은 PART I~XXXI·명세 v1.0을 **요약·재구성한 판**이다. 대부분 겹친다.
- ⭐ 이번 작업은 **「Capital 흐름」 첫 조각**이다. 운영자가 처음으로 자본의 흐름을 화면에 세운다 —
  ① 홈 앞단에 **Global Capital Regime 프레임**(G1) ② `/capital-regime`의 **Capital Flow Map v0**(G8)이 중심 산출물이다.

---

## 2. 팩트체크 — ChatGPT 9/16 보고서와 설계 프롬프트

판정: ✅ 1차 자료와 일치 · 🟡 대체로 맞으나 고칠 점 · ❌ 틀렸거나 자기 산식과 모순 · ❓ 확인 불가

### 2-1. 사실 (보고서 본문)

| # | 보고서 주장 | 확인 결과 | 판정 |
|---|---|---|---|
| F1 | 9/15 국채 10Y 5.00 · 20Y 5.40 · 30Y 5.36% | 재무부 Par Yield 일치 (9/14: 4.97 · 5.37 · 5.34) | ✅ |
| F2 | 10Y 실질금리 2.62% | 재무부 Real Yield 9/15 2.62 (9/14 2.60) | ✅ |
| F3 | 「10년물이 5%를 **넘었다**」 | 9/15 **정확히 5.00%** — 「5%에 도달」이 맞다 | 🟡 |
| F4 | BLS 2Q 수정치 생산성 +1.4%(연율) · +2.2%(전년비) | BLS 2026-09-03 일치 · ULC +1.2% · +1.4% | ✅ |
| F5 | H.4.1(9/10) 준비금 증가 · TGA 감소 | 준비금 $2,991,310M(+$96,779M) · TGA 주간 평균 $883,335M(전주 $967,935M) | ✅ ⚠ 우리 `tga`는 수요일 잔액(WDTGAL) — 숫자가 다르다 |
| F6 | WTI $105.83 · Brent $108.75 마감(Reuters) | Reuters 원문 접근 차단. 같은 날 Reuters 장중(06:33 GMT) Brent $107.55(+1.87) · WTI $103.27(+1.88), 13:20 ET Brent $109.20 · WTI $106.46 → 역산한 전일 종가에 +$3.07 · +$4.44 = 보고서 값과 정합. 헤드라인 「settles $3 higher」와도 맞다 | 🟡 결제가 직접 확인 못 함 |
| F7 | East-West 송유관 차질이 세계 공급 최대 약 4% | Reuters 「up to 4% of global oil supply」 일치 | ✅ |
| F8 | BIS: 스테이블코인 가치 약 98%가 달러 표시 | BIS Paper 170(Aldasoro·Frost·Ito, 2026-05-05) 일치 | ✅ ⚠ 5월의 정적 수치 — 일간 점수 변화의 근거가 될 수 없다 |
| F9 | VIX 20 아래 · HY OAS 위기 수준과 거리 | 포털 VIX 17.1 · HY 2.71%p(9/14) | ✅ |
| F10 | 「강달러」로 Gold·BTC 압박 | 포털 DXY 99.69 — 수준만으로 「강달러」라 하기 어렵다. Gold·BTC 가격 변화는 보고서에 숫자가 없다 | ❓ |
| F11 | Fed 결정 전 시장 | FOMC 결정 **9/16 14:00 ET = 9/17 03:00 KST** — 보고서는 결정 **전** 기준임을 머리에 밝혀야 한다 | 🟡 |
| F12 | 「아직 확정하기 이름」 | 오타 — 「이르다」 | 🟡 |
| F13 | 문서 구조 | `<article>` 안에 `<!DOCTYPE html><html>`이 **한 번 더** 들어 있다(pandoc 출력을 감쌈) — 티스토리에 붙이면 스타일이 섞인다 | ❌ |

### 2-2. 논리 — 보고서 숫자가 자기 산식과 맞는가

| # | 보고서 | 검산 | 판정 |
|---|---|---|---|
| L1 | **RTS 82** (링크 100·100·95·98·99·85·45·30) | 프롬프트 5장 식 `0.6×평균 + 0.4×min(핵심)` → 평균 81.5, 핵심 최솟값(Funding) 30 → **0.6×81.5 + 0.4×30 = 60.9.** 82가 되려면 보너스가 +21 필요한데, 보너스 크기는 정의가 없다. **보고서 82는 평균값(81.5)을 그대로 쓴 것으로 보인다** — 병목식을 스스로 적용하지 않았다 | ❌ |
| L2 | **Engine Heat 99 · Monetary Discipline 99** | 프롬프트 4장 식 `50 + 10×z`에 ±3 winsorize → 점수 범위가 **20~80**이다. 99는 이 식으로 나올 수 없다. 참고: 같은 날 포털 경기 엔진 온도 **53**(커버리지 90%) · 근원 CPI 전년비 2.4% | ❌ |
| L3 | **Market Stress 72** → 0.7×72 + 0.3×99 = 80.1 | 산술은 맞다. 그러나 VIX 17.1 · HY 2.71%p · Funding 30(보고서 자신)인데 Market Stress가 72라면, 명세 §31 비중(VIX 0.20 · 신용 0.20 · 자금 0.15)상 나머지(MOVE·꼬리위험·시장 폭)가 극단이어야 한다. MOVE는 무료 출처가 없다 → **근거 제시 없는 과대 가능성** | 🟡 |
| L4 | Dollar Network 74(**전일 73**) | 새 관측 없이 하루 +1 — 프롬프트가 요구한 「stale·결측 때문인 변화 플래그」가 보고서에서 빠졌다 | ❌ |
| L5 | 「R3 — Monetary Re-Tightening + Geopolitical Inflation Shock」 | 프롬프트 목록 순서상 Geopolitical Inflation Shock은 4번 → 복합 상태면 **R3+R4**. 게다가 포털 명세 §46의 번호(R5 = Capital Crowding-Out, R7 = Liquidity/Credit Stress)와 다르다 | ❌ |
| L6 | 경쟁가설 Confidence 99 · 99 · 98 · 91 … | 산식 없음. 서로 배타적이지 않은 가설이 모두 90점대 — 확률로 읽히면 오해. 운영자 원칙 「자유 퍼센트 금지」와 충돌 | ❌ |
| L7 | Market Risk 80이 그룹표와 계기판에 **두 번** | 같은 점수 중복 표시 — 정보가 아니라 공간 낭비 | 🟡 |
| L8 | Engine Heat 입력에 **10Y·30Y 명목금리** 포함(프롬프트 2장) | 금리는 과열의 **결과·냉각 수단**이다. Heat에 넣으면 Monetary Discipline·Long-Rate Discipline과 **이중 계산** → L2의 99를 부풀린 원인 중 하나로 보인다 | ❌ |
| L9 | GLS 51 | 포털 GLS **46**(80%, 9/16). 입력·정규화가 다르므로 차이 자체는 오류가 아니다. 단, 보고서는 입력을 밝히지 않는다 | 🟡 |

---

## 3. 비교 판정 — ChatGPT vs 기존 연구(명세 v1.0 · 설계서)

판정: **채택**(ChatGPT 우위 → 반영) · **유지**(기존 우위 → 고치지 않음) · **개선**(둘 다 부족 → 새 안)

| # | 항목 | ChatGPT | 기존(우리) | 판정 | 이유 | 반영 |
|---|---|---|---|---|---|---|
| V1 | 정규화 | `50 + 10z`, ±3 | `50 + 16.667z`, Robust Z(MAD), ±3 | **유지** | ChatGPT 식은 20~80에 갇힌다(L2) | — |
| V2 | 신뢰 표시 | 70% 단일 문턱 | 80% 미만 LOW · 60% 미만 미발행 | **유지** | 두 단계가 「보여 주되 조심」과 「안 보여 줌」을 가른다 | — |
| V3 | 신선도·근거 가중 | 점수 가중치에 곱함 | Confidence(§42)로 분리 | **유지 + 채택(일부)** | 곱하면 자료가 묵는 것만으로 점수가 움직인다(L4의 원인). 단 ChatGPT의 **「변화 원인 플래그」는 채택** | G7 |
| V4 | 사건의 점수화 | Reuters 확인 사건 0.85 가중 | 사건은 파도·이슈(claims 등급), 점수엔 수치 계열만 | **유지** | 운영자 원칙 ③ | — |
| V5 | RTS 집계 | 병목식 + 지속·교차확인 + `regime_changing`·`financial_crisis` 플래그 | §32 선형 7요소 | **채택** | 「Credit·Funding이 안정이면 과하게 오르지 않게」라는 §32 주석을 식으로 구현한다. ⚠ **보너스 크기 미정의는 개선**: 각 +5, 합 +10 상한 | G6 |
| V6 | 레짐 목록 | 7개(이름만) | R1~R8(진입 조건 숫자) | **유지 + 채택(일부)** | 조건이 숫자로 있는 쪽이 재현된다. 명세에 없는 **Geopolitical Inflation Shock · Debasement/Scarcity Repricing**만 R9·R10 후보로 채택 | G9 |
| V7 | 복합 상태 · 히스테리시스 · Structural 층 | 있음 | 3일 지속 → 주간 확인만 | **채택** | 한 레짐으로 설명 안 되는 날(9/16)이 실제로 있다. 진입·이탈 문턱 분리는 깜박임을 막는다 | G9 |
| V8 | Gold · BTC | 모형 분리 | §38에서 둘 다 확인 변수로 한 점수 안 | **채택** | 9/16처럼 금과 BTC의 동인이 갈린다. `gold_scarcity`·`btc_scarcity` 분리, §38은 유지 | G5 |
| V9 | Engine Power | 입력 목록만 | **정의 없음**(R8 조건에서 쓰는데 식이 없다) | **개선** | ChatGPT 입력 목록 + 명세 형식으로 식을 만든다. ⚠ EPS revision은 무료 출처 없음 → 실현 기업이익으로 대체 | G4 |
| V10 | Engine Heat 입력 | 명목 10Y·30Y 포함 | §30 실질금리 압력 0.05만 | **유지** | 이중 계산(L8) | — |
| V11 | Dollar Paradox | 상태 이름만 | 없음 | **개선** | 규칙을 새로 정의(G7) | G7 |
| V12 | Stablecoin additionality | 4분해 + **추정범위·confidence** | §40 5분해(국채 재배분 포함) | **유지 + 채택(일부)** | 5분해가 상위 집합. 「범위로 표시」는 채택 | 보류 절 |
| V13 | 백테스트 사례 | 2008 · 2020 · 2022 · 2023 지역은행 | §48 금리 돌파 중심(1994~2026) | **채택** | 스트레스 레짐(유동성·신용) 검증 사례가 명세에 없다 | G10 |
| V14 | 민감도·결측 모의·drift·source break | 있음 | 모델 최신성 대시보드만 | **채택** | | G10 |
| V15 | 경쟁가설 | Evidence Confidence 숫자 | 증거 목록 · 증거 3개 미만 보류 | **유지** | L6 | — |
| V16 | Rate Absorption | 입력 나열(가중치 없음) | §18 가중치 + 대체 입력 | **유지** | | — |
| V17 | 스택 | FastAPI · Postgres/Timescale · Redis | Workers · D1 · Next 15 | **유지** | 9/13 결정 · 운영 부담 | — |
| V18 | 공개 API 8개 | 있음 | 서버 함수가 §55 모양 | **유지(나중 채택 가능)** | 남용·비용 측정 먼저 | G12 |
| V19 | 첫 화면 | 「오늘의 큰 바람」 + Current Regime 최상단 | 결정 ①: 「지금 부는 바람」 아래 한 줄 콕핏 | **개선(운영자 9/16 결정)** | ⚠ **금리 정보(금리 방향 카드) 하단에 앞단 프레임** — 한 줄 요약 + 주요 점수. ~~유동성 카드 하단~~은 오독(2026-09-16 정정) | **G1** |
| V20 | 종목 화면 context 배지 | 있음 | 없음 | **채택** | 한 컴포넌트를 홈·종목에서 재사용 | G8 |

---

## 4. 이미 있음 — ⚠ 만들지 않는다

### 4-1. 구조·원칙

| 원문 요구 | 이미 있는 것 | 위치 |
|---|---|---|
| Raw → Normalization → Sub-score → Group → Regime | 명세 v1.0 파이프라인 | `lib/scores/{normalize,momentum,composite,engine}.ts` |
| 지표 메타데이터 | 카탈로그 + L1 `MacroObservation`(releaseDate·retrievedAt·vintageDate·revision·source) | `lib/macro/sectors/*.ts` · `lib/macro/vintage.ts` |
| freshness | 신선도 판정 · 모델 최신성 대시보드 | `lib/macro/freshness.ts` · `/admin` |
| evidence_strength | claims 등급 Fact / Inference / Hypothesis / Rejected | `lib/macro/claims.ts` |
| 결측 ≠ 0 · coverage | 결측은 분모에서 제외 · 80/60 규칙 | `lib/scores/engine.ts` |
| model_version · 과거 재현 | `MODEL_VERSION` · `ScoreValue(modelVersion)` · `valuesAsOf` | `lib/scores/config.ts` · `lib/macro/vintage.ts` |
| 점수 원인 역추적 | 기여도 · 결측 이유 문장 · 「숫자 뜯어보기 · 해석」 팝업(GLS) | `engine.ts` · S4 |
| 1차 자료 우선 · Reuters 보조 | 파도 `MacroNews`(연준 RSS·BLS 자동 + 관리자 입력, 본문 미저장) | S3a·S3b |
| 일일 보고서 붙여넣기 · 산식 없는 점수 경고 | `/admin/analysis` · `lib/analysis/guard.ts`(`findUnsourcedScores`) | S4 |
| Buyback ≠ QE · 국내/해외 RRP 분리 · Policy ≠ Liquidity ≠ Risk | 명세 §14 · `rrp`/`rrp_foreign`(테스트 강제) · 운영자 원칙 | `sectors/liquidity.ts` |
| 홈 조류(유동성·버블·엔진 온도·금리 방향) | `lib/scores/tide.ts` · `HOME_BLOCKS`의 `tide` | 12-6 |

### 4-2. 점수 — 원문 이름 → 기존 키

| 원문 | 기존 `ScoreKey` | 상태(9/16) |
|---|---|---|
| Global Liquidity Score · Cooling & Liquidity | `global_liquidity`(+ 하위 5) | **계산 중 · 46 · 80%** — ⚠ 「Cooling & Liquidity」는 **표시 이름만** |
| Engine Heat | `engine_heat` | **계산 중 · 53 · 90%** |
| Market Risk & Geopolitical Stress | `market_risk_geopolitical` | 정의됨 · geopolitical 40%로 미발행 |
| Risk Transmission | `risk_transmission` | 정의됨 · 매핑 전 |
| Crypto Institutional Flow | `crypto_flow` | 정의됨 · 원자료 없음 |
| Fiscal Dominance · Monetary Discipline · Debasement · Dollar Network | `fiscal_dominance_pressure` · `monetary_discipline` · `debasement_expectation` · `dollar_network` | 정의됨 · 매핑 전 |
| Rate Absorption Capacity | `rate_absorption` | 🟡 60% |
| Productivity–Real Yield · Growth–Funding | `lib/macro/capital.ts` | 계산 중 |

### 4-3. 원자료 — 원문 입력 → 기존 키 (⚠ 새 키 금지)

| 원문 입력 | 기존 키 |
|---|---|
| 10Y · 30Y · 2Y · 곡선 | `ust10y` `ust30y` `ust2y` `t10y2y` `t30y2y` |
| real yield · 기대인플레 · term premium | `real10` `bei10` `infl_exp_5y` `term_premium` |
| CPI·PCE·PPI·임금·ULC | `cpi_yoy` `core_cpi_yoy` `core_pce_yoy` `ppi_yoy` `wages_yoy` `ulc_yoy` |
| 생산성 · 명목 GDP · 기업이익 | `prod_yoy` `output_per_worker_yoy` `ngdp_yoy` `corp_profits_yoy` |
| AI CAPEX(거시) · SOX | `pnfi_yoy` `equipment_inv_yoy` `ip_inv_yoy` · `sox` `sector_semi` `sector_tech` |
| 유가 · 금 · 달러 | `wti` `brent` `gold` `dxy` |
| Fed 정책 · 선물 | `fed_funds` `dff` `zq_front` |
| TGA · 준비금 · RRP · Fed 자산 · 순유동성 | `tga`(WDTGAL) `reserves` `rrp` `rrp_foreign` `fed_assets` `netliq` |
| 국채 발행 · 입찰 | `tsy_bill_share` `tsy_coupon_share` `auction10y_btc` `auction10y_yield`(⚠ 운영 수집은 S2-c 대기) |
| SOFR−IORB · 레포 | `sofr` `iorb` `sofr_iorb` `sofr99` `sofr1` `sofr_dispersion` `sofr_rvol` |
| MOVE | ⚠ `ust10y_rvol`(국채 실현변동성, **MOVE 아님**) |
| HY/IG OAS | `hy_spread` `ig_spread`(2023-09~) · 긴 역사는 `baa_spread` |
| VIX · VVIX · SKEW | `vix` `vvix` `skew` |
| 신용 | `ci_loans_yoy` `bank_credit_yoy` `deposits_yoy` `sloos_ci` `total_debt_yoy` |

---

## 5. 충돌 — 결정이 필요한 것

| # | 무엇 | 권고 |
|---|---|---|
| D0 | ⭐ **홈 위치**(운영자 9/16) | ⚠ **2026-09-16 운영자 정정: 「금리 정보 하단」이다.** v0.2가 「유동성 카드 하단」으로 적은 것은 **오독**이다(ChatGPT 프롬프트에서 옮겨지는 과정에서 어긋났다). 자리는 홈 **금리 방향 카드 아래**. 설계서 9장 결정 ①을 이 값으로 개정한다 |
| D1 | freshness·evidence를 점수에 곱할까 | **곱하지 않는다**(V3) |
| D2 | RTS 집계 | **병목식 v1.1** · 핵심 링크 = Credit · Funding · Rates · 보너스 각 +5, 합 +10 상한(V5) |
| D3 | 레짐 번호 | **명세 R1~R8 유지** + 원문 이름 별칭 + R9·R10 후보(V6) |
| D4 | 공개 JSON API | **나중(G12)** |
| D5 | Engine Power 식 | G4 초안 |
| D6 | Dollar Paradox 규칙 | G7 초안 |
| D7 | 새 출처 이용 조건(GPR · DefiLlama · ICI · IMF COFER) | 조건 확인 뒤 채택 |
| D8 | ChatGPT 일일 보고서 점검 | `lib/analysis/guard.ts`에 **L1·L2·L5 검사 추가**(자기 산식 검산 · 20~80 범위 밖 점수 · 명세와 다른 레짐 번호) |

⚠ **운영지침 §0에 따라 먼저 밝히는 충돌 둘**(G1)
1. 운영자 원칙 ② 「자리부터 만들고 점수를 채우지 않는다」 — 프레임은 **발행된 점수가 2개 이상**이고 한 줄 요약이 있을 때만 뜬다. 지금 GLS(80%)·엔진 온도(90%) 둘이 발행 중이므로 **지금 띄울 수 있다.**
2. CTA 우선(CLAUDE.md §5) — 프레임이 인사이트+티스토리 CTA를 한 칸 더 밀어낸다. 배포 가설 「티스토리 클릭이 줄지 않는다」를 `/admin/releases`에 적고 잰다.

---

## 6. 조각 — G0~G12

⚠ 순서: 현재 인수인계의 **S2-c(재무부 GitHub Actions)**와 병행 가능한 것은 G1뿐이다(원자료를 늘리지 않음). 나머지는 S2-c 뒤.

### G0 — 결정 받기 (코드 없음)

5장 D0~D8을 운영자에게 보이고 답을 받아 설계서 9장 결정표에 적는다.

### G1 — ⭐ 홈 앞단 프레임 「Global Capital Regime」 (유동성 카드 하단)

**자리** — ⚠ **2026-09-16 정정.** v0.2는 「유동성 카드 하단」이라 적었으나 **오독**이었다. 운영자가 말한 자리는 **홈 화면의 금리 정보 하단**이다.

- `HOME_BLOCKS`의 `tide`(조류) 안, **금리 방향 카드 바로 아래**.
- ⚠ 홈 조류 줄의 카드는 넷이다 — 유동성 · AI 버블 · 경기 엔진 온도 · **금리 방향**. 프레임은 그중
  **금리 방향 카드 밑**에 붙는다(2026-09-16 운영 화면 확인).
- ⭐⭐ **최종(2026-09-16): 「지금 부는 바람」 타이틀 바로 아래다.** 조류가 아니라 **바람 섹션의 머리**다 —
  홈 순서가 `hero → 바람 → 파도 → 조류`이므로, 이 자리는 파도·조류보다 **위**다.
  ⚠ 자리가 세 번 바뀌었다: 「유동성 카드 하단」(오독) → 「금리 정보 하단 · 줄 전체 밑」 → **「바람」 타이틀 하단**.
  ⭐ UI 공학적으로 타당하다 — 초두 효과·접힌 선 위 주목도 면에서 페이지에서 가장 강한 자리이고,
  「우리가 계산한 판정」이 이 사이트의 차별점이라 가장 먼저 읽혀야 한다.
  ~~조류 카드 줄 아래 전폭 줄~~(폐기).
  - 데스크톱·모바일 모두 **바람 타이틀과 지표 띠 사이**의 전폭 띠
  - ⚠ 인사이트·티스토리 CTA를 한 칸 밀어낸다 — 5장 ⚠2의 배포 가설을 반드시 `/admin/releases`에 적고 잰다.
- 새 블록 키를 따로 만들지 않고 조류 블록 안에서 배치한다 — 두 블록이 같은 `ScoreValue`를 따로 읽으면 한쪽이 뒤처진다.

**모양 (위에서 아래로)**

```text
┌ GLOBAL CAPITAL REGIME ─────────────────────────── 기준 2026-09-16 · 모델 v1.0 ┐
│ [현재 레짐]  판정 준비 중 — 발행 점수 2 / 6                                     │
│ 한 줄 요약:  유동성 46(평소) · 엔진 온도 53(평소, 13주 ↑) — 과열도 경색도 아닌 구간. │
│              시장위험·전달 점수는 준비 중                                        │
│ ┌유동성 46 → 80%┐ ┌엔진온도 53 ↑ 90%┐ ┌시장위험 —┐ ┌전달 —┐ ┌금리흡수 —┐ ┌달러역설 —┐ │
│                                                   자세히 보기 →                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **머리**: 「Global Capital Regime」 · 기준일 · `MODEL_VERSION`
- **현재 레짐**: G9 전에는 「판정 준비 중 — 발행 점수 N / M」. G9 뒤에는 주 레짐(+보조) 이름과 지속 일수
- **한 줄 요약** — 만드는 순서:
  1. 관리자 「그날의 분석」(`/admin/analysis`) 첫 줄이 **오늘 날짜로 발행**돼 있으면 그것 + 「운영자 요약」 표시
  2. 없으면 **프로그램 템플릿**(`lib/scores/regime-summary.ts`, 순수 함수 + 테스트) — 발행된 점수의 수준 말(`levelWord`)과 방향(`tideDirection`)만으로 문장을 만든다
  3. ⚠ AI 문장은 G9(레짐) 뒤. AI는 계산된 숫자만 인용하고 점수를 바꾸지 않는다
  - ⚠ 발행되지 않은 점수를 문장에 넣지 않는다 · ⚠ 매수·매도 표현 금지(`WOODSMAN_DOCTRINE`)
- **주요 점수 칩(최대 6)**: 유동성(GLS) · 엔진 온도 · 시장위험·지정학 · 위험 전달(RTS) · 금리 흡수력 · 달러 역설
  - 칩: 점수 · 방향 화살표+글자 · 커버리지. 🟡 LOW CONFIDENCE는 칩에 표시
  - 미발행 칩: 숫자 대신 「—」와 「준비 중」. ⚠ 미발행이 4개 이상이면 칩 줄을 접고 「발행 N개」만
  - ⚠ GLS·엔진 온도는 위 조류 카드와 **같은 `ScoreValue` 행**을 읽는다(재계산 금지). 프레임이 캡처·공유될 때 혼자 읽히도록 작은 칩으로 다시 보인다 — 큰 숫자는 조류 카드에만
- **자세히 보기**: G8 전에는 `/macro`의 자본 엔진 카드 앵커, G8 뒤에는 `/capital-regime`
- 컴포넌트: `features/home/ui/CapitalRegimeFrame.tsx` · 칩은 `RegimeChip` · 레짐 배지는 `RegimeBadge`(G9에서 종목 화면이 재사용)

**수용 기준**
- [ ] 발행 점수 2개 미만이면 프레임이 뜨지 않는다(테스트)
- [ ] 요약 문장에 미발행 점수가 들어가지 않는다(테스트)
- [x] 「지금 부는 바람」 타이틀 바로 아래(로컬 화면 확인 2026-09-16) — ⚠ 유동성 카드 아래가 아니다
- [ ] 배포 가설(티스토리 클릭) `/admin/releases`에 기록
- [ ] 설계서 9장 결정 ① 개정 · 12-6에 프레임 절 추가 · CHANGELOG

### G2 — 새 원자료 (L1 먼저)

⚠ 섹터 하나 = 파일 하나. **4-3장에 있는 키는 다시 만들지 않는다.**

| 새 키(제안) | 출처 | 주기 | 쓰이는 곳 | 비고 |
|---|---|---|---|---|
| `btc` · `eth` | Yahoo `BTC-USD` · `ETH-USD` | 일간(주말 포함) | G5 · §38 | ⚠ 주말 값 — 모멘텀 창은 달력 기준 |
| `ust20y` | FRED `DGS20` | 일간 | 곡선 | |
| `nasdaq` | Yahoo `^IXIC` | 일간 | G4 | ⚠ `sox`와 한 점수 안 중복 금지 |
| `rgdp_yoy` | FRED `GDPC1`(전년비) | 분기 | G4 | ALFRED 백필 대상 |
| `private_final_demand_yoy` | BEA 민간 국내 구매자에 대한 실질 최종판매(real final sales to private domestic purchasers) | 분기 | G4 | ⚠ **FRED 계열 ID 확인 필요** — 추측으로 적지 않는다 |
| `gpr_daily` | Caldara–Iacoviello GPR 일간 | 일간 | §31 GPR(0.35) | ⚠ 인용 의무 · 형식·이용 조건(D7) |
| `stablecoin_supply` | DefiLlama 스테이블코인 API(달러 표시 합계) | 일간 | §39 · §40 · G8 | ⚠ 2차 집계 → `Inference` · 발행사 공시로 분기 대조 |
| `mmf_assets` | ICI 주간 MMF 자산 | 주간 | G8 | ⚠ 이용 조건 |
| `cofer_usd_share` | IMF COFER 달러 비중 | 분기 | §39 | ⚠ IMF 데이터 포털 API 변경 여부 |

수용 기준: 운영 수집 1회 성공(`MacroIngest`) · L1 행 · 카탈로그 개수 테스트 · 워커에서 막히면 S2-c처럼 GitHub Actions.

### G3 — 정의된 점수의 측정 매핑 (`measures.ts` · `inputs.ts`)

새 점수를 만들지 않는다. **정의된 구성요소에 계열을 잇기만** 한다.

| 점수 | 구성요소 → 계열(제안) | 기대 |
|---|---|---|
| `geopolitical_stress` | gpr → `gpr_daily` · oil_shock → `brent` 91일 변화 · safe_haven_flow → `gold`·`dxy` 20일 변화(둘 다 오를 때만 +) · persistence → GPR 60일 상위 분위 지속 일수 | 40% → 85%+ → **`market_risk_geopolitical` 발행** |
| `monetary_discipline` | `core_pce_yoy` · `core_cpi_yoy` · `wages_yoy`·`ulc_yoy` · `real10` · fed_reaction → `zq_front − dff` · `infl_exp_5y` · `brent` 변화 | 발행 가능성 확인 |
| `fiscal_dominance_pressure` | `term_premium` · `auction10y_btc`(역) · 적자·이자비용 → MTS(S2-c 경로) · net_supply → ⚠ 「표시만」 결정 유지면 결측 | 커버리지 확인 |
| `debasement_expectation` | `real10`(역) · `dxy`(역) · `bei10` · `gold` · `btc` · `fed_assets` 91일 변화 | 매핑 |
| `dollar_network` | `cofer_usd_share` · `stablecoin_supply` 증가율 · GLS 달러 계기 · `dxy` 실현변동성 | ⚠ 결제·신용 비중은 빈 축 |

⚠ `brent`가 `engine_heat`·`geopolitical_stress`·`monetary_discipline`에 동시에 들어간다 — 한 점수 안 중복은 테스트가 막지만 상위 합성의 이중 계산은 설계서에 적고 운영자 확인(L8의 교훈).

### G4 — Engine Power 정의 (V9, v1.1)

`engine_power`를 `ScoreKey`에 추가 · `MODEL_VERSION = "v1.1"`. 초안(⚠ Woodsman v0 가정 — D5):

| 구성요소 | 계열 | 가중치 | 방향 |
|---|---|---|---|
| real_growth | `rgdp_yoy` | 0.20 | + |
| private_final_demand | `private_final_demand_yoy` | 0.20 | + |
| productivity | `prod_yoy` | 0.15 | + |
| earnings(실현 · EPS revision 대체) | `corp_profits_yoy` | 0.15 | + |
| capex | `pnfi_yoy`(⚠ 장비·지식재산은 넣지 않는다 — 명세 §9 겹침 교훈) | 0.15 | + |
| growth_equity | `sox` **또는** `nasdaq`의 200일선 괴리(하나만) | 0.10 | + |
| ai_financing_risk | `circular_financing_risk`(미발행이면 결측) | 0.05 | − |

수용: 합 1.00 · 한 점수 안 같은 계열 금지 · 명세 R8 조건이 이 키를 읽는다. ⚠ 명목금리는 넣지 않는다(V10).

### G5 — 콕핏 6그룹 + 희소자산 분리 (V8)

| 원문 그룹 | 읽는 키 |
|---|---|
| Engine Power | `engine_power` |
| Engine Heat | `engine_heat` |
| Cooling & Liquidity | `global_liquidity`(표시 이름만) |
| Dollar Network Power | `dollar_network` |
| Monetary Scarcity / Debasement Hedge | ⭐ **두 칸**: `gold_scarcity` · `btc_scarcity` + 참고 `debasement_expectation` |
| Market Risk & Geopolitical Stress | `market_risk_geopolitical` |

- `gold_scarcity`: `gold` 수준·모멘텀 · `real10`(역) · `dxy`(역) · 중앙은행 금 수요(무료 출처 없으면 결측)
- `btc_scarcity`: `btc` 수준·모멘텀 **`nasdaq` 대비 초과분으로**(risk beta 제거) · `global_liquidity` · `crypto_flow`(없으면 결측)
- ⚠ 두 모형을 평균 내지 않는다. ⚠ L7 교훈 — 같은 점수를 표 두 곳에 크게 싣지 않는다.

### G6 — Risk Transmission v1.1 (V5 · D2)

- 링크: Shock Origin(GPR·유가) → Inflation(BEI·유가) → Rates(`real10`·`ust10y` 변화) → Equity(`nasdaq`·`sox` 낙폭) · Credit(`hy_spread`·`baa_spread` 변화) · Funding(`sofr_iorb`·`sofr_dispersion`)
- `RTS = 0.6 × 가중평균(links) + 0.4 × min(Credit, Funding, Rates)` + 지속 +5 · 교차확인 +5 · 상한 100
- 플래그: `regime_changing` = RTS ≥ 70이 3거래일 + (Oil · Rates · Credit · Equity 중 3개 ≥ 60) · `financial_crisis` = Credit·Funding 모두 ≥ 70일 때만
- ⭐ PENDING: 시장이 닫힌 날에는 RTS를 올리지 않는다(테스트)
- ⭐ 검산 테스트: 9/16 보고서 링크값(100·100·95·98·99·85·45·30, 동일 가중) → 보너스 전 **60.9**(L1 재현)
- 문턱 70·60·3일은 백테스트 뒤 교정 표시

### G7 — 변화 원인 플래그 · Dollar Paradox (V3 · V11)

**변화 원인**
- `ScoreContribution` 저장(설계서 6장 L5)
- 전일 대비 변화마다 원인 코드: `DATA_UPDATE` · `STALE` · `MISSING_CHANGED`(결측 집합 변화 → 재정규화) · `MODEL_CHANGED` · `RECOMPUTED`
- 1일 변화는 LIVE가 이틀 쌓인 뒤부터(그 전엔 「비교 없음」). 1주·1개월은 평가일 셋에 7일·30일 추가
- ⭐ 새 관측이 없는데 점수가 움직이면 `STALE`/`MISSING_CHANGED`로 표시(L4 재발 방지)

**Dollar Paradox — 규칙 초안(D6, Woodsman v0)**

| 상태 | 조건 |
|---|---|
| ACTIVE | `dollar_network ≥ 60` · `gold_scarcity ≥ 60` · `btc_scarcity ≥ 60` — 주간 확인 2회 연속 |
| LATENT | `dollar_network ≥ 60`이고 희소자산 하나만 ≥ 60, 또는 셋 다 충족이나 지속 미확인 |
| INACTIVE | `dollar_network < 60`, 또는 희소자산 둘 다 < 50 |
| 판정 보류 | 셋 중 하나라도 미발행 |

⚠ 지금은 `dollar_network` 매핑 전이라 **판정 보류가 정상**이다. 보고서의 「LATENT」를 옮겨 적지 않는다. 진입·이탈 문턱은 G9 히스테리시스와 같은 방식.

### G8 — `/capital-regime` + ⭐ Capital Flow Map v0

설계서 8장 R5와 합친다. 내비 「자본 레짐」 · `/macro` 자본 엔진 카드 이전(판단은 한 곳).

화면 순서: 한 줄 요약(G1과 같은 함수) → 현재 레짐 → 6그룹 콕핏 → 핵심 4(GLS · Market Risk · RTS · Crypto Flow) → 보조 4(Fiscal · Monetary Discipline · Debasement · Rate Absorption) → Dollar Paradox → **Capital Flow Map** → 위험 전달 사슬 → 레짐 타임라인 → 증거 커버리지·신선도 → 방법론(3장 비교 판정 요약 포함).

**Capital Flow Map v0 규칙**
- ⭐ **측정된 달러 흐름과 가격 신호를 같은 선으로 그리지 않는다.**
  - 실선(굵기 = 주간 변화 $B): `fed_assets` · `reserves` · `tga`(감소 = 시장 공급) · `rrp`(국내) · `mmf_assets` · `stablecoin_supply` · 국채 순발행(S2-c 뒤)
  - 점선(방향 화살표만): `nasdaq`·`sox` · `gold` · `btc` · `dxy` · 신용 스프레드 — 범례 「가격 신호 — 자금 이동량 아님」 필수
  - `rrp_foreign`은 흐름도 밖 참고 상자(「달러 네트워크 참고」)
- ⚠ 주가 상승을 「주식으로 자금 유입」으로 그리지 않는다(ETF 유출입 원자료 없음)
- ⚠ TGA 노드에 WDTGAL(수요일 잔액)인지 WTREGEN(주간 평균)인지 적는다
- 구현: 자체 SVG · 계산은 `lib/capital-flow/map.ts`(순수 + 테스트) · 화면 `features/capital-regime/ui/` · 모바일은 위→아래 세로 흐름

**드릴다운 · 재사용**
- 카드 클릭 → S4 팝업 일반화: 원자료 · 기여도 · 출처 · 관측일 · 발표일 · 수집일 · 결측 이유 · 변화 원인(G7) · 경쟁가설(증거 목록)
- 종목분석(`/stocks`) 상단 `RegimeBadge`: 레짐 이름 + Rate Absorption(발행 시) — V20

### G9 — 레짐 엔진 (V6 · V7 · D3)

- 명세 §46 R1~R8 + R9 Geopolitical Inflation Shock · R10 Debasement/Scarcity Repricing(D3 채택 시, 조건은 숫자로 새로 정의해 확인)
- 별칭 표: ChatGPT 이름 → 명세 번호(예: Productive Expansion → R1 · Monetary Re-Tightening → R3 · Liquidity/Credit Stress → R7 · Stagflation/Fiscal-Capital Stress → R8(+R5 조건 참고))
- 지속: 후보 → 3거래일 → 주간 확인 → 레짐 · **Structural = 13주 이상 유지**(표시만)
- 히스테리시스: 진입·이탈 문턱 분리(예: 70 / 62), 값은 `config.ts`
- 복합 상태: 동시 충족 최대 2개(주 = 충족 여유가 큰 쪽)
- 저장: `RegimeHistory(asOf · primary · secondary · modelVersion · reason JSON)`
- 전환 조건표를 화면에 숫자로(보고서 12절 형식)

### G10 — 검증 (V13 · V14)

- 에피소드 추가: 2008 금융위기 · 2020 코로나 · 2023 지역은행 사태
  - ⚠ HY OAS 2023-09~ → `baa_spread` · SOFR 2018~ · IORB 2021~ — 이전 구간 대체 계열은 **확인 후** 적고, 없으면 결측
- 가중치 교란 ±20% · 구성요소 하나씩 제거 모의 · 점수 이동(drift) · 출처 단절 → `/admin` 모델 최신성에 줄 추가
- 판정: 「사건을 맞혔나」가 아니라 「사전에 정한 관계와 같은 방향이었나」 · 포인트 인 타임은 `valuesAsOf`

### G11 — 경보 (관리자 전용)

레짐 후보 · RTS `regime_changing` · GLS 하드 트리거(§45) · 커버리지 급락 · 출처 단절 → `AdminLog`부터.

### G12 — (선택) 공개 읽기 API

D4 채택 시만. 응답에 `asOf · freshness · confidence · coverage · modelVersion` · 속도 제한은 병렬 조건으로 잰 뒤 인정(CLAUDE.md §3).

### 보류 — Crypto Institutional Flow · Stablecoin additionality

- ETF 유출입: 공식 API 없음(설계서 4장 판정 유지). 발행사 공시 주 1회 관리자 입력만 검토
- Stablecoin additionality: 명세 §40 5분해 · 기본 INSUFFICIENT EVIDENCE · 추정 **범위**로 입력(출처·확인일 필수) · ⚠ 준비자산 전체를 신규 국채 수요로 세지 않는다

---

## 7. 하지 말 것

- ⚠ 4장의 키·점수와 같은 뜻의 새 이름(`gls_v2` · `liquidity_score` · `cooling_liquidity` …)
- ⚠ ChatGPT 보고서 점수(Engine Heat 99 · GLS 51 · RTS 82 …)를 시드·기본값·테스트 기대값으로 사용
- ⚠ Yahoo `^MOVE`를 MOVE로 쓰기 · 국채 실현변동성을 「MOVE」로 부르기
- ⚠ Engine Heat에 명목금리 넣기(L8)
- ⚠ 새 스택 · 운영 D1에 `--file` · 빈 테이블 먼저 만들기
- ⚠ 주가 변화를 자금 흐름 선으로 그리기

## 8. 수용 기준 — 조각 공통

- [ ] 한 조각 = 한 배포 · 배포 확인 뒤 다음 push
- [ ] 새 순수 함수마다 테스트 · 가중치 합 1.00 · 한 점수 안 같은 계열 금지
- [ ] `coverageReport()` 표(설계서 11-5)를 프로그램으로 다시 뽑아 붙임
- [ ] 운영 수집 결과로 확인한 뒤 「해결」
- [ ] 설계서 개정표 · `CHANGELOG.md` · 운영지침(원칙이 바뀌면) 동시 갱신

## 9. 출처 (2026-09-16 확인)

| 항목 | 출처 |
|---|---|
| 국채 명목·실질 | U.S. Treasury, Daily Treasury Par Yield Curve Rates · Par Real Yield Curve Rates (2026-09) |
| 생산성 | BLS, Productivity and Costs — Second Quarter 2026, Revised (2026-09-03) |
| 준비금·TGA·RRP | Federal Reserve, H.4.1 (2026-09-10) |
| 스테이블코인 | BIS Paper 170, Aldasoro·Frost·Ito (2026-05-05) |
| 유가·송유관 | Reuters, 2026-09-15 (Yahoo Finance · Lufkin Daily News 전재본) — 결제가 원문 미확인 |
| FOMC 일정 | 2026-09-15~16, 결정 14:00 ET (fedratecalc — 연준 일정표로 재확인 권장) |
| 포털 값 | portfolio-solutions.net (2026-09-16 조회) |

## 개정

| 판 | 날짜 | 무엇 |
|---|---|---|
| v0.4 | 2026-09-16 | ⭐ **자리 최종 — 「지금 부는 바람」 타이틀 바로 아래**(바람 섹션 머리 · 파도·조류보다 위). G1 구현·로컬 확인 완료. G3보다 먼저 지었다(운영자 지시) |
| v0.3 | 2026-09-16 | ⚠ **운영자 정정 — 프레임 자리는 「금리 정보 하단」 · 「그 카드가 속한 줄 전체의 밑」(전폭 띠)**(v0.2의 「유동성 카드 하단」은 오독) · G0 결정 받음: **G3를 먼저 하고 G1**(오늘 발행 점수가 2개뿐이라 프레임이 조류 카드와 중복된다) · D1~D8은 권고대로 · 4-2장 `rate_absorption 🟡 60%`는 **사실과 다름**(운영에 행 없음 — `COMPUTED_SCORES`는 7개뿐) |
| v0.2 | 2026-09-16 | 운영자 추가 지시 반영 — 팩트체크(사실 13 · 논리 9) · ChatGPT vs 기존 비교 판정 20항목 · **G1 홈 앞단 프레임(유동성 카드 하단)** · RTS 검산 테스트 · 보고서 점검기 확장(D8) · 문서명 「개발요구서」 |
| v0.1 | 2026-09-16 | 이미 있음 · 충돌 · 새 조각 · Capital Flow Map v0 규칙 |
