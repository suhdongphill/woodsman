---
title: GCRM v2 — 기존 자산 조사 (단계 1)
created: 2026-09-19
depends_on: GCRM_설계점검_v2.md
tags: [woodsman, macro, regime, 조사]
---

# GCRM v2 — 기존 자산 조사

> 조사만 했다. 코드는 쓰지 않았다.
> 대조 기준: `docs/GCRM_설계점검_v2.md` §C-1 · §C-2 · Part 4
> 데이터는 **운영 D1(`woodsman-db --remote`)** 을 직접 조회했다. 로컬 miniflare 사본은 38계열 400점뿐이라 쓰지 않았다.
> 조회 시각 2026-09-19.

---

## 0. 먼저 — 명세의 전제 세 개가 실제와 다르다

조사의 결론부터 적는다. 이 셋을 정하지 않으면 단계 2부터 틀린 자리에 짓는다.

### 0-1. `indicator` / `observation` 테이블은 없다 ★

명세 §C-1과 단계 0의 원칙 7은 "기존 포털 테이블(indicator, observation)을 재사용한다"고 한다.
**그런 이름의 테이블은 이 저장소 어디에도 없다.**

실제로 있는 것:

| 명세가 가정한 것 | 실제 | 어디에 |
|---|---|---|
| `indicator` (지표 정의 테이블) | **테이블이 아니라 코드**다 — `web/src/lib/macro/sectors/*.ts` 14개 파일에 정의하고 `registry.ts`가 모은다 | TypeScript |
| `observation` (원시 관측) | `MacroPoint` (최신 1벌, L2) + `MacroObservation` (vintage 이력, L1) | Cloudflare D1 |
| — | `ScoreValue` (계산된 점수) · `MacroIngest` (수집 실행 기록) | Cloudflare D1 |

`pms.db`(SQLite)에는 `rates_*` 5개 테이블만 있다. 파이썬 `pms`는 금리 섹터 실험용이고 **포털이 읽는 데이터가 아니다.**

### 0-2. 포털은 파이썬이 아니라 TypeScript/Cloudflare Workers다 ★

명세 §2-19와 단계 8은 `pms regime run` 같은 파이썬 CLI를 전제한다.
실제 포털은 Next.js + OpenNext + Cloudflare Workers이고, `web/CLAUDE.md` §4가 못 박는다.

> 런타임에 Prisma를 쓰지 않는다. 질의는 `src/lib/d1.ts`의 D1 바인딩으로 한다.

여기서 따라 나오는 것: **명세 §2-16의 `config/gcrm/*.yaml`을 런타임에 읽을 수 없다.**
Worker는 실행 중 파일을 읽지 못한다. 그리고 이 문제는 이미 한 번 풀려 있다 —
`web/src/lib/scores/config.ts` 머리말이 같은 상황을 이렇게 적어 두었다.

> 명세는 `/config/scores.yaml` + Python을 권한다. 이 사이트는 Cloudflare Workers + TypeScript이고,
> Worker는 실행 중에 파일을 읽지 못한다. 그래서 **뜻은 그대로 지키고 형식만 바꿨다** —
> 가중치·임계값은 이 데이터 파일 한 곳에만 있고, 계산 코드는 숫자를 모른다.

### 0-3. 「자본 레짐 엔진 v1.0」이 이미 돌고 있다 ★가장 중요

명세는 GCRM을 새로 짓는 것으로 쓰여 있지만, **선행 구현이 이미 운영 중이다.**

- `web/src/lib/scores/` — 19개 파일 2,976줄, 전부 테스트 있음
  (`config.ts` `normalize.ts` `momentum.ts` `composite.ts` `engine.ts` `inputs.ts` `tide.ts` `regime-summary.ts` `store.ts` …)
- 점수 키 **29개** 정의 — `global_liquidity` `risk_transmission` `rate_absorption` `engine_heat`
  `market_risk_geopolitical` `fiscal_dominance_pressure` `monetary_discipline` `debasement_expectation`
  `dollar_network` … **명세 §B-1의 10개 기둥과 거의 그대로 겹친다.**
- 운영 D1 `ScoreValue`에 **10개 키가 실제로 발행 중**(`v1.0`, LIVE 7일치 + RECOMPUTED 14일치)
- 홈 `GLOBAL CAPITAL REGIME` 카드가 그중 6개를 칩으로 띄운다(`regime-summary.ts`)
- 근거 문서: `docs/설계_점수계산명세_v1.md` · `docs/설계_자본레짐엔진.md` · `docs/개발요구서_GlobalCapitalRegime_2026-09-16.md`

즉 GCRM v2는 **신규 구축이 아니라 v1 엔진의 확장 또는 교체**다. 명세가 이 사실을 모르고 쓰였다.

v1과 v2가 같은 문제에 다른 답을 낸 지점:

| 항목 | 엔진 v1.0 (운영 중) | GCRM v2 명세 |
|---|---|---|
| 정규화 | robust z(중앙값·MAD, ±3) → `50 + 16.667·z` | **백분위(pct_rank)** 기본 |
| 창 | 10년 롤링, 최소 5년 | expanding, `min_obs` 750(≈3년), `max_window` 2500 |
| 방향(부호) | `HIGH_IS_POSITIVE` / `HIGH_IS_NEGATIVE` / `NEUTRAL_CENTERED` / `BIPOLAR` 4종 | `polarity: +1 / −1` 2종 |
| 설정 위치 | TypeScript 데이터 파일 1곳 | `config/gcrm/*.yaml` 6개 |
| 버전 | `MODEL_VERSION` 올리면 옛 점수는 옛 버전으로 남음 | `model_version` + `config_hash` + `git_sha` |
| 커버리지 게이트 | 60% 미만 → `DO_NOT_PUBLISH`(값 null) | 기둥 60% / 축 70% → `INSUFFICIENT` |
| 시간축 | `tide.ts`가 방향만(문턱 5점) | tide/wind/wave 3축 전면 |

**정규화 방식이 다르면 같은 이름의 점수가 다른 숫자를 낸다.** 한 사이트 안에
`global_liquidity` 48(v1)과 유동성 51(GCRM)이 동시에 뜨는 사고가 여기서 난다.

---

## 1. 실제 스키마

### 1-1. `MacroPoint` — L2, 화면이 읽는 최신 1벌

```sql
seriesKey  TEXT     -- 지표 key (registry의 MacroIndicator.key)
date       DATETIME -- 관측 기준일, 정오 UTC
value      REAL
source     TEXT     -- FRED | YAHOO | MANUAL
updatedAt  DATETIME
PRIMARY KEY (seriesKey, date)
```

운영 현황: **234,002행 · 100계열**

### 1-2. `MacroObservation` — L1, vintage 이력 (point-in-time의 근거) ★

```sql
seriesKey        TEXT
observationDate  DATETIME  -- 관측 기준일
vintageDate      TEXT      -- YYYY-MM-DD, 이 값이 알려진 날
value            REAL
source           TEXT
origin           TEXT      -- ALFRED | INGEST | MANUAL | SEED_L2
retrievedAt      DATETIME
PRIMARY KEY (seriesKey, observationDate, vintageDate)
```

**추가만 한다**(2026-09-13, Capital Regime Engine R1). 읽는 함수는 `web/src/lib/macro/vintage.ts`의 `valuesAsOf`.

운영 현황 — **여기가 백테스트의 실제 한계다**:

| origin | 행 수 | 계열 수 | vintage 범위 | 뜻 |
|---|---|---|---|---|
| `ALFRED` | 182,318 | **20** | 1927-01-26 ~ 2026-09-11 | 진짜 발표 시점 이력. 이것만 look-ahead 없는 재현이 된다 |
| `INGEST` | 50,097 | 77 | 2026-09-13 ~ 2026-09-19 | **우리가 처음 본 날.** 2026-09-13 이전은 모른다 |
| `SEED_L2` | 183,329 | 66 | 2026-08-06 ~ 2026-09-13 | R1 이전 L2의 갱신일. 그 이전 이력은 없다 |

ALFRED vintage가 있는 20계열: `claims` `core_cpi_yoy` `core_pce_yoy` `cpi_yoy` `houst` `indpro_yoy`
`jolts` `m2_yoy` `nfp_mom` `ngdp_yoy` `pot_gdp_yoy` `ppi_yoy` `prod_yoy` `real_comp_yoy` `retail_mom`
`semi_ip_yoy` `semi_orders_yoy` `semi_util` `ulc_yoy` `unrate` — **전부 월간·분기 거시 계열이다.**

일간 시장계열(VIX·HY OAS·국채·환율·원자재)은 ALFRED vintage가 없다. 다만 이들은 **사후 수정되지 않으므로**
vintage = 관측일로 두어도 무해하다. 남는 문제는 발표 지연(T+1)뿐이고, 그것은 명세 §C-3이 이미 짚었다.

### 1-3. `ScoreValue` — 계산 결과

```sql
scoreKey TEXT · asOf TEXT(YYYY-MM-DD) · modelVersion TEXT
basis TEXT        -- LIVE(그날 알려진 값) | RECOMPUTED(지금 값으로 과거를 재계산)
value REAL NULL   -- ⚠ null은 0점이 아니라 「발행하지 않음」
coverage REAL · state TEXT(OK|LOW_CONFIDENCE|DO_NOT_PUBLISH) · detail TEXT(JSON) · computedAt
PRIMARY KEY (scoreKey, asOf, modelVersion)
```

`basis`가 LIVE/RECOMPUTED로 갈려 있는 것은 **명세 §2-17의 재현성 요구를 이미 한 번 푼 것**이다.
GCRM의 `gcrm_run.config_hash`와 겹치는 자리이므로 설계 때 합쳐야 한다.

