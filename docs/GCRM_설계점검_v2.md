---
title: Global Capital Regime Monitor — 설계 점검과 재설계 (v2)
created: 2026-09-19
target: Woodsman Portal (portfolio-solutions.net)
status: 점검 완료 / 재설계 초안
tags: [woodsman, macro, regime, 설계]
---

# Global Capital Regime Monitor — 설계 점검과 재설계

> 대상: ChatGPT에 의뢰해 받은 「Current · Wind · Wave 기반 글로벌 자본 Regime 탐지 시스템」 설계 프롬프트
> 목적: Woodsman Portal 구현 전 결함 제거 + CLI 개발에 바로 넣을 수 있는 명세로 재작성

---

## 0. 한 줄 결론

**틀의 방향은 옳다. 그러나 이 문서를 그대로 CLI에 넣으면 구현이 막히거나, 더 나쁘게는 조용히 틀린 숫자를 만든다.**

핵심 문제 세 가지만 먼저 적는다.

1. **좋은 점수와 나쁜 점수를 그냥 더하고 있다.** 유동성 51(높을수록 좋음)과 시장위험 72(높을수록 나쁨)를 같은 산식에 넣으면 나오는 숫자에 의미가 없다. → §B-1
2. **Alignment 수식이 겉보기와 다른 일을 한다.** `(|C−W|+|W−D|+|C−D|)/3`는 대수적으로 `2×(최대−최소)/3`과 **완전히 동일하다.** 세 값 중 가운데 값은 계산에 아무 영향을 주지 않는다. 세 시간축을 비교한다고 써 놓고 실제로는 두 개만 본다. → §B-3
3. **문서의 수치 예시가 문서의 수식에서 나오지 않는다.** §15과 §21 모두 Alignment 34를 적었지만, 각자의 산식으로 계산하면 45.3과 56이다. 이 예시를 테스트 기대값으로 쓰면 안 된다. → §B-4

그리고 현실적으로 가장 중요한 발견:

4. **§19 Global Liquidity가 요구하는 지표는 포털에 이미 전부 구현돼 있다.** `/macro/liquidity`에 순유동성, 연준 총자산, TGA, ON RRP, 지급준비금, FIMA 풀(해외 공적기관 역레포 — 이미 국내분과 분리됨), SOFR, IORB, SOFR−IORB, 국채 만기 구성(Bills/Notes·Bonds 비중), 10년물 입찰 응찰률·낙찰금리, SOFR 백분위·분포폭·변동성이 모두 있다. **GCRM은 새 데이터 파이프라인이 아니라 기존 지표 테이블 위의 집계 계층(aggregation layer)으로 지어야 한다.** → §C-1

---

# Part 1. 점검

## A. 명명과 개념 층위

### A-1. `Current`는 이 포털에서 쓸 수 없는 이름이다 ★필수 수정

영어 current는 "조류"와 "현재" 두 뜻을 모두 갖는다. 문서 §21의 히어로 화면에 이 충돌이 그대로 나온다.

```text
CURRENT REGIME          ← 현재 레짐
R3 — Monetary Re-Tightening

CURRENT   WIND   WAVE   ← 조류 점수
72 ↑      58 ↓   39 ↓
```

같은 화면에서 같은 단어가 다른 뜻으로 두 번 쓰인다. 코드에서도 `current.current`, `current_regime` vs `current_score` 같은 식별자가 나온다.

더 결정적인 이유가 있다. **포털은 이미 조류를 tide로 부르고 있다.** 홈 H1이 그대로 이렇다.

> 파도(wave)가 아니라 바람(wind)과 조류(tide)를 봅니다

메모리에 기록된 우생마사(牛生馬死) 3층 구조 — 철학 / Tide(구조적 수요 흐름) / Wave(전술적 실행) — 와도 tide가 일치한다. 새 명세가 current를 쓰면 한 사이트 안에 어휘가 두 벌 생긴다.

**→ TIDE / WIND / WAVE로 통일한다.** 식별자는 `tide`, `wind`, `wave`. "현재 레짐"은 `active_regime`.

### A-2. 은유를 인과로 착각하고 있다

실제 바다에서 파도는 국지적 바람이 만들고, 조류는 달과 지형이 만든다. **파도가 커진다고 조류가 바뀌지 않는다.** 그런데 §8은 Wave → Wind → Current 승격 사슬을 인과처럼 서술한다.

이 시스템에서 셋의 관계는 인과가 아니라 **같은 현상을 서로 다른 시간 창(window)으로 본 것**이다. 같은 HY OAS를 5일 창으로 보면 wave, 13주 창으로 보면 wind, 12개월 창으로 보면 tide다. 승격이란 "짧은 창의 변화가 긴 창에서도 보이기 시작했다"는 관찰이지, 파도가 조류를 밀어낸 게 아니다.

이 구분이 중요한 이유: 인과로 믿으면 "wave가 wind를 유발했는가"를 검증하려 들게 되고, 그건 검증 불가능한 명제다. 시간 창 분해로 보면 "짧은 창의 부호가 긴 창에서도 같아졌는가"라는 **계산 가능한 질문**이 된다.

→ 문서 서술을 바꾼다. `§8 제목: 시간 창 전파(horizon propagation)`.

---

## B. 수학적 결함

### B-1. 점수의 부호 방향이 통일되지 않았다 ★가장 심각

§21이 보여주는 화면이다.

```text
Global Liquidity        51   ← 높을수록 유동성 풍부 = 좋음
Market Risk             72   ← 높을수록 위험 = 나쁨
Risk Transmission       76   ← 높을수록 위험 전이 = 나쁨
Rate Absorption         62   ← 높을수록 감당 가능 = 좋음
```

§2의 `Overall Capital Regime Score = 0.50×Current + 0.35×Wind + 0.15×Wave`에서 Current/Wind/Wave는 결국 이 하위 점수들의 집계다. **부호가 섞인 값을 가중평균하면 나오는 숫자는 해석이 불가능하다.** 유동성이 10 오른 것과 시장위험이 10 오른 것이 총점에 같은 방향으로 기여한다.

**→ 모든 기둥 점수에 `polarity`를 명시하고, 집계 시 위험 방향 점수는 `100 − score`로 변환한 뒤 더한다.**

| 기둥(pillar) | polarity | 집계 시 |
|---|---|---|
| 유동성 Liquidity | favorable | 그대로 |
| 금리 감내력 Rate Absorption | favorable | 그대로 |
| 엔진 출력 Engine Power | favorable | 그대로 |
| 달러 네트워크 지배력 Dollar Network Power | favorable | 그대로 |
| 시장위험·지정학 Market & Geopolitical Stress | stress | 100 − s |
| 위험 전이 Risk Transmission | stress | 100 − s |
| 엔진 온도 Engine Heat | stress | 100 − s |
| 재정 우위 압력 Fiscal Dominance Pressure | stress | 100 − s |
| 통화 규율 압력 Monetary Discipline Pressure | stress | 100 − s |
| 통화 가치 희석 기대 Debasement Expectation | stress | 100 − s |

화면에는 원래 방향(raw)을 보여주고, 총점에는 변환값(oriented)을 쓴다. DB에 둘 다 저장한다.

### B-2. 계층 구조가 두 가지로 읽힌다 ★설계 분기점

§4 가중치 행렬은 다음 두 해석 중 어느 쪽인지 정하지 않았다.

- **(a)** 모든 하위 점수를 tide/wind/wave 세 버전으로 각각 계산한 뒤, 상위에서 시간축별로 묶는다
- **(b)** 하위 점수를 한 번만 계산하고, 상위는 하위 점수들의 가중평균이다

(b)라면 §13의 "세 시간축 정렬"이 성립할 수 없고(하위 점수가 이미 스칼라라 시간축이 없다), §4에서 기둥마다 다른 55/35/10, 30/40/30을 줄 이유도 없다. **반드시 (a)여야 한다.**

그러면 §4 표의 정체가 바뀐다. 그것은 "총점 산식"이 아니라 **하위 점수를 화면에 스칼라 하나로 요약할 때 쓰는 요약 가중치**다. 이 구분을 명시하지 않으면 구현자가 반드시 틀린다.

```text
지표(indicator)
  └ 시간축별 점수 3개  (tide / wind / wave)
      └ 기둥(pillar) 점수 3개  (기둥별 시간축 3개)
          ├ 기둥 요약 스칼라   ← §4 표의 가중치를 쓰는 곳
          └ 레짐 시간축 점수 3개  ← §2·§3 가중치를 쓰는 곳
              └ Overall / RTE
```

### B-3. Dispersion 수식은 가운데 값을 버린다 ★필수 수정

```text
Dispersion = (|C-W| + |W-D| + |C-D|) / 3
```

세 값의 쌍별 절대차 합은 항상 `2 × (최대 − 최소)`다. 따라서

```text
Dispersion = 2 × (max − min) / 3
```

**가운데 값은 계산에 전혀 들어가지 않는다.** 72/58/39와 72/70/39는 dispersion이 동일하다. 세 시간축의 일치도를 본다고 해놓고 실제로는 최대·최소 두 개만 본다.

부수 문제: 최대값이 66.67로 고정된다(0-100 범위에서). `Proximity = 100 − min(100, 2×Dispersion)`은 2×66.67 = 133을 100으로 자르는데, **실제로는 dispersion이 50을 넘으면 proximity가 전부 0으로 뭉개진다.** 0-100 구간 중 절반이 쓰이지 않고 나머지는 왜곡된다.

또 하나: `D`가 정의되지 않은 기호다. Wave여야 하는데 Daily의 D를 썼다. 세 항 중 두 항이 미정의 변수를 쓴다.

### B-4. 문서의 예시 숫자가 문서의 수식과 맞지 않는다

원 문서 산식으로 직접 계산한 결과다.

| 출처 | Tide / Wind / Wave | Dispersion | 산식상 Proximity | 문서 표기 |
|---|---|---|---|---|
| §21 히어로 | 72 / 58 / 39 | (14+19+33)/3 = 22.00 | 100 − 44 = **56** | Alignment **34** |
| §15 예시 | 72 / 48 / 31 | (24+17+41)/3 = 27.33 | 100 − 54.67 = **45.3** | Alignment **34** |

두 예시 모두 불일치하고, 서로 다른 입력인데 같은 34가 적혀 있다. **숫자를 손으로 적은 것**이다.

의미: 이 문서의 수치 예시는 골든 테스트(golden test) 기대값으로 쓸 수 없다. 재설계에서 **검산이 끝난 예시를 새로 제공한다**(§E-3).

### B-5. Alignment 점수와 Alignment 상태의 관계가 정의되지 않았다

§14는 34 → `DIVERGENT`(25–44 구간)라고 한다. 그런데 §15는 같은 34에 `State = TRANSITION`이라고 적었다. 점수 구간이 상태를 결정하는지, 방향성 규칙이 덮어쓰는지가 없다. §13이 "Transition을 우선한다"고 하지만 우선순위가 규칙이 아니라 문장으로만 있다.

→ **연속 점수와 범주 상태를 분리하고, 상태는 명시적 결정 트리로 정한다.**

### B-6. Recency와 Freshness가 이중으로 곱해진다

```text
Effective Weight = Base Weight × Recency Weight × Freshness Weight × Evidence Weight
```

그런데 Recency Weight(35/30/20/15 등)는 이미 §1–3에서 M1·M3·M6·M12를 합성하는 데 쓰였다. 합성이 끝난 값에 같은 recency를 또 곱하면 이중 적용이다. 두 recency가 같은 것인지 다른 것인지 문서에 없다.

추가로 **Recency와 Freshness는 이름이 너무 비슷하다.** 전자는 관측 창의 최신성, 후자는 발표 지연 감쇠인데, 구현자는 반드시 헷갈린다.

→ 세 층으로 분리하고 이름을 바꾼다.

```text
horizon_weight     지표를 시간축 안에서 합성할 때만 (M1/M3/M6/M12, W1/W4/W13, D1/D3/D5)
base_weight        기둥 안에서 지표 간 상대 중요도
quality_factor     staleness_factor × evidence_factor   ← 여기에 recency는 들어가지 않는다
```

### B-7. 정규화(normalization)가 통째로 빠져 있다 ★가장 큰 공백

모든 점수가 0–100이라고 전제하지만, **원시 관측값을 0–100으로 바꾸는 규칙이 문서 어디에도 없다.** §22 설명 체인에 "Normalization"이라는 단어가 한 번 나올 뿐이다.

HY OAS 3.4%는 몇 점인가? SOFR−IORB +2bp는? WALCL 6.9조 달러는? 이것이 이 시스템에서 가장 어렵고 가장 논쟁적인 부분인데 명세가 없다. 정규화 방식을 바꾸면 모든 점수, 모든 레짐 판정, 모든 백테스트 결과가 바뀐다.

→ 재설계 §2-3에 전체 규격을 넣었다.

### B-8. 커버리지가 낮아도 점수가 나온다

`Score = Σ(Indicator × EW) / Σ(EW)`에서 결측을 분모에서 빼면 남은 지표로 가중치가 자동 재분배된다. 이 방식 자체는 옳고, **포털 버블 모니터가 이미 쓰는 방식**이다("결측은 분모에서 뺍니다"). 문제는 최소 커버리지 임계가 없다는 것이다. 12개 지표 중 3개만 있어도 점수가 나온다.

→ 기둥 60%, 총점 70% 미만이면 점수 대신 `INSUFFICIENT`. 레짐 전이는 차단하고 직전 상태를 유지한다.

### B-9. "3개의 독립 시장"에서 독립성이 정의되지 않았다 ★

§9의 예시가 정확히 이 문제를 드러낸다.

```text
SOX ↓        주식
Real Yield ↑ 금리
VIX ↑        주식 변동성
HY OAS ↑     신용
```

**위험회피 국면에서 이 넷은 상관계수 0.7~0.9로 함께 움직인다.** SOX와 VIX는 사실상 같은 것을 두 번 센 것이다. "3개 시장 확인"이 실제로는 "하나의 요인을 네 번 셈"이 되기 쉽고, 이것이 이런 대시보드의 전형적인 실패 모드다 — 확신은 커지는데 정보는 늘지 않는다.

§9이 "Price + Credit + Funding 확인을 더 강하게 평가한다"고 이미 감지하고 있지만, 권고로만 있고 규칙이 아니다.

→ **채널(channel)을 명시적으로 정의하고, 서로 다른 채널에서 3개를 요구한다. 같은 채널 안의 복수 지표는 1표로 센다.**

### B-10. 원칙과 산식이 충돌한다 — Wave가 뒷문으로 레짐을 바꾼다

§8·§26: "Daily Wave가 Current나 Regime을 직접 변경하는 경로를 코드 수준에서 금지한다."
§18: Risk Transmission Score는 Wave 비중이 **35%**이고, `RTS ≥ 70`이 지속되면 `REGIME_CHANGING = TRUE`.

즉 wave가 RTS를 통해 간접적으로 레짐을 움직인다. 원칙이 산식에 의해 무력화된다.

→ 레짐 전이 판정에는 **wave 성분을 제거한 `RTS_slow`(tide/wind만 재정규화)** 를 쓴다. wave는 경보(alert)만 띄운다.

### B-11. Confidence가 `f(...)`로만 적혀 있다

§5는 `Confidence = f(Coverage, Freshness, Evidence Strength, Cross-Market Confirmation)`이라고 쓰고, 예시에는 91%라는 구체 숫자를 적었다. 함수가 없다. → 재설계 §2-7에서 정의.

### B-12. 방향(↑↓)의 정의가 없다

히어로에 `72 ↑`가 나오는데 **무엇 대비 상승인지가 없다.** 전일? 전주? 20일 이동평균? 시간축마다 기준이 달라야 하고, 부호가 깜빡이는 것(flicker)을 막을 불감대(deadband)도 필요하다.

### B-13. 레짐 정의가 하나뿐이다

§16은 R5만 예시로 정의했는데 히어로에는 R3가 나온다. **R1·R2·R3·R4·R6이 정의되지 않았고, 어느 레짐에도 해당하지 않을 때의 기본 상태도 없다.** 추가로 빠진 것:

- 최소 체류 기간(dwell time) — 없으면 하루 만에 들어갔다 나온다
- 복수 레짐 진입 조건이 동시에 충족될 때의 우선순위
- 레짐 간 전이 가능 그래프(R2에서 R6으로 바로 갈 수 있는가)

### B-14. 급성 경보와 승격 경로의 관계가 미정의

§12의 `ACUTE_REGIME_TRANSITION_WATCH`와 §9의 `WIND_CONFIRMATION` 승격이 독립인지 배타인지, 둘 다 켜질 수 있는지 없다.

### B-15. 민감도 분석의 판정 기준이 없다

§25는 "결과가 크게 달라지면 `MODEL_FRAGILITY_WARNING`"이라고 하는데 "크게"의 정의가 없다. 또 시간축 가중치는 합이 1이므로 하나를 +5pp 하면 **나머지 둘을 어떻게 재배분할지** 규칙이 필요하다(비례 축소인가, 균등 차감인가 — 결과가 달라진다).

---

## C. 데이터와 운영 현실

### C-1. 이미 있는 것을 다시 만들라고 지시한다 ★실용상 가장 중요

포털 `/macro/liquidity`에 이미 구현된 지표들이다.

> 순유동성(Net Liquidity, `WALCL − WDTGAL − RRPONTSYD`), 연준 총자산, 재무부 일반계정(TGA), 역레포 잔액(ON RRP), M2 통화량 전년비, 은행 지급준비금, **해외 공적기관 역레포(FIMA 풀)**, SOFR, IORB, SOFR−IORB, 시장성 국채 중 단기물(Bills) 비중, 이표채(Notes·Bonds) 비중, 10년 국채 입찰 응찰률, 낙찰금리, SOFR 99번째·1번째 백분위, 분포 폭, 20일 실현변동성

§19가 요구한 목록과 거의 완전히 겹친다. **"Foreign Official RRP와 Domestic ON RRP를 분리한다"는 §19의 지시는 이미 이행돼 있다.**

다른 기둥도 마찬가지다. `/macro/rates`(44개 원계열, 인하 압력 지수, 실질 정책금리, 두 속도 경제), `/macro/credit`(C&I 대출, 은행 대출태도, Baa 스프레드), `/macro/bubble`(5층 30지표, CAPEX·밸류에이션·실물수급·신용유동성·센티먼트)이 이미 있다.

**→ GCRM의 실제 작업은 데이터 수집이 아니라, 기존 `observation` 테이블 위에 정규화·시간축 합성·기둥 집계·레짐 판정을 얹는 계산 계층을 만드는 것이다.** 이렇게 보면 작업량이 절반 이하로 줄고, 무엇보다 **한 사이트 안에서 같은 지표가 두 값을 갖는 사고**를 막는다.

### C-2. 확보 불가능하거나 유료인 지표 — 대안 필요