### 1-4. `MacroIngest` — 수집 실행 기록

`startedAt · finishedAt · trigger(MANUAL|CRON) · okCount · failCount · addedPoints · detail(JSON)`.
조용한 실패를 막으려고 둔 표다(`web/CLAUDE.md` §3).

---

## 2. 수집 중인 지표 — 전체 목록

레지스트리 지표 **107개** = 저장 계열 100 + 파생 7(저장하지 않고 읽을 때 합성).
출처별: FRED 65 · YAHOO 24 · DERIVED 7 · TREASURY 4 · MANUAL 4 · NAVER 2 · ECOS 1
선언 주기별: 일간 53 · 월간 33 · 분기 12 · 주간 9

| 묶음 | key | 출처 | sourceId | 선언 freq | 관측 시작 | 최근 관측 | 점 수 | 2024 관측수 |
|---|---|---|---|---|---|---|---|---|
| 금리 | `fed_funds` | FRED | `FEDFUNDS` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 금리 | `kr_policy_rate` | ECOS | `722Y001/0101000` | m | 1999-05-01 | 2026-08-01 | 328 | 12 |
| 금리 | `ust10y` | FRED | `DGS10` | d | 1990-01-02 | 2026-09-17 | 9184 | 250 |
| 금리 | `ust2y` | FRED | `DGS2` | d | 1990-01-02 | 2026-09-17 | 9184 | 250 |
| 금리 | `ust30y` | FRED | `DGS30` | d | 1990-01-02 | 2026-09-17 | 9184 | 250 |
| 금리 | `t30y2y` | DERIVED | `—` | d | — | — | 0 | 0 |
| 금리 | `t10y2y` | FRED | `T10Y2Y` | d | 1990-01-02 | 2026-09-17 | 9184 | 250 |
| 금리 | `hy_spread` | FRED | `BAMLH0A0HYM2` | d | 2023-08-07 | 2026-09-17 | 818 | 263 |
| 금리 | `vix` | FRED | `VIXCLS` | d | 1990-01-02 | 2026-09-17 | 9276 | 259 |
| 금리 | `real10` | FRED | `DFII10` | d | 2003-01-02 | 2026-09-17 | 5932 | 250 |
| 금리 | `bei10` | FRED | `T10YIE` | d | 2003-01-02 | 2026-09-17 | 5932 | 250 |
| 금리 | `term_premium` | FRED | `THREEFYTP10` | d | 1990-01-02 | 2026-09-11 | 9160 | 250 |
| 금리 | `ig_spread` | FRED | `BAMLC0A0CM` | d | 2023-08-22 | 2026-09-17 | 806 | 262 |
| 금리 | `zq_front` | YAHOO | `ZQ=F` | d | 2016-09-13 | 2026-09-18 | 2519 | 252 |
| 금리 | `vvix` | YAHOO | `^VVIX` | d | 2016-09-12 | 2026-09-18 | 2511 | 252 |
| 금리 | `skew` | YAHOO | `^SKEW` | d | 2016-09-12 | 2026-09-17 | 2464 | 241 |
| 금리 | `ust10y_rvol` | DERIVED | `—` | d | — | — | 0 | 0 |
| 금리 | `dff` | FRED | `DFF` | d | 1990-01-01 | 2026-09-17 | 13409 | 366 |
| 유동성 | `netliq` | DERIVED | `—` | w | — | — | 0 | 0 |
| 유동성 | `fed_assets` | FRED | `WALCL` | w | 2002-12-18 | 2026-09-16 | 1240 | 52 |
| 유동성 | `tga` | FRED | `WDTGAL` | w | 2002-12-18 | 2026-09-16 | 1240 | 52 |
| 유동성 | `rrp` | FRED | `RRPONTSYD` | d | 2003-02-07 | 2026-09-18 | 3329 | 250 |
| 유동성 | `m2_yoy` | FRED | `M2SL` | m | 1990-01-01 | 2026-07-01 | 439 | 12 |
| 유동성 | `reserves` | FRED | `WRESBAL` | w | 2002-12-18 | 2026-09-16 | 1240 | 52 |
| 유동성 | `rrp_foreign` | FRED | `WLRRAFOIAL` | w | 2002-12-18 | 2026-09-16 | 1240 | 52 |
| 유동성 | `sofr` | FRED | `SOFR` | d | 2018-04-03 | 2026-09-17 | 2113 | 250 |
| 유동성 | `iorb` | FRED | `IORB` | d | 2021-07-29 | 2026-09-19 | 1879 | 366 |
| 유동성 | `sofr_iorb` | DERIVED | `—` | d | — | — | 0 | 0 |
| 유동성 | `sofr99` | FRED | `SOFR99` | d | 2018-04-03 | 2026-09-17 | 2111 | 250 |
| 유동성 | `sofr1` | FRED | `SOFR1` | d | 2018-04-03 | 2026-09-17 | 2111 | 250 |
| 유동성 | `sofr_dispersion` | DERIVED | `—` | d | — | — | 0 | 0 |
| 유동성 | `sofr_rvol` | DERIVED | `—` | d | — | — | 0 | 0 |
| 유동성 | `tsy_bill_share` | TREASURY | `mspd:bill_share` | m | 2014-01-31 | 2026-08-31 | 152 | 12 |
| 유동성 | `tsy_coupon_share` | TREASURY | `mspd:coupon_share` | m | 2014-01-31 | 2026-08-31 | 152 | 12 |
| 유동성 | `auction10y_btc` | TREASURY | `auction10y:bid_to_cover` | m | 2014-01-08 | 2026-09-09 | 154 | 12 |
| 유동성 | `auction10y_yield` | TREASURY | `auction10y:high_yield` | m | 2014-01-08 | 2026-09-09 | 154 | 12 |
| 신용·자금 | `ci_loans_yoy` | FRED | `BUSLOANS` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 신용·자금 | `bank_credit_yoy` | FRED | `TOTBKCR` | w | 1990-01-03 | 2026-09-09 | 1915 | 52 |
| 신용·자금 | `deposits_yoy` | FRED | `DPSACBW027SBOG` | w | 1990-01-03 | 2026-09-09 | 1915 | 52 |
| 신용·자금 | `sloos_ci` | FRED | `DRTSCILM` | q | 1990-04-01 | 2026-07-01 | 146 | 4 |
| 신용·자금 | `baa_yield` | FRED | `DBAA` | d | 1990-01-02 | 2026-09-17 | 9203 | 250 |
| 신용·자금 | `baa_spread` | DERIVED | `—` | d | — | — | 0 | 0 |
| 신용·자금 | `total_debt_yoy` | FRED | `TCMDO` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 환율 | `usdkrw` | YAHOO | `KRW=X` | d | 1990-01-03 | 2026-09-18 | 9192 | 251 |
| 환율 | `dxy` | YAHOO | `DX-Y.NYB` | d | 2016-08-22 | 2026-09-18 | 2534 | 252 |
| 환율 | `usdjpy` | YAHOO | `JPY=X` | d | 1990-01-02 | 2026-09-18 | 9226 | 251 |
| 환율 | `usdcny` | YAHOO | `CNY=X` | d | 1990-01-02 | 2026-09-18 | 9166 | 251 |
| 원자재 | `wti` | FRED | `DCOILWTICO` | d | 1990-01-02 | 2026-09-15 | 9226 | 250 |
| 원자재 | `brent` | FRED | `DCOILBRENTEU` | d | 1990-01-02 | 2026-09-15 | 9308 | 254 |
| 원자재 | `natgas` | FRED | `DHHNGSP` | d | 1997-01-07 | 2026-09-15 | 7455 | 251 |
| 원자재 | `gold` | YAHOO | `GC=F` | d | 2016-08-22 | 2026-09-18 | 2533 | 252 |
| 원자재 | `copper` | FRED | `PCOPPUSDM` | m | 1992-01-01 | 2026-07-01 | 415 | 12 |
| 물가 | `cpi_yoy` | FRED | `CPIAUCSL` | m | 1990-01-01 | 2026-08-01 | 439 | 12 |
| 물가 | `core_cpi_yoy` | FRED | `CPILFESL` | m | 1990-01-01 | 2026-08-01 | 439 | 12 |
| 물가 | `core_pce_yoy` | FRED | `PCEPILFE` | m | 1990-01-01 | 2026-07-01 | 439 | 12 |
| 물가 | `ppi_yoy` | FRED | `PPIACO` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 물가 | `infl_exp_5y` | FRED | `T5YIE` | d | 2003-01-02 | 2026-09-17 | 5932 | 250 |
| 고용 | `unrate` | FRED | `UNRATE` | m | 1990-01-01 | 2026-08-01 | 439 | 12 |
| 고용 | `sahm` | FRED | `SAHMREALTIME` | m | 1990-01-01 | 2026-08-01 | 439 | 12 |
| 고용 | `nfp_mom` | FRED | `PAYEMS` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 고용 | `claims` | FRED | `ICSA` | w | 1990-01-06 | 2026-09-12 | 1915 | 52 |
| 고용 | `jolts` | FRED | `JTSJOL` | m | 2000-12-01 | 2026-07-01 | 308 | 12 |
| 고용 | `wages_yoy` | FRED | `CES0500000003` | m | 2006-03-01 | 2026-08-01 | 246 | 12 |
| 소비 | `retail_mom` | FRED | `RSAFS` | m | 1992-01-01 | 2026-08-01 | 416 | 12 |
| 소비 | `cci` | MANUAL | `—` | m | 2026-07-01 | 2026-08-01 | 2 | 0 |
| 소비 | `umcsent` | FRED | `UMCSENT` | m | 1990-01-01 | 2026-07-01 | 439 | 12 |
| 생산 | `ism_mfg` | MANUAL | `—` | m | 2026-07-01 | 2026-08-01 | 2 | 0 |
| 생산 | `ism_svc` | MANUAL | `—` | m | 2026-07-01 | 2026-08-01 | 2 | 0 |
| 생산 | `indpro_yoy` | FRED | `INDPRO` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 생산 | `phil_fed` | FRED | `GACDFSA066MSFRBPHI` | m | 1990-01-01 | 2026-09-01 | 441 | 12 |
| 생산 | `ngdp_yoy` | FRED | `GDP` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 생산 | `corp_profits_yoy` | FRED | `CP` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 생산 | `power_ip_yoy` | FRED | `IPG2211S` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 생산성·공급 | `prod_yoy` | FRED | `OPHNFB` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 생산성·공급 | `ulc_yoy` | FRED | `ULCNFB` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 생산성·공급 | `real_comp_yoy` | FRED | `COMPRNFB` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 생산성·공급 | `pot_gdp_yoy` | FRED | `GDPPOT` | q | 1990-01-01 | 2026-07-01 | 147 | 4 |
| 생산성·공급 | `output_per_worker_yoy` | FRED | `PRS85006163` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 투자 | `pnfi_yoy` | FRED | `PNFI` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 투자 | `equipment_inv_yoy` | FRED | `Y033RC1Q027SBEA` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 투자 | `ip_inv_yoy` | FRED | `Y001RC1Q027SBEA` | q | 1990-01-01 | 2026-04-01 | 146 | 4 |
| 주택 | `houst` | FRED | `HOUST` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 주택 | `case_shiller_yoy` | FRED | `CSUSHPINSA` | m | 1990-01-01 | 2026-06-01 | 438 | 12 |
| 주택 | `nahb` | MANUAL | `—` | m | 2026-06-01 | 2026-08-01 | 3 | 0 |
| 주택 | `mortgage30` | FRED | `MORTGAGE30US` | w | 1990-01-05 | 2026-09-17 | 1916 | 52 |
| 반도체 | `semi_ip_yoy` | FRED | `IPG3344S` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 반도체 | `semi_util` | FRED | `CAPUTLG3344S` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 반도체 | `semi_orders_yoy` | FRED | `A34SNO` | m | 1992-02-01 | 2026-07-01 | 414 | 12 |
| 반도체 | `sox` | YAHOO | `^SOX` | d | 1994-06-01 | 2026-09-18 | 449 | 12 |
| 반도체 | `hynix` | YAHOO | `000660.KS` | d | 2000-01-31 | 2026-09-18 | 380 | 12 |
| 반도체 | `samsung` | YAHOO | `005930.KS` | d | 2000-01-31 | 2026-09-18 | 380 | 12 |
| 반도체 | `hynix_fwd_per` | NAVER | `000660/추정PER` | d | 2026-09-05 | 2026-09-19 | 14 | 0 |
| 반도체 | `samsung_fwd_per` | NAVER | `005930/추정PER` | d | 2026-09-05 | 2026-09-19 | 14 | 0 |
| 반도체 | `semi_ppi_yoy` | FRED | `PCU334413334413` | m | 1990-01-01 | 2026-08-01 | 440 | 12 |
| 섹터 | `spx_etf` | YAHOO | `SPY` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_tech` | YAHOO | `XLK` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_semi` | YAHOO | `SMH` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_fin` | YAHOO | `XLF` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_energy` | YAHOO | `XLE` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_health` | YAHOO | `XLV` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_indu` | YAHOO | `XLI` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_disc` | YAHOO | `XLY` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_staples` | YAHOO | `XLP` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_util` | YAHOO | `XLU` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_mat` | YAHOO | `XLB` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_reit` | YAHOO | `XLRE` | d | 2016-08-29 | 2026-09-18 | 2528 | 252 |
| 섹터 | `sector_comm` | YAHOO | `XLC` | d | 2018-06-19 | 2026-09-18 | 2074 | 252 |
### 2-1. ⚠ 선언한 주기와 실제 간격이 다른 계열이 있다

정규화 창은 **실제 관측 간격**으로 움직인다. 선언 `freq`를 믿고 "5영업일 창"을 잡으면
그 계열에서는 조용히 5개월 창이 된다. 실측으로 걸러낸 것:

| key | 선언 | 2024년 관측 | 실제 | 파도(wave)에 쓸 수 있나 |
|---|---|---|---|---|
| `sox` | d | **12** | 2025년까지 월간, 2026년 중반부터 일간(2026년 70점) | ❌ 지금은 안 된다 |
| `hynix` | d | **12** | 같음 | ❌ |
| `samsung` | d | **12** | 같음 | ❌ |
| `hynix_fwd_per` | d | **0** | 2026-09-05부터, 총 14점 | ❌ 소급 불가 계열 |
| `samsung_fwd_per` | d | **0** | 같음 | ❌ |

주간(`w`) 9계열은 전부 실제로 주간이다. 문제는 반도체 묶음 5개뿐이다.
**단계 2의 `indicators.yaml`을 쓸 때 `freq`를 레지스트리에서 베끼지 말고 실측값을 근거로 적어야 한다.**

### 2-2. ⚠ 역사가 짧아 정규화 자체가 막히는 계열

명세 §2-3은 `min_obs: 750`(약 3년), `max_window: 2500`(약 10년)을 예시로 든다.
실제 이력과 대조하면 **신용 채널의 뼈대 두 개가 턱걸이다.**

| key | 이력 | 점 수 | `min_obs: 750` | 10년 창 |
|---|---|---|---|---|
| `hy_spread` (HY OAS) | 2023-08-07 ~ | **818** | 겨우 통과 | 불가 |
| `ig_spread` (IG OAS) | 2023-08-22 ~ | **806** | 겨우 통과 | 불가 |
| `iorb` | 2021-07-29 ~ | 1,879 | 통과 | 불가 |
| `sofr` · `sofr99` · `sofr1` | 2018-04-03 ~ | 2,113 | 통과 | 불가 |
| `dxy` `gold` `spx_etf` `zq_front` `vvix` `skew` | 2016년 하반기 ~ | ~2,530 | 통과 | 턱걸이 |
| `vix` `ust10y` `baa_yield` `brent` `term_premium` | 1990 ~ | 9,000+ | 통과 | 통과 |

읽는 법: **명세 §2-10이 정한 6채널 중 `CREDIT`은 3년 분포 위에서만 백분위를 낼 수 있다.**
3년 안에 2020·2008 같은 구간이 없으므로 "역대 최악 백분위"가 실제 최악을 뜻하지 않는다.
`FUNDING`도 2018년 이후다. 명세 §C-5의 3단 백테스트 구분이 옳았음을 데이터가 확인해 준다 —
다만 **1단(2018~)조차 신용 채널은 2023년부터**다.

#### ⚠ 소급 수집으로는 풀 수 없다 — 2026-09-19 확인

처음에 「FRED는 1996년부터 주므로 소급하면 된다」고 적었다. **틀렸다.** 두 경로로 직접 확인했다.

```text
fredgraph.csv?id=BAMLH0A0HYM2&cosd=1990-01-01   → 795행, 2023-09-19 ~ 2026-09-17
ALFRED api realtime_start=1776-07-04            → count 795, 첫 realtime_start 2023-09-19
BAMLC0A0CM · BAMLC0A4CBBB · BAMLH0A0HYM2EY      → 전부 795행, 같은 시작일
```

**ICE BofA(`BAML*`) 계열은 FRED가 약 3년 롤링 창만 공개한다**(ICE 라이선스).
비교하면 라이선스가 없는 계열은 전부 깊다 — `BAA10Y` 10,621행(1986~) · `NFCI` 2,906행(1971~).

수집기는 정상이었다. 받을 것이 없었을 뿐이다.

**⚠ 그리고 우리 DB가 FRED보다 길다.** 우리 `hy_spread`는 2023-08-07부터고 FRED가 지금 주는 것은
2023-09-19부터다. 창이 굴러가는 동안 우리가 쌓아 온 6주다. **이 계열에 한해 우리 L2가 곧 아카이브이고,
한 번 지우면 어디서도 복구할 수 없다.** `REWRITE_BACK_DAYS`(60일) 바깥을 건드리는 작업을 이 계열에 하지 않는다.

#### 그래서 CREDIT 채널은 이렇게 세운다

깊이를 ICE 계열로 만들 수 없으므로, **라이선스가 없는 장기 계열로 골격을 세우고 ICE는 보조로 둔다.**

| 역할 | 계열 | 이력 | 상태 |
|---|---|---|---|
| 장기 골격 | `baa_spread` (Baa − 10년, 파생) | 1990~ · 9,200점 | **이미 있다** |
| 장기 골격 | `NFCICREDIT` (시카고 연준 금융여건 신용 하위지수, 주간) | 1971~ · 2,906점 | 신규 |
| 구조 확인 | `DRBLACBS` (기업대출 연체율, 분기) | 1987~ · 158점 | 신규 (그룹 B) |
| 보조(최근) | `hy_spread` `ig_spread` | 2023-08~ | 이미 있다 |
| 보조(최근) | `BAMLC0A4CBBB` (BBB OAS) | 2023-09~ | 신규 — 깊이는 못 준다 |

읽는 법: 명세 §2-3의 백분위는 **계열마다 자기 이력 위에서** 매겨진다. 3년짜리와 30년짜리를 한 기둥에
섞어도 각자의 분포 위에 서므로 계산은 성립한다. 다만 **3년짜리의 「99번째 백분위」는 3년 중 최악일 뿐**이고,
화면은 그것을 구분해 적어야 한다(`min_obs` 통과 여부와 별개로 **이력 길이를 지표 상세에 표시**한다).

---

## 3. 명세 §C-2 대조 — 세 그룹

### 그룹 A — 이미 있다 (수집 불필요)

| 명세가 요구한 것 | 포털 key | 비고 |
|---|---|---|
| HY OAS `BAMLH0A0HYM2` | `hy_spread` | ★ **명세가 "없다"고 적었으나 있다.** 단 `credit`이 아니라 `rates` 묶음에 있다 |
| IG OAS `BAMLC0A0CM` | `ig_spread` | ★ 같음. §C-2의 "추가 권장"은 이미 이행돼 있다 |
| MOVE 대용(10년물 20일 실현변동성 bp) | `ust10y_rvol` | ★ **명세가 제안한 대안이 그대로 구현돼 있다** (`realizedVolBp`, window 20) |
| 순유동성 | `netliq` (파생) | WALCL − TGA − RRP |
| 연준 총자산 · TGA · ON RRP · 지급준비금 | `fed_assets` `tga` `rrp` `reserves` | |
| FIMA 풀(해외 공적기관 역레포) | `rrp_foreign` (`WLRRAFOIAL`) | 국내분과 분리 완료 |
| SOFR · IORB · SOFR−IORB | `sofr` `iorb` `sofr_iorb` | |
| SOFR 99/1 백분위 · 분포 폭 · 20일 변동성 | `sofr99` `sofr1` `sofr_dispersion` `sofr_rvol` | |
| 국채 Bills/Coupon 비중 · 10년 입찰 응찰률·낙찰금리 | `tsy_bill_share` `tsy_coupon_share` `auction10y_btc` `auction10y_yield` | TREASURY Fiscal Data API |
| VIX · DGS10 · DFII10 · T10YIE | `vix` `ust10y` `real10` `bei10` | |
| 달러 인덱스 · 엔 · 위안 | `dxy` `usdjpy` `usdcny` | FX 채널 |
| 브렌트 · WTI · 금 · 구리 | `brent` `wti` `gold` `copper` | ⚠ `copper`는 **월간**이다(FRED `PCOPPUSDM`) |
| 생산성 `OPHNFB` · 기업이익 `CP` | `prod_yoy` `corp_profits_yoy` | 분기 → tide 전용 |
| AI CAPEX 가이던스 | 버블 모니터 L1 | `bubble/catalog.ts` L1에 ΣCAPEX(TTM) YoY 등 8개 |
| 은행 대출태도 · C&I 대출 · Baa 스프레드 | `sloos_ci` `ci_loans_yoy` `baa_spread` | |

**§C-1의 판단("새 파이프라인이 아니라 집계 계층")은 조사로 확인됐다.**
GCRM이 필요로 하는 지표의 대부분이 이미 매일 들어오고 있다.

### 그룹 B — FRED에서 추가하면 되는 것

| 지표 | 시리즈 ID | 주기 | 왜 필요한가 |
|---|---|---|---|
| BBB OAS | `BAMLC0A4CBBB` | 일간 | 명세 §2-10 `CREDIT` 채널 3번째 지표. 등급 경계의 스트레스 |
| 기업대출 연체율 | `DRBLACBS` | 분기 | 명세 §C-2의 default rate 대안. §2-11 TIDE 승격의 "구조·실물 확인" 지표 |
| 신용 여건 지수 | `NFCICREDIT` | 주간 | ★ CREDIT 채널의 **장기 골격**. 1971~ 2,906점. ICE 계열로는 깊이를 못 만든다 — §2-2 |
| 실효 연방기금금리 | `DFF` | 일간 | 이미 있다(`dff`) |

셋 다 FRED 무료·키 있음(기존 수집기 그대로). **BBB OAS와 연체율만 새 지표 2개**다.

### 그룹 C — 대안이 필요하거나, 지금은 못 한다

| 명세가 요구한 것 | 상태 | 판단 |
|---|---|---|
| MOVE 지수 | ICE 유료 | **해결됨** — `ust10y_rvol`로 대체 (그룹 A) |
| Cross-Currency Basis | 무료 시계열 없음 | `sofr_iorb` + `rrp_foreign` + `dxy` 조합으로 대리. 새 수집 없음 |
| Private credit stress (BDC) | Yahoo로 가능하나 미수집 | ARCC·BXSL·OBDC 추가는 쉽다. **NAV 할인율은 분기 수동 → 권하지 않는다**(아래 4-2) |
| COFER | IMF 분기, 지연 | tide 전용 + `staleness` 고정. ⚠ 발표 지연은 구현 시점에 IMF 일정으로 재확인(명세 부록도 확정하지 않았다) |
| Treasury buyback | 정식 API 아님 | 수동 입력 → **권하지 않는다**(4-2) |
| ROIC proxy | 직접 계산 | S&P500 합산 분기. 데이터 출처가 없다 — 보류 |
| Default rate | 유료 | `DRBLACBS`로 대체 (그룹 B) |

---

## 4. 수동 입력 지표 — 저장·표시 경로

### 4-1. 코드 경로

```text
화면   web/src/app/admin/macro/page.tsx:180        source === "MANUAL"이면 입력 폼을 띄운다
검증   web/src/features/macro/schema.ts:16         findIndicator(key)?.source === "MANUAL" 이 아니면 거부
저장   web/src/features/macro/repository.ts:341    recordObservations(key, "MANUAL", …, origin="MANUAL")   ← L1
       web/src/features/macro/repository.ts:342    upsertPoints(key, "MANUAL", …)                          ← L2