| 원 문서 지표 | 상태 | 대안 |
|---|---|---|
| MOVE 지수 | ICE 라이선스. FRED에 없음 (ICE Developer Portal 유료) | 10년물 금리(DGS10) 일간 변화의 20일 실현변동성(bp). 포털이 SOFR에 이미 쓰는 방식과 동일 |
| Cross-Currency Basis | 무료 공개 시계열 없음 | SOFR−IORB + FIMA 풀 사용량 + 달러 인덱스 조합으로 달러 조달 압력 대리 |
| Private credit stress | 공개 시계열 없음 | BDC 주가(ARCC·BXSL·OBDC) 대비 S&P500 상대강도(일간, Yahoo) + BDC 순자산가치(NAV) 할인율(분기, 수동) |
| Default rate | Moody's·S&P 유료 | FRED `DRBLACBS`(은행 기업대출 연체율, 분기) |
| COFER | IMF 분기, **약 한 분기 지연** | tide에만 투입. staleness 0.5~0.7 고정. ※ 실제 발표 지연은 구현 시점에 IMF 일정으로 재확인할 것 |
| Treasury buyback | 재무부 발표, 정식 API 아님 | 수동 입력(포털이 이미 쓰는 방식). 카드에 "수동 입력" 표시 |
| ROIC proxy | 직접 계산 필요 | S&P500 합산 기준, 분기 |
| AI CAPEX Guidance | 수동 | **버블 모니터 L1이 이미 보유** — 재사용 |
| Productivity | FRED `OPHNFB` 분기 | 그대로 |
| Corporate Profit | FRED `CP` 분기 | 그대로 |

**FRED에서 무료·일간으로 바로 되는 것** (확인 완료):

- `BAMLH0A0HYM2` — ICE BofA US High Yield Index Option-Adjusted Spread, 일간, % *(FRED 페이지에서 직접 확인)*
- `BAMLC0A0CM` — ICE BofA US Corporate Index OAS (투자등급), 일간
- `BAMLC0A4CBBB` — BBB 등급 OAS, 일간
- `VIXCLS`, `DGS10`, `DFII10`, `T10YIE`, `SOFR`, `IORB`, `WALCL`, `WDTGAL`, `RRPONTSYD`, `WRESBAL`

> 포털 `/macro/credit`에는 현재 Baa 스프레드만 있고 HY/IG OAS가 없다. **추가 권장** — 위험 전이 기둥의 신용 채널이 사실상 이 둘에 달려 있다.

### C-3. "오늘의 파도"는 실제로 어제 데이터다

FRED 일간 시리즈는 대부분 T+1 발표다. WAVE의 D1이 "오늘"을 의미하지 않는다. 화면이 "오늘의 파도"라고 쓰면 사실과 다르다.

→ 모든 카드에 **관측일(obs_date)과 계산 기준일(as_of)을 분리 표기**한다. 포털이 이미 "2026-09-16 기준"처럼 하고 있으므로 관행을 그대로 따른다.

### C-4. Evidence Weight 6단계는 과잉설계다

포털의 데이터는 실질적으로 FRED(공식, 1.00), Yahoo Finance(시장, 0.95), 운영자 수동 입력(원 발표 자료 확인, 0.90) 세 가지다. 0.65 구간은 뉴스 기반 지정학 판단에만 쓰인다. 6단계를 만들어도 실제로는 4개 값만 나타난다.

→ 4단계로 축소: `official 1.00 / market 0.95 / manual 0.90 / judgment 0.70`. `EXCLUDE`는 값이 아니라 결측 처리로.

### C-5. §24 백테스트는 제시된 범위로는 불가능하다 ★

**2000년 닷컴, 2008년 GFC를 이 모델로 백테스트할 수 없다.** 당시 존재하지 않던 지표가 모델의 뼈대이기 때문이다.

- SOFR — 2018년 시작
- IORB — 2021년 명칭 변경(IOER는 2008년 10월부터)
- ON RRP — 2013년 시작
- FIMA 풀 상설화 — 2021년
- AI CAPEX — 개념 자체가 없음

또 point-in-time 정합성을 지키려면 **당시 발표값(vintage)** 이 필요한데, ALFRED가 일부만 제공한다. 발표 후 수정된 값으로 백테스트하면 모델이 실제보다 똑똑해 보인다(look-ahead bias).

→ 현실적 3단 범위로 재정의.

| 구간 | 방식 | 지표셋 |
|---|---|---|
| 2018–현재 | 완전 재현, vintage 적용 | 전체 |
| 2010–2017 | 부분 재현, 커버리지 표시 | ON RRP·IOER 포함 축소셋 |
| 2000–2009 | 서술적 검증만(레짐 라벨을 사람이 붙이고 대조) | 금리·신용·주식 최소셋 |

검증 대상 사건도 조정: 2000 닷컴·2008 GFC는 3단계, 2011 유럽 재정위기·2013 테이퍼 텐트럼은 2단계, 2018 긴축·2020 코로나·2022 인플레이션·2023 지역은행·최근 AI CAPEX 사이클은 1단계.

### C-6. 버전 필드 5종은 SQLite 1인 운영에 과하다

`model_version / weight_version / indicator_version / normalization_version / regime_rule_version` 중 indicator와 normalization은 설정 파일 안에 있다. **설정 파일을 git에 두고 그 해시를 저장하면** 3종으로 충분하다.

→ `model_version`, `config_hash`(SHA-256, 12자), `git_sha`. 규칙 변경 이력은 git log가 보관한다.

---

## D. UI — 포털 어법 대비

### 포털의 기존 어법(관측된 것)

| 항목 | 값 |
|---|---|
| 색상 토큰 | `--w-bg #131c17` (딥 포레스트) · `--w-surface #1a251f` · `--w-surface-2 #223029` · `--w-border #2e3f35` · `--w-ink #e3ebe5` · `--w-ink-2 #a8b6ac` · `--w-ink-3 #778579` |
| 시리즈 색 | `--w-series-1 #4aa87a` (녹) · `--w-series-2 #a8622f` (적갈) · `--w-series-3 #6b8fd4` (청) · `--w-accent-text #d08045` · `--w-danger #da7770` |
| 등락 색 | `--w-up #e05a52` (빨강=상승) · `--w-down #5a8fd6` (파랑=하락) — 한국 주식 관행 |
| 제목 패턴 | 영문 대문자 태그 + 이모지 + 한글 제목 (`BUBBLE MONITOR` / `🫧 AI·반도체 버블 모니터`) |
| 설명 패턴 | **이게 뭔가요 → 어떻게 보나 → 어떻게 판단하나 → 계산식과 가정 보기 →** 4단 |
| 점수 표기 | 항상 `기준일 + 커버리지 + 가장 오래된 입력일` 동반 |
| 용어 링크 | `/macro/glossary#anchor` |
| 정밀도 철학 | 버블 모니터는 **의도적으로 0·1·2 세 칸만** 사용 |

### D-1. 정밀도 철학이 정면으로 충돌한다 ★

버블 모니터가 화면에 직접 써 놓은 문장이다.

> 0·1·2 세 칸으로만 채점합니다. 지표 절반이 숫자가 아니라 판단이라, 소수점을 붙이면 없는 정밀도가 생깁니다.

그런데 GCRM은 같은 사이트에서 `Risk Transmission 78 / Confidence 91% / Coverage 94% / Freshness 96%`를 표시한다. **한 사이트 안에 정밀도 철학이 두 개 있으면, 읽는 사람은 둘 다 믿지 않게 된다.**

→ 세 가지를 지킨다.

1. **표시는 5점 단위 반올림** (78 → 80, 또는 밴드로 `75–80`). 내부 저장은 소수 2자리.
2. Confidence·Coverage는 퍼센트 숫자 대신 **4단 밴드**로 표시 — `높음 / 보통 / 낮음 / 참고용`. 포털 홈 카드가 이미 "낮은 신뢰" 칩을 쓰고 있다.
3. 점수 옆에 항상 "이 숫자는 예측이 아니라 기록"이라는 버블 모니터의 고지를 같은 문투로 붙인다.

### D-2. 히어로를 새로 만들면 기존 H1과 충돌한다

홈 H1은 이미 `파도(wave)가 아니라 바람(wind)과 조류(tide)를 봅니다`이고, 그 아래 **`지금 부는 바람` 섹션 최상단에 `GLOBAL CAPITAL REGIME` 카드가 이미 있다.** §21이 요구하는 전체 화면 히어로를 새로 만들면 같은 화면에 히어로가 두 개가 된다.

→ **기존 카드를 확장한다.** 전용 히어로는 신설 상세 페이지 `/macro/regime`에만 둔다.

### D-3. 레짐 코드를 영어로 노출하면 안 된다

`R3 — Monetary Re-Tightening + Geopolitical Inflation Shock`는 포털의 한글 우선 원칙과 어긋난다. 포털은 언제나 **한 문장 요약 → 숫자 → 근거** 순서다.

→ `R3 · 통화 재긴축 + 지정학 물가 충격` 형태로, 영문은 툴팁·용어사전에만.

### D-4. 등락 색을 레짐 점수에 그대로 쓰면 오독된다 ★

포털은 상승=빨강, 하락=파랑(주식 관행)이다. 그런데 레짐 점수에서는 **"위험 전이 점수 상승"이 빨강이면 맞지만, "유동성 점수 상승"이 빨강이면 정반대로 읽힌다.**

→ 레짐 카드에서는 등락 색(`--w-up`/`--w-down`)을 쓰지 않는다. 대신 **우호/스트레스 색**을 쓴다.

```text
자본에 우호적 방향  →  --w-series-1  #4aa87a (녹)
중립               →  --w-ink-3     #778579
스트레스 방향       →  --w-danger    #da7770
```