표시   web/src/features/macro/service.ts:130       manual: true 플래그를 화면으로 올린다
제외   web/src/features/macro/ingest.ts:333        자동 수집이 MANUAL을 건너뛴다
       web/src/features/macro/actions.ts:46        묶음별 수집도 MANUAL·DERIVED를 뺀다
AI보조 web/src/features/macro/extract-actions.ts:52  발표 자료에서 값을 뽑아 채우는 경로(MANUAL 전용)
```

L1(`MacroObservation`)과 L2(`MacroPoint`)에 **같은 트랜잭션에서 함께 쓴다.** 자동 수집과 같은 규율이다.

### 4-2. ⚠ 수동 입력 지표에는 값이 거의 없다 — GCRM을 여기 얹으면 안 된다

`web/src/lib/macro/types.ts`의 경고가 그대로 사실이다.

> ⚠ **MANUAL은 마지막 수단이다.** 손으로 넣기로 한 지표는 결국 안 들어간다 —
> 2026-09-05 확인 결과 수동 지표 일곱 개에 **값이 한 점도 없었다.**

현재 수동 지표 4개의 운영 D1 실측:

| key | 이름 | 점 수 | 최근 |
|---|---|---|---|
| `ism_mfg` | ISM 제조업 | **2** | 2026-08-01 |
| `ism_svc` | ISM 서비스업 | **2** | 2026-08-01 |
| `cci` | 소비자신뢰지수 | **2** | 2026-08-01 |
| `nahb` | NAHB 주택시장지수 | **3** | 2026-08-01 |

2~3점으로는 백분위도 z도 낼 수 없다(명세 `min_obs` 750, v1 엔진 최소 5년).
**GCRM 지표 정의에 수동 입력을 넣으면 그 자리는 영구 결측이 되고, 커버리지 게이트가 기둥을 통째로 `INSUFFICIENT`로 만든다.**

→ 판단: 명세 §C-2가 수동 입력으로 돌린 항목(Treasury buyback, BDC NAV 할인율)은
**`enabled: false` + 정의만 남김**으로 가고, 커버리지 분모에서 뺀다.

---

## 5. 다음 단계로 가기 전에 정해야 할 것

| # | 결정할 것 | 근거 |
|---|---|---|
| 1 | GCRM을 **엔진 v1.0의 확장**으로 지을 것인가, **별도 모듈**로 짓고 v1을 걷어낼 것인가 | §0-3 |
| 2 | 정규화를 **백분위(명세)** 로 갈 것인가 **robust z(v1 운영 중)** 로 갈 것인가 — 한 사이트에 둘을 두면 같은 이름의 점수가 두 값을 갖는다 | §0-3 |
| 3 | 설정을 **YAML(명세)** 로 둘 것인가 **TS 데이터 파일(v1 · Worker 제약)** 로 둘 것인가 | §0-2 |
| 4 | `config_hash` vs 기존 `MODEL_VERSION` + `basis(LIVE/RECOMPUTED)` — 재현성 장치를 합칠 것인가 | §1-3 |
| 5 | ~~HY/IG OAS 소급 수집~~ → **불가 확인(2026-09-19).** 대신 `NFCICREDIT`·`DRBLACBS` 추가로 CREDIT 깊이를 세울 것인가 | §2-2 |

작업 순서상 5번은 앞의 넷과 무관하게 먼저 해도 손해가 없다.

> 2026-09-19 갱신 — 5번의 원래 안(HY/IG OAS 1996년 소급)은 **FRED 원문 확인으로 불가 판정**했다.
> 가설과 그 폐기 과정은 `web/CHANGELOG.md`에 남겼다.

---

## 부록 — 조사 방법

```bash
# 지표 정의 (레지스트리를 직접 실행해 덤프)
node --import tsx  →  MACRO_INDICATORS (107개)

# 운영 데이터 (로컬 사본 아님)
npx wrangler d1 execute woodsman-db --remote --json --command "…"
#   MacroPoint       계열별 행수·최초·최근
#   MacroObservation origin별 집계 · ALFRED 계열 목록
#   ScoreValue       scoreKey × modelVersion × basis
```

⚠ 로컬 `.wrangler` D1 사본은 38계열 × 400점(최근 2026-06~08)뿐이다. **운영과 다르다.** 조사에 쓰지 않았다.