화살표(↑↓)는 방향만 나타내고 색은 우호/스트레스가 결정한다. 예: 유동성 48↓는 붉은색 화살표(스트레스 방향), 시장위험 43↓는 녹색 화살표(우호 방향).

### D-5. §22의 9단계 설명 체인은 화면으로 만들 수 없다

```text
Overall → Current/Wind/Wave → Sub-score → Indicator → Raw Observation
→ Normalization → Effective Weight → Contribution → Source
```

9단 드릴다운은 클릭 8번이고, 포털의 기존 패턴(카드 → "계산식과 가정 보기 →")과 맞지 않는다.

→ **3단으로 접는다.**

1. 카드 — 점수 + 방향 + 신뢰도 밴드 + 한 문장
2. 계산식과 가정 — 산식, 가중치, 커버리지, 기여도 상위 5개 지표(막대)
3. 지표 상세 — 원시값, 정규화 결과, 출처 링크, 기준일

### D-6. 누락된 운영 항목

- 시간대·영업일 달력 정의 (KST 표시 / 미 동부 기준 영업일 / 미국 휴장일)
- 결측 · 미발표 · 값이 0 세 가지의 구분
- 지표 수정 발표(revision) 처리
- 점수 이력 저장 방식 (매일 스냅샷인가, as-of 재계산인가)
- 운영자 수동 개입(override) 경로와 그 표시 — 포털은 수동 입력 지표가 많다

---

# Part 2. 재설계 (GCRM v2)

## 2-0. 구현 결정 (2026-09-19 · P0 완료 시점에 추가)

명세를 쓸 때 몰랐던 사실이 조사(`docs/GCRM_자산조사.md`)에서 나왔다. **명세와 실제가 어긋나면
틀린 전제에서 출발하게 되므로**, 바뀐 것을 여기 적고 아래 절에도 ⚠로 표시했다.

| 명세가 쓴 것 | 실제로 한 것 | 왜 |
|---|---|---|
| 파이썬 `pms` CLI · SQLite | **TypeScript · `web/src/lib/gcrm/`** · Cloudflare D1 | 포털이 Next.js + Workers다. `pms`는 `rates_*` 다섯 표만 가진 별개 실험이라, 그쪽에 얹으면 같은 지표가 두 값을 갖는다 |
| `indicator` / `observation` 테이블 | `MacroPoint`(L2) · `MacroObservation`(L1 vintage) | 그런 이름의 테이블이 없다 |
| `config/gcrm/*.yaml` 6개 | `src/lib/gcrm/config/*.ts` 6개 | ⚠ Worker는 실행 중에 파일을 읽지 못한다. **뜻은 그대로** — 숫자는 한 곳에만 있고 계산 코드는 숫자를 모른다 |
| `config_hash` = 파일 6개의 해시 | **설정 객체 6벌**을 키 정렬 JSON으로 직렬화한 해시 | 주석·포맷을 고쳐도 지문이 안 바뀌고 **값이 바뀔 때만** 바뀐다. 재현성의 목적에 더 맞다 |
| `gcrm_run` 등 snake_case | `GcrmRun` 등 **PascalCase** | 같은 DB의 `MacroPoint`·`ScoreValue`와 관례를 맞춘다 |
| `as_of DATE` | `asOf TEXT "YYYY-MM-DD"` | D1에 DATE 타입이 없다(`ScoreValue.asOf`가 이미 같은 관례) |

### ⚠ 선행 구현이 있었다 — 자본 레짐 엔진 v1.0

명세는 GCRM을 신규 구축으로 썼지만, `web/src/lib/scores/`에 **점수 키 29개짜리 엔진이 이미 운영 중**이고
그중 10개가 매일 발행된다(홈 `GLOBAL CAPITAL REGIME` 카드가 6개를 띄운다).
기둥 10개 중 4개가 v1에 그대로 있다.

사용자 결정(2026-09-19):
- GCRM은 **`src/lib/gcrm/`에 새로 짓고 v1은 남겨 둔다.** 숫자가 검증될 때까지 홈은 v1이 지킨다
- 정규화는 **백분위**로 간다(v1은 robust z). 한 사이트에 두 축을 두지 않는다
- 기둥 구성은 **v1 `scores/config.ts`의 구성요소와 가중치를 출발점으로** 삼아 지표에 매핑했다.
  그래서 `pillars.ts`는 평탄한 목록이 아니라 트리다 — 숫자의 출처가 보이지 않으면 고칠 수 없다

### 운영 원칙 — 시간 창은 서로 이어져 있다 (운영자, 2026-09-19)

> 주간 단위의 힘이 한 달로 가고, 월별 힘이 그해의 주도적인 에너지로 변한다.

이 문장이 이 모델의 전제를 가장 짧게 적은 것이다(§A-2 시간 창 전파).
세 축은 **서로 다른 예측이 아니라 같은 현상을 다른 길이의 창으로 본 것**이므로,
기둥마다 「빠른 증거」가 있으면 파도·바람에서도 그 기둥을 볼 수 있어야 한다.
기둥이 조류에만 존재한다면 그것은 자연의 사실이 아니라 **우리가 빠른 계열을 안 붙인 것**일 수 있다.

따라서 축 커버리지가 모자랄 때 **가장 먼저 의심할 것은 게이트가 아니라 기둥의 지표 구성**이다.
게이트를 낮춰 숫자를 내는 것은 마지막 수단이다 — 숫자를 내려고 기준을 고치면 기준이 아니다.

### ⚠ 모델의 숫자에는 등급이 있다 (2026-09-19)

임계·가중치를 정할 때 **객관적 논거·연구사례·유수기관 관리체계**를 근거로 삼는다(운영자 지시).
근거가 없으면 「없다」고 적고 검증 대상으로 남긴다.

**원본은 코드에 있다** — `web/src/lib/gcrm/config/provenance.ts`(등급 A~D · 근거 · 영향 · 검증 계획).
각 항목이 지금 값의 사본을 들고 있고 **테스트가 설정과 대조**하므로, 값을 고치면 근거도 다시 적게 된다.
읽기용 요약은 `docs/GCRM_근거점검.md`, 보는 방법은 `npm run gcrm -- provenance --ungrounded`.

⚠ **기준이 명확하지 않으면 균등으로 둔다**(운영자 결정 2026-09-19). 기둥 간 가중치가 그 예다 —
근거 없는 차등보다 근거 없는 균등이 정직하다. 차등을 되살리려면 근거를 먼저 만든다.

⚠ 현재 **근거 없이 내가 정한 값이 일곱 개**이고, 그중 **기둥 간 가중치(`axisWeight`)**는
모든 축 점수에 곱해지므로 영향이 가장 크다. **민감도 분석(P9) 전에는 화면에 숫자를 내지 않는다.**

### ⚠ 데이터가 정한 한계 (조사 §2-2)

- **ICE BofA 계열(HY·IG·BBB OAS)은 FRED가 약 3년 창만 준다.** 소급 수집이 불가능하다.
  CREDIT 채널의 장기 골격은 `baa_spread`(1990~)가 맡고, ICE 셋은 최근을 예민하게 재는 보조다
- ⚠ 우리 `hy_spread`(2023-08-07~)가 FRED가 지금 주는 것(2023-09-19~)보다 길다.
  **이 계열은 우리 L2가 곧 아카이브다. 지우면 어디서도 복구할 수 없다**
- ALFRED 진짜 빈티지는 20계열(월간·분기)뿐이다. 일간 시장계열은 사후 수정이 없어 무해하지만,
  **백테스트 1단(2018~)조차 신용 채널은 2023년부터**다

### P0에서 나온 사실 — 기둥 셋이 게이트 미달이다

설계 가중치 중 실제로 채울 수 있는 비율(구조적 커버리지)이다. **못 채우는 자리를 분모에 남겼기 때문에**
이 숫자가 나온다 — 지웠다면 전부 100%로 보였을 것이다.

```text
monetary_discipline 100%   engine_heat  90%   debasement 80%
market_risk          72%   liquidity    71%   risk_transmission 70%
engine_power         61%
rate_absorption      40% ← 게이트(60%) 미달    dollar_network 40% ←    fiscal_dominance 40% ←
```

미달 셋은 모두 **v1에서도 매핑이 없던 기둥**이다. P1에서 계열을 붙여 올린다.

---

## 2-1. 용어와 식별자

| v1 | v2 | 한글 |
|---|---|---|
| Current | `tide` | 조류 |
| Wind | `wind` | 바람 |
| Wave | `wave` | 파도 |
| Sub-score | `pillar` | 기둥 |
| Recency Weight | `horizon_weight` | 시간축 합성 가중치 |
| Freshness Weight | `staleness_factor` | 신선도 계수 |
| Evidence Weight | `evidence_factor` | 근거 계수 |
| Current Regime | `active_regime` | 현재 레짐 |

## 2-2. 계산 계층

```text
[0] observation            원시 관측값 (기존 포털 테이블 재사용)
     ↓ 정규화
[1] indicator_score        지표 × 시간축(3) → 0–100, polarity 적용 완료
     ↓ base_weight × quality_factor
[2] pillar_score           기둥 × 시간축(3) → 0–100 + coverage + confidence
     ↓ ① §4 요약 가중치          ② 기둥 간 가중치
[3a] pillar_summary        기둥 스칼라 (화면 표시용)
[3b] regime_axis_score     tide / wind / wave 각각의 종합 점수
     ↓ CWW_CORE / CWW_TRANSITION
[4] overall, rte, alignment
     ↓ 신호 승격 + 상태 기계
[5] active_regime
```

## 2-3. 정규화 규격 (신규 — v1에 없던 부분)

지표마다 설정 파일에 다음을 정의한다.

```yaml
- code: HY_OAS
  name_ko: 하이일드 스프레드
  name_en: ICE BofA US High Yield OAS
  source: FRED
  series_id: BAMLH0A0HYM2
  frequency: daily
  transform: level          # level | yoy | mom | diff | ratio
  polarity: -1              # +1 = 값이 높을수록 자본에 우호 / -1 = 불리
  scaler: pct_rank          # pct_rank | zscore_cdf
  window: expanding         # expanding | rolling
  min_obs: 750              # 약 3년. 미달이면 MISSING
  max_window: 2500          # 약 10년 상한
  winsor: [0.01, 0.99]
  channels: [CREDIT]
  glossary: /macro/glossary#hy-oas
  evidence: official
```

**변환 규칙**

1. `transform` 적용 → 작업 계열(working series)
2. `winsor` 백분위로 극단값 절단
3. `scaler`
   - `pct_rank` (기본): 과거 분포 대비 백분위 × 100
   - `zscore_cdf`: `100 × Φ(z)` — 분포가 대칭인 지표에만
4. `polarity` 적용: `polarity = -1`이면 `100 − score`
5. 결과는 **"자본에 우호적일수록 높다"** 축으로 통일된다

**point-in-time 정합성**: `window: expanding`은 as_of 시점까지의 데이터만 사용한다. `rolling`을 쓰더라도 미래 데이터가 창에 들어가지 않도록 as_of로 자른다. 백테스트에서 이 규칙을 어기면 결과 전체가 무효다.

**왜 백분위가 기본인가**: 금융 지표는 꼬리가 두껍다(fat tail). z-score는 2008년 같은 구간에서 −6σ 같은 값을 만들고, 그러면 그 하나가 기둥 전체를 지배한다. 백분위는 상한·하한이 자연히 0과 100이라 이런 지배가 구조적으로 불가능하다. 대신 극단의 강도를 잃으므로, 급성 경보(§2-9)는 백분위가 아니라 **원시값 임계**로 별도 판정한다.

## 2-4. 시간축 합성

각 지표 × 각 시간축에 대해, 창(window) 평균의 백분위를 구한다.

```text
h_value(w) = pct_rank( mean(series, w),  과거 동일 길이 창 평균들의 분포 )

tide  = 0.35·h(1M) + 0.30·h(3M) + 0.20·h(6M) + 0.15·h(12M)
wind  = 0.45·h(1W) + 0.35·h(4W) + 0.20·h(13W)
wave  = 0.50·h(1D) + 0.30·h(3D) + 0.20·h(5D)
```

**저빈도 지표**: 분기 지표(GDP, 생산성, 기업이익, COFER)는 **tide에만 참여**한다. wind·wave에서는 `MISSING`으로 분모에서 빠진다. 억지로 월간화하지 않는다(v1의 이 지시는 옳다).

**주간 지표**: 연준 대차대조표(WALCL) 등 주간 지표는 tide·wind에만 참여.

## 2-5. 유효 가중치

```text
quality_factor    = staleness_factor × evidence_factor
effective_weight  = base_weight × quality_factor

pillar_score(axis) = Σ(indicator_score × effective_weight) / Σ(effective_weight)
coverage           = Σ(effective_weight of 사용된 지표) / Σ(effective_weight of 전체 지표)
```

`horizon_weight`는 §2-4 안에서만 쓰이고 여기에 다시 곱해지지 않는다. (B-6 수정)

**staleness_factor** — 지표의 공표 주기 기준으로 판단한다.

| 상태 | 계수 |
|---|---|
| 최신 발표 | 1.00 |
| 정상 공표주기 이내 | 0.90 |
| 한 주기 경과 | 0.70 |
| 두 주기 경과 | 0.50 |
| 세 주기 이상 경과 | MISSING (분모에서 제외) |

분기 지표를 하루 지났다고 감점하지 않고, 일간 지표를 일주일 묵은 값으로 wave에 쓰지 않는다.

**evidence_factor** (C-4 반영, 4단계)

| 구분 | 계수 |
|---|---|
| `official` — 공식 통계(FRED, 재무부, 연준, IMF) | 1.00 |
| `market` — 규제 시장 종가(Yahoo, 거래소) | 0.95 |
| `manual` — 원 발표 자료를 운영자가 직접 입력 | 0.90 |
| `judgment` — 사람의 판단(지정학, 버블 L5류) | 0.70 |

검색 스니펫은 값의 출처가 될 수 없다. 원 발표 자료를 확인한 수동 입력만 `manual`이다.

## 2-6. 커버리지 게이트 (신규)

```text
pillar coverage  < 0.60  →  pillar_score = INSUFFICIENT
axis  coverage   < 0.70  →  axis_score   = INSUFFICIENT
overall coverage < 0.70  →  레짐 전이 차단, active_regime 유지
```

`INSUFFICIENT`는 0이 아니다. 상위 집계에서 분모에서 빠진다.

## 2-7. 신뢰도 (신규 — B-11 해소)

```text
confidence = 100 × ( 0.40·coverage
                   + 0.25·mean(staleness_factor)
                   + 0.20·mean(evidence_factor)
                   + 0.15·channel_breadth )

channel_breadth = min(1, 확인된 서로 다른 채널 수 / 4)
```

표시는 숫자가 아니라 밴드로 한다 (D-1).

| confidence | 표시 |
|---|---|
| ≥ 85 | 높음 |
| 70–84 | 보통 |
| 55–69 | 낮음 |
| < 55 | 참고용 |

**점수와 신뢰도를 절대 곱하지 않는다.** 나란히 표시할 뿐이다. (v1의 이 원칙은 옳고 반드시 지킨다.)

## 2-8. 방향 (신규 — B-12 해소)

```text
direction(axis) = sign( score(as_of) − score(as_of − lag) ), 불감대 적용

axis   lag        불감대
tide   3개월       ±2.0
wind   4주         ±2.0
wave   5영업일      ±3.0
```

불감대 안이면 `FLAT`. 이것이 없으면 소수점 아래 흔들림으로 화살표가 매일 뒤집힌다.

## 2-9. 정렬도 (Alignment) — 수식 교체 ★

B-3·B-4를 해소한 새 산식이다.

```text
spread    = max(tide, wind, wave) − min(tide, wind, wave)
proximity = 100 − spread                       # 0–100, 선형, 해석 가능

direction_agreement:
  세 방향이 모두 같음                → 100
  둘이 같고 하나가 FLAT              →  75
  둘이 같고 하나가 반대              →  35
  세 방향이 모두 다르거나 판정 불가   →   0

alignment = 0.5 × proximity + 0.5 × direction_agreement
```

`spread`를 쓰는 이유: v1의 3항 수식은 어차피 `2(max−min)/3`이므로 정보가 같은데 스케일만 왜곡된다(B-3). `spread`는 같은 정보를 더 정직하게, 0–100 전 구간을 쓰며 표현한다. 가운데 값을 살리고 싶다면 표준편차를 **보조 표시**로 추가하되 점수에는 넣지 않는다(해석이 어려워진다).

**상태 결정 트리** (B-5 해소 — 점수가 아니라 트리가 상태를 정한다)

```text
1. axis 중 INSUFFICIENT가 있으면                    → UNDETERMINED
2. tide/wind/wave 방향이 모두 같고 alignment ≥ 65
     방향이 우호                                    → ALIGNED_UP
     방향이 스트레스                                → ALIGNED_DOWN
3. tide 방향과 (wind, wave) 방향이 반대이고
   wind persistence ≥ 3주                           → TRANSITION
4. alignment < 45                                   → DIVERGENT
5. 그 외                                            → MIXED
```

`TRANSITION`이 `DIVERGENT`보다 먼저 판정된다(v1 §13의 의도를 규칙으로 고정).

**정렬도 구간 표시** (방향과 반드시 함께)

| alignment | 표시 |
|---|---|
| 80–100 | 강한 정렬 |
| 65–79 | 정렬 |
| 45–64 | 혼조 |
| 25–44 | 이탈 |
| 0–24 | 강한 이탈 |

## 2-10. 채널 정의 (신규 — B-9 해소) ★

승격·확인에 쓰는 독립 채널은 **6개**로 고정한다.

| 채널 | 내용 | 대표 지표 |
|---|---|---|
| `PRICE` | 주식 가격·변동성 | S&P500, SOX, VIX |
| `CREDIT` | 신용 스프레드 | HY OAS, IG OAS, Baa 스프레드 |
| `FUNDING` | 자금시장 | SOFR−IORB, SOFR 분포 폭, FIMA 풀 |
| `RATES` | 국채·실질금리 | DGS10, DFII10, 기대인플레(T10YIE) |
| `FX` | 통화 | 달러 인덱스, 엔·위안 |
| `COMMODITY` | 원자재 | 브렌트, WTI, 금, 구리 |

**규칙**

- 확인(confirmation)은 **서로 다른 채널** 기준으로 센다
- 같은 채널 안의 지표가 몇 개 움직여도 **1표**
- VIX는 `PRICE`다. 주식과 주식 변동성은 별개 채널이 아니다
- `PRICE + CREDIT + FUNDING` 조합은 가중 1.25배 (v1 §9의 정성적 권고를 계수로 고정)

## 2-11. 신호 승격

**WAVE_ALERT → WIND_CONFIRMATION**

```text
같은 방향이 5영업일 중 3일 이상 지속
AND 서로 다른 3개 채널에서 확인
```

**WIND_CONFIRMATION → TIDE_MIGRATION**

```text
같은 방향이 3주 이상 지속
AND 서로 다른 3개 채널에서 확인
AND 구조적·실물 지표 1개 이상이 같은 방향
    (생산성, 기업이익, EPS 수정, CAPEX 가이던스, 연체율 중)
```

**성숙도 5단계** (v1과 동일, 이름만 통일)

```text
STAGE 0  NOISE               잡음
STAGE 1  WAVE_ALERT          파도 경보
STAGE 2  WIND_CONFIRMATION   바람 확인
STAGE 3  TIDE_MIGRATION      조류 이동
STAGE 4  REGIME_CONFIRMED    레짐 확정
```

**하드 게이트**: `wave` 값은 `active_regime` 전이 판정 함수에 **인자로 전달되지 않는다.** 함수 시그니처 수준에서 막는다. (B-10 해소)

```python
def evaluate_regime_transition(tide: AxisScore, wind: AxisScore,
                               signals: list[Signal],
                               prev: RegimeState) -> RegimeState:
    ...  # wave는 파라미터에 없다
```

## 2-12. 급성 경보 (B-14 해소)

```text
IF wave_stress ≥ 85 AND 서로 다른 채널 3개 이상 확인:
    ACUTE_TRANSITION_WATCH = True
    REGIME_CHANGE          = False        # 항상
```

급성 경보와 승격 경로는 **독립적으로 동시에 켜질 수 있다.** 급성 경보는 24시간 후 자동 해제되며, 조건이 유지되면 갱신된다. 화면에는 배너로 표시하되 레짐 코드는 건드리지 않는다.

`wave_stress`는 백분위가 아니라 **원시값 임계**로 판정한다(§2-3 마지막 문단 참조). 예: VIX ≥ 35, HY OAS 5일 변화 ≥ +100bp, SOFR−IORB ≥ +15bp.

## 2-13. 레짐 정의 (신규 — B-13 해소)

모든 조건은 **기둥 요약 스칼라(raw 방향, 즉 화면에 보이는 값)** 기준이다.

| 코드 | 한글 | 진입 | 해제 | 최소 체류 |
|---|---|---|---|---|
| `R0` | 미분류 | 어느 조건도 불충족 | — | 0일 |
| `R1` | 완화적 확장 | 유동성 ≥ 65 · 위험전이 < 45 · 금리감내력 ≥ 60 | 유동성 < 55 또는 위험전이 ≥ 55 | 10영업일 |
| `R2` | 안정 성장 | 엔진출력 ≥ 60 · 엔진온도 45–65 · 위험전이 < 45 | 엔진출력 < 50 또는 위험전이 ≥ 55 | 10영업일 |
| `R3` | 통화 재긴축 | 통화규율압력 ≥ 60 · 유동성 < 55 · 금리감내력 45–65 | 통화규율압력 < 50 그리고 유동성 ≥ 60 | 15영업일 |
| `R4` | 성장 둔화·디스인플레이션 | 엔진출력 < 45 · 엔진온도 < 45 · 위험전이 < 60 | 엔진출력 ≥ 55 또는 엔진온도 ≥ 55 | 15영업일 |
| `R5` | 스태그플레이션·재정자본 스트레스 | 위험전이 ≥ 70 · 엔진온도 ≥ 70 · 금리감내력 < 45 · wind 3주 지속 · tide 악화 확인 | 위험전이 < 55 · 엔진온도 < 60 · 금리감내력 > 55 · wind 2주 개선 | 20영업일 |
| `R6` | 신용·자금 위기 | 위험전이 ≥ 80 · **CREDIT 채널과 FUNDING 채널 동시 확인** · wave·wind 동시 스트레스 | 위험전이 < 60 · FUNDING 정상화 2주 | 10영업일 |

**추가 규칙**

- 진입과 해제 임계가 다르다 = 이력현상(hysteresis). v1의 이 원칙은 옳다
- **최소 체류 기간 안에는 해제 조건이 충족돼도 레짐을 바꾸지 않는다.** 단 `R6`은 예외 — 위기 진입은 언제든 가능
- 복수 진입 조건 동시 충족 시 우선순위: `R6 > R5 > R3 > R4 > R2 > R1`
- 전이 가능 그래프: `R6`은 어느 레짐에서든 진입 가능. 그 외에는 인접 레짐으로만(`R1↔R2↔R3↔R4↔R5`)
- **`FINANCIAL_CRISIS = True`는 CREDIT과 FUNDING 두 채널이 모두 확인될 때만.** 주식만 급락한 것은 위기가 아니다 (v1 §18의 원칙, 규칙으로 고정)

## 2-14. 레짐 전이 증거 (RTE) — wave 제거

```text
RTS_slow = tide·(0.20/0.65) + wind·(0.45/0.65)     # wave 성분 제거 후 재정규화
RTE      = 0.35·tide + 0.45·wind + 0.20·RTS_slow_기여
```

단순화하면: **RTE 계산에 wave는 들어가지 않는다.** v1의 `0.20×Wave` 항은 `RTS_slow`로 대체한다. §8·§26의 원칙과 산식이 이제 일치한다.

## 2-15. 민감도 분석 (B-15 해소)

**시간축 가중치 섭동**: 한 축을 ±5pp 변경하고, 나머지 둘은 **원래 비율대로 비례 재배분**한다.

```text
예: tide 50→55일 때, wind:wave = 35:15 이므로
    wind = 45 × 35/50 = 31.5,  wave = 45 × 15/50 = 13.5
```

**`MODEL_FRAGILITY_WARNING` 발생 조건** (하나라도 해당)

- 레짐 코드가 바뀐다
- overall 점수가 5점 이상 변한다
- alignment 상태가 바뀐다

**지표 가중치 섭동**: 각 지표 `base_weight`를 ±10% 변경. 어느 한 지표의 섭동이 기둥 점수를 3점 이상 움직이면 `DOMINANT_INDICATOR_WARNING`. 그 지표의 가중치를 낮추거나 기둥을 쪼갠다.

## 2-16. 설정 파일 구조

> ⚠ 구현은 `web/src/lib/gcrm/config/*.ts` 6벌이다(§2-0). YAML이 아니다 — Worker가 파일을 못 읽는다.

`config/gcrm/` 아래 YAML로 두고, git에 커밋한다. 코드에 하드코딩하지 않는다(v1의 이 지시는 옳다).

```text
config/gcrm/
  model.yaml           model_version, 시간축 가중치, 게이트 임계
  indicators.yaml      지표 정의 (§2-3 스키마)
  pillars.yaml         기둥 구성, base_weight, polarity, §4 요약 가중치
  channels.yaml        6채널 매핑
  regimes.yaml         레짐 진입·해제·체류 (§2-13)
  promotion.yaml       승격 규칙, 급성 경보 임계
```

`model.yaml` 예시:

```yaml
model_version: GCRM_2.0
axis_weights:
  core:        { tide: 0.50, wind: 0.35, wave: 0.15 }   # CWW_CORE_v2.0
  transition:  { tide: 0.35, wind: 0.45, wave: 0.00, rts_slow: 0.20 }
horizon_weights:
  tide: { M1: 0.35, M3: 0.30, M6: 0.20, M12: 0.15 }
  wind: { W1: 0.45, W4: 0.35, W13: 0.20 }
  wave: { D1: 0.50, D3: 0.30, D5: 0.20 }
gates:
  pillar_min_coverage:  0.60
  axis_min_coverage:    0.70
  overall_min_coverage: 0.70
direction_lag:
  tide: 63   # 영업일
  wind: 20
  wave: 5
direction_deadband:
  tide: 2.0
  wind: 2.0
  wave: 3.0
```

## 2-17. 데이터 모델 (SQLite)

> ⚠ 구현은 Cloudflare D1이고 테이블명은 `GcrmRun` 꼴이다(§2-0).
> 마이그레이션: `web/prisma/migrations/20260919210000_gcrm_p0/`.

기존 포털 테이블을 재사용하고, 계산 결과 테이블만 추가한다.

```sql
-- 기존 재사용: indicator, observation

CREATE TABLE gcrm_run (
  run_id        TEXT PRIMARY KEY,
  as_of         DATE NOT NULL,
  model_version TEXT NOT NULL,
  config_hash   TEXT NOT NULL,     -- SHA-256 앞 12자
  git_sha       TEXT,
  created_at    TIMESTAMP NOT NULL
);

CREATE TABLE gcrm_indicator_score (
  run_id       TEXT NOT NULL,
  indicator    TEXT NOT NULL,
  axis         TEXT NOT NULL,      -- tide | wind | wave
  raw_value    REAL,
  pct_rank     REAL,
  score        REAL,               -- polarity 적용 후, 0–100
  staleness    REAL NOT NULL,
  evidence     REAL NOT NULL,
  base_weight  REAL NOT NULL,
  eff_weight   REAL NOT NULL,
  status       TEXT NOT NULL,      -- OK | MISSING | STALE
  obs_date     DATE,
  PRIMARY KEY (run_id, indicator, axis)
);

CREATE TABLE gcrm_pillar_score (
  run_id     TEXT NOT NULL,
  pillar     TEXT NOT NULL,
  axis       TEXT NOT NULL,
  score_raw  REAL,                 -- 화면 표시용 (원래 방향)
  score_ori  REAL,                 -- 집계용 (우호 방향으로 변환)
  coverage   REAL NOT NULL,
  confidence REAL NOT NULL,
  n_used     INTEGER NOT NULL,
  n_total    INTEGER NOT NULL,
  status     TEXT NOT NULL,        -- OK | INSUFFICIENT
  PRIMARY KEY (run_id, pillar, axis)
);

CREATE TABLE gcrm_axis_score (
  run_id     TEXT NOT NULL,
  axis       TEXT NOT NULL,
  score      REAL,
  direction  TEXT,                 -- UP | DOWN | FLAT
  coverage   REAL,
  confidence REAL,
  status     TEXT,
  PRIMARY KEY (run_id, axis)
);

CREATE TABLE gcrm_regime_score (
  run_id          TEXT PRIMARY KEY,
  overall         REAL,
  rte             REAL,
  alignment       REAL,
  proximity       REAL,
  dir_agreement   REAL,
  alignment_state TEXT,            -- ALIGNED_UP | ALIGNED_DOWN | TRANSITION | DIVERGENT | MIXED | UNDETERMINED
  acute_watch     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE gcrm_signal (
  signal_id   TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  subject     TEXT NOT NULL,       -- indicator 또는 pillar 코드
  direction   TEXT NOT NULL,
  stage       INTEGER NOT NULL,    -- 0–4
  first_seen  DATE NOT NULL,
  persist_n   INTEGER NOT NULL,    -- 지속 일/주 수
  channels    TEXT NOT NULL,       -- JSON 배열
  note        TEXT
);

CREATE TABLE gcrm_regime_state (
  as_of        DATE PRIMARY KEY,
  regime_code  TEXT NOT NULL,
  regime_ko    TEXT NOT NULL,
  entered_at   DATE NOT NULL,
  dwell_days   INTEGER NOT NULL,
  prev_regime  TEXT,
  entry_reason TEXT,               -- JSON: 충족된 조건들
  run_id       TEXT NOT NULL
);
```

**재현성**: `(as_of, config_hash)`로 과거 점수를 언제든 재계산해 대조할 수 있어야 한다. 그것이 안 되면 버전 관리가 장식이다.

## 2-18. API

```text
GET /api/gcrm/current
    → { as_of, regime, axes{tide,wind,wave}, alignment, pillars[], confidence_band, acute_watch }

GET /api/gcrm/history?from=&to=&fields=
GET /api/gcrm/pillar/{code}?as_of=
    → { score_raw, score_ori, coverage, confidence, contributions[] }   # 기여도 내림차순

GET /api/gcrm/indicator/{code}?as_of=
    → { raw_value, obs_date, pct_rank, score, staleness, evidence, source_url, glossary }

GET /api/gcrm/signals?stage=&active=true
GET /api/gcrm/regime/history?from=&to=
GET /api/gcrm/explain/{pillar}?as_of=
    → 산식 텍스트 + 상위 기여 지표 5개 + 제외된 지표와 사유
```

## 2-19. CLI

> ⚠ `pms`가 아니라 `npm run gcrm -- run --dry-run`이다(§2-0). 구현은 `web/scripts/gcrm.mjs`.

포털의 기존 `pms` 명령 체계에 맞춘다.

```bash
pms regime run [--as-of YYYY-MM-DD] [--dry-run]     # 계산 + 저장
pms regime show [--as-of]                            # 터미널 요약
pms regime explain <pillar> [--as-of]                # 기여도 분해
pms regime backtest --from --to [--tier 1|2|3]       # point-in-time 재현
pms regime sensitivity [--as-of]                     # 섭동 테스트
pms regime verify [--as-of]                          # 재현성 검증 (재계산 후 대조)
```

## 2-21. 종합 의견 — 섹션 소결 + 전체 의견 (운영자 요청 2026-09-19)

> 「Regime 각 섹션마다 분석을 소결하고 전체에 대한 의견을 주는 식으로 ChatGPT는 보고한다.
>  Regime 홈 화면에 이렇게 표현해 주고 데이터를 볼 수 있도록 하면 좋겠다.
>  그대로 하드코딩하면 안 되고, AI를 사용해서 판단하면 된다.」

### 무엇을 내는가

```text
[전체]  한 문장 — 숫자보다 먼저 온다(§2-20)
[소결]  조류 한 단락 · 바람 한 단락 · 파도 한 단락
[소결]  기둥 10개 — 게이트를 통과한 것만, 각 한 줄
[경계]  「지금 가장 중요한 경계선은 무엇인가」 한 줄
```

각 소결 옆에 **그 판단이 선 데이터로 가는 링크**를 둔다(기둥 → 기여 지표 → 원시값).
읽는 사람이 문장을 의심할 수 있어야 한다.

### ⚠ AI는 **말**을 쓰고, **숫자는 쓰지 않는다**

이것이 이 절의 핵심 규칙이다.

| AI가 하는 일 | AI가 **하지 않는** 일 |
|---|---|
| 엔진이 이미 정한 판정을 사람의 말로 옮긴다 | 레짐 코드·점수·상태·성숙도를 **정한다** |
| 여러 기둥의 관계를 한 문장으로 묶는다 | 없는 값을 **추정한다** |
| 「무엇을 지켜봐야 하는가」를 문장으로 만든다 | 매수·매도·목표주가·방향 단정 |

판정은 결정론적 엔진(`lib/gcrm/*`)이 하고, 그 결과가 프롬프트의 **유일한 사실 원천**이다.

### ⚠ 지켜야 할 것

1. **발행된 값만 프롬프트에 넣는다.** `INSUFFICIENT`인 기둥은 값 대신 「자료 부족(반영률 40%)」을
   그대로 넣어, AI가 그 자리를 메우지 못하게 한다. 빈칸을 주면 모델은 채운다.
2. **`WOODSMAN_DOCTRINE`을 앞에 붙인다**(`CLAUDE.md` §6). 권유 표현 금지는 `/disclaimer`와 연결돼 있다.
3. ⭐ **숫자 대조 게이트.** 생성된 문장에서 숫자를 뽑아 **그 run의 저장값과 대조**한다.
   하나라도 어긋나면 **발행하지 않고** 프로그램이 쓴 문장으로 내리고, 관리자 화면에 사유를 남긴다.
   — 할루시네이션을 막는 실질적 장치는 프롬프트가 아니라 **이 검사**다.
4. **폴백을 표시한다.** AI 실패·키 없음이면 프로그램 문장(`lib/scores/regime-summary.ts` 방식)으로
   내리되, **어느 쪽인지 화면에 적는다**(조용한 폴백 금지 — `CLAUDE.md` §3).
5. **언제 다시 쓰나.** 레짐 코드·정렬 상태·성숙도 단계가 바뀌거나 점수가 5점 이상 움직였을 때만
   새로 쓴다. 매일 새로 쓰면 **매일 다른 말**이 되고, 그러면 문장이 판정처럼 읽히지 않는다.
   재사용은 `AiCache`를 쓴다.
6. **월 토큰 상한을 둔다**(`CLAUDE.md` §6).

### 기록 — 「소결을 기록해 주는 기능」

```sql
CREATE TABLE "GcrmNarrative" (
  "runId"        TEXT NOT NULL,
  -- overall | tide | wind | wave | pillar:<code> | watchline
  "section"      TEXT NOT NULL,
  "text"         TEXT NOT NULL,
  -- AI | PROGRAM  ⚠ 어느 쪽이 썼는지 화면이 말한다
  "author"       TEXT NOT NULL,
  "model"        TEXT,
  "promptVersion" TEXT NOT NULL,
  -- 숫자 대조 결과. FAILED면 발행하지 않는다
  "factCheck"    TEXT NOT NULL,
  "createdAt"    DATETIME NOT NULL,
  PRIMARY KEY ("runId", "section", "createdAt")
);
```

⚠ `runId`에 묶이므로 **그때의 `config_hash`와 점수가 함께 남는다** — 나중에
「왜 그때 이렇게 썼나」를 되짚을 수 있다. 운영자 지시(2026-09-19)의 「인사이트를 발견했을 때
원인 분석과 개선점을 찾을 수 있도록」이 이 자리에서 지켜진다.

⚠ **덮어쓰지 않는다.** 다시 쓰면 행이 하나 더 생긴다. 문장이 바뀐 이력 자체가 자료다.

### 언제 만드나

**P8(단계 9)**. ⚠ 그 전에 P9 민감도 분석이 끝나야 한다 — 근거 없는 가중치로 만든 점수를
AI가 문장으로 바꾸면 **틀린 숫자에 말솜씨까지 붙는다.**

---

## 2-20. UI 사양

### 홈 — 기존 `GLOBAL CAPITAL REGIME` 카드 확장

```text
GLOBAL CAPITAL REGIME                          2026-09-19 기준 · 모델 v2.0

R3 · 통화 재긴축 — 조류는 아직 버티는데 바람이 돌아섰습니다
                                                        ← 한 문장 요약이 먼저

조류(tide) 72 →      바람(wind) 58 ↓      파도(wave) 39 ↓
                     ↑ 붉은 화살표          ↑ 붉은 화살표
                       (스트레스 방향)

정렬도 47 · 혼조 · 전환(TRANSITION)          성숙도 2단계 · 바람 확인
신뢰도 보통 · 지표 38개 중 34개 반영(89%)

유동성 48 ↓   시장위험 72 ↑   위험전이 76 ↑   금리감내력 62 →

계산식과 가정 보기 →
```

지켜야 할 것:

- **한 문장 요약이 숫자보다 먼저** (포털 기존 어법)
- 점수는 **정수, 5점 단위 반올림 권장**
- 신뢰도는 **밴드**로. 퍼센트 숫자를 나열하지 않는다
- 화살표 색은 **우호=녹(`--w-series-1`) / 스트레스=적(`--w-danger`)**. 등락 색(`--w-up`/`--w-down`)을 쓰지 않는다 (D-4)
- 기준일과 커버리지를 항상 동반 (포털 기존 어법)

### 신설 `/macro/regime`

```text
GLOBAL CAPITAL REGIME
🧭 글로벌 자본 레짐

[1] 지금 상태          레짐 카드 + 한 문장 + 진입일 + 체류일수
[2] 세 시간축          조류·바람·파도 3열, 각 방향·신뢰도·구성 기둥
[3] 기둥 점수          10개 기둥, 점수·방향·커버리지 (버블 모니터 층 카드와 같은 형태)
[4] 승격 중인 신호      성숙도 0–4 타임라인, 채널 확인 배지
[5] 레짐 이력          최근 24개월 띠 그래프 + 전이 사유
[6] 이 점수를 어떻게 읽나요   ← 버블 모니터와 동일한 고지 문투
[7] 데이터 출처와 갱신   ← 포털 기존 섹션 재사용
```

### `[6] 이 점수를 어떻게 읽나요` — 초안

> 세 시간축은 서로 다른 예측이 아니라, 같은 지표를 서로 다른 길이의 창으로 본 것입니다. 조류는 1~12개월, 바람은 1~13주, 파도는 1~5거래일입니다.
>
> 파도는 레짐을 바꾸지 않습니다. 파도가 먼저 움직이고 바람이 3주 따라오고 구조 지표가 확인해 줄 때에만 레짐을 바꿉니다. 파도만 보고 바꾸면 매주 바뀌고, 매주 바뀌는 판정은 판정이 아닙니다.
>
> 결측은 분모에서 뺍니다. 안 본 지표를 0점으로 치면 "안 본 것"이 "괜찮은 것"이 되기 때문입니다. 대신 반영률이 기준 미만이면 점수를 내지 않고 '자료 부족'으로 둡니다.
>
> 점수는 예측이 아닙니다. 지금 어느 국면에 가까운지를 적어 두는 기록이고, 무엇을 할지는 사람이 정합니다.

---

# Part 3. 검산된 예시 (골든 테스트용)

v1의 예시 숫자는 자기 수식과 맞지 않으므로(B-4), 새 산식으로 검산한 예시를 제공한다. **이 값들을 단위 테스트 기대값으로 쓸 수 있다.**

### 예시 1 — 강한 정렬

```text
tide = 74 (UP)   wind = 71 (UP)   wave = 77 (UP)

spread    = 77 − 71 = 6
proximity = 100 − 6 = 94
dir_agree = 100                      (세 방향 모두 UP)
alignment = 0.5×94 + 0.5×100 = 97.0

상태: 트리 2번 → 방향 우호 → ALIGNED_UP
표시: 정렬도 97 · 강한 정렬 · 상승 정렬
```

### 예시 2 — 전환 (v1 §15와 같은 입력)

```text
tide = 72 (UP)   wind = 48 (DOWN)   wave = 31 (DOWN)
wind persistence = 3주

spread    = 72 − 31 = 41
proximity = 100 − 41 = 59
dir_agree = 35                       (둘 DOWN, 하나 반대)
alignment = 0.5×59 + 0.5×35 = 47.0

상태: 트리 2번 불충족 → 트리 3번 충족(tide UP vs wind/wave DOWN, persistence 3주) → TRANSITION
표시: 정렬도 47 · 혼조 · 전환
성숙도: STAGE 2 (바람 확인)

자동 해석:
장기 구조는 아직 버티고 있지만 주간·일간 금융 여건이 함께 나빠지고 있습니다.
지금은 레짐이 바뀐 것이 아니라 구조적 전환의 첫 확인 단계입니다.
```

### 예시 3 — 히어로 (v1 §21과 같은 입력)

```text
tide = 72 (FLAT)   wind = 58 (DOWN)   wave = 39 (DOWN)

spread    = 72 − 39 = 33
proximity = 100 − 33 = 67
dir_agree = 75                       (둘 DOWN, 하나 FLAT)
alignment = 0.5×67 + 0.5×75 = 71.0

상태: 트리 2번 불충족(방향이 모두 같지 않음)
      트리 3번 — tide가 FLAT이라 "반대"가 아님 → 불충족
      트리 4번 — alignment 71 ≥ 45 → 불충족
      트리 5번 → MIXED
표시: 정렬도 71 · 정렬 · 혼조 상태
```

> 예시 3이 v1 문서의 히어로(정렬도 34, TRANSITION)와 크게 다르다는 점에 주의. v1의 34는 어떤 산식에서도 나오지 않는 숫자다. tide가 FLAT이면 전환으로 부를 근거가 약하다는 것이 새 트리의 판정이고, 이쪽이 더 방어 가능하다.

### 예시 4 — 커버리지 미달

```text
pillar = 위험전이, 지표 12개 중 6개 사용, eff_weight 기준 coverage = 0.52

0.52 < 0.60  →  score = INSUFFICIENT
표시: 위험전이 — 자료 부족(반영률 52%)
상위 집계에서 이 기둥은 분모에서 제외된다
```

### 예시 5 — 급성 경보와 레짐의 분리

```text
VIX 41 · HY OAS 5일 +130bp · SOFR−IORB +18bp · S&P −4.2%
확인 채널: PRICE, CREDIT, FUNDING (3개)

ACUTE_TRANSITION_WATCH = True
REGIME_CHANGE          = False
active_regime          = 직전 상태 유지

화면: 상단 경보 배너 + 레짐 카드는 변경 없음
```

---

# Part 4. 구현 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **P0** | 설정 파일 6종 + DB 스키마 + `config_hash` | `pms regime run --dry-run`이 빈 결과라도 오류 없이 끝난다 |
| **P1** | 기존 `observation` 테이블 매핑. 신규 필요 지표(HY OAS, IG OAS)만 수집 추가 | 38개 지표 중 몇 개가 실제로 채워지는지 커버리지 리포트 출력 |
| **P2** | 정규화 엔진 (§2-3) | 단위 테스트: 알려진 분포에서 백분위가 맞는가, polarity가 뒤집히는가, expanding 창에 미래 데이터가 새지 않는가 |
| **P3** | 시간축 합성 + 기둥 집계 + 커버리지 게이트 (§2-4~2-6) | 예시 4 재현 |
| **P4** | 정렬도 + 방향 + 신뢰도 (§2-7~2-9) | **예시 1·2·3 정확히 재현** |
| **P5** | 채널 + 신호 승격 (§2-10~2-12) | 예시 5 재현. `evaluate_regime_transition`에 wave 인자가 없는지 서명 검사 |
| **P6** | 레짐 상태 기계 (§2-13~2-14) | 이력현상 테스트: 진입 후 임계를 살짝 밑돌아도 체류 기간 내에는 유지되는가 |
| **P7** | API + CLI (§2-18~2-19) | `pms regime verify`가 재계산 결과와 저장값을 비교해 일치 확인 |
| **P8** | UI (§2-20) | 홈 카드 확장 + `/macro/regime` |
| **P9** | 백테스트 1단계(2018~) + 민감도 | `MODEL_FRAGILITY_WARNING`이 뜨지 않을 때까지 가중치 조정 |

**P0~P4를 먼저 끝내고 화면을 만들지 않은 채로 숫자를 며칠 돌려보는 것**을 강하게 권한다. 화면을 먼저 만들면 틀린 숫자에 애착이 생긴다.

---

# Part 5. 원 문서에서 그대로 살릴 것

점검이 길었으니 잘된 부분도 명확히 적는다.

1. **파도가 레짐을 바꾸지 못하게 하는 것** — 이 시스템의 가장 중요한 설계 판단이다. 코드 수준에서 강제하라는 지시도 옳다. v2는 이를 함수 서명으로까지 밀어붙였다
2. **점수와 신뢰도를 섞지 않는 것** — 대부분의 대시보드가 여기서 실패한다
3. **결측을 0으로 채우지 않는 것** — 포털 버블 모니터와 철학이 일치
4. **진입과 해제 임계를 다르게 두는 것(이력현상)** — 깜빡임 방지의 정석
5. **분기 지표를 억지로 월간화하지 않는 것**
6. **가중치를 코드가 아니라 설정 파일에 두는 것**
7. **백테스트 평가 기준을 "주가를 맞혔는가"가 아니라 "탐지가 빨랐는가·오승격률은 얼마인가"로 잡은 것** — 이 부분이 특히 좋다. 이 틀이 있으면 모델을 정직하게 개선할 수 있다
8. **재무부 바이백을 양적완화로 계산하지 말라 / 해외 공적기관 역레포를 국내분과 분리하라 / 시장위험 상승을 유동성 하락으로 자동 연결하지 말라** — 셋 다 실제로 흔한 오류이고, 지적이 정확하다. 세 번째는 이미 포털이 지키고 있다

---

## 부록. 확인한 출처

- ICE BofA US High Yield Index OAS — 시리즈 ID `BAMLH0A0HYM2`, 일간, 단위 % (FRED 시리즈 페이지에서 직접 확인)
- ICE BofA 계열 OAS 시리즈군 — FRED Release ID 209
- MOVE 지수 — ICE Developer Portal의 유료 상품. FRED에 없음
- COFER — IMF 통계국이 분기 조사·발표. **정확한 발표 지연은 IMF 발표 일정으로 구현 시점에 재확인 필요** (통상 한 분기 내외로 알려져 있으나 이 문서에서 확정하지 않음)
- 포털 현황 — `portfolio-solutions.net` 홈 · `/macro` · `/macro/liquidity` · `/macro/credit` · `/macro/rates` · `/macro/bubble` 직접 확인 (2026-09-19)

> ※ 사용자가 적어 준 주소 `portlio-solutions.net`은 접속되지 않습니다. 실제 주소는 `portfolio-solutions.net`입니다.
