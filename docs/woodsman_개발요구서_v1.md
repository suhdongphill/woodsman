# Woodsman 투자 플랫폼 — 개발요구서 (SRS) v1.0

> 단일 파일 React(localStorage) 앱을 **6개 메뉴의 모듈형 클라우드 앱**으로 재구축하기 위한 요구사항 정의서.
> 이 문서를 Claude에게 단계별로 넘기며 작업한다. 각 단계는 독립적으로 완료·배포 가능하도록 설계한다.

---

## 0. 목적과 원칙

**목적**: 현재 포트폴리오 관리 단일 기능을 6개 메뉴(홈 / 거시분석 / 포트폴리오 관리 / 관심종목 / 투자성향 / 증권사보고서)로 확장하고, PC 개발 → 클라우드 운영 파이프라인을 갖춘다.

**설계 원칙**
1. **모듈화**: 메뉴 = 독립 모듈. 한 메뉴를 고쳐도 다른 메뉴에 영향 없게.
2. **프론트/백 분리**: 화면(React)과 로직·데이터(FastAPI)를 분리. 보안 키는 절대 브라우저에 두지 않는다.
3. **DB 추상화**: SQLAlchemy ORM으로 개발(MariaDB)/운영(관리형 DB)을 연결문자열만 바꿔 전환.
4. **단계적 배포**: 각 Phase가 끝나면 곧바로 배포·검증. 한 번에 다 하지 않는다.
5. **재현 가능**: 모든 비밀값은 환경변수, 모든 코드는 GitHub. 로컬에 의존하는 마법 없음.

---

## 1. As-Is (현재 상태 인벤토리)

현재 `index.html` = **React 18 (CDN UMD + Babel standalone) 단일 파일, 약 1,007줄**. 데이터는 전부 브라우저 `localStorage`.

| 영역 | 현재 구현 |
|---|---|
| 인증 | 자체 로그인 화면 + 다중 사용자 + 사용자 관리 모달 (localStorage 기반) |
| 종목 관리 | 추가/수정/삭제, 한·미 종목 검색, 티커·종목명·평균단가·수량·통화·산업·비중전략·투자아이디어 |
| 요약 | 원화/달러 매수·평가금액, 손익, 수익률 |
| 시각화 | 산업별 도넛차트, CANSLIM 레이더, lightweight-charts, TradingView 위젯, 캔들 패턴 |
| AI 분석 | CANSLIM 7축 분석 / 동향 분석 (Anthropic API를 **브라우저에서 직접 호출**, 키는 localStorage) |
| 뉴스 | 종목별 뉴스 리스트 |
| 데이터 입출력 | import/export(JSON), 백업 배너 |

**현 구조의 한계 (전환 사유)**
- 단일 파일 → 메뉴 6개로 확장 시 유지보수 불가.
- Babel standalone(브라우저 트랜스파일) → 느리고 프로덕션 부적합.
- localStorage → 기기 간 동기화·백업·다중 사용자 한계.
- **Anthropic 키가 브라우저에 노출** → 외부 배포 시 심각한 보안 문제.

**보존 자산 (재사용할 것)**
- 산업 분류 9종 / 산업 색상 팔레트 / 비중전략(확대·유지·축소) / 통화(KRW·USD) / CANSLIM 라벨 정의.
- 다크 테마 디자인 토큰: `bg:#0f1117, card:#1a1d27, border:#2a2e3a, emerald:#2f9e63, gold:#c9a657`.
- CANSLIM·차트·뉴스 컴포넌트 로직(React로 그대로 이식 가능).

---

## 2. To-Be 정보구조 (IA)

좌측(또는 상단) 글로벌 내비게이션 6개 메뉴 + 공통 셸(헤더·인증·토스트·설정).

| # | 메뉴 | 한 줄 정의 | 핵심 데이터 |
|---|---|---|---|
| 1 | **홈** | 오늘의 시장 브리핑 + 주요 뉴스 | 지수 스냅샷, 뉴스 피드, 포트폴리오 요약 위젯 |
| 2 | **거시분석 (Bubble 체크)** | 연구 중인 버블 거시 대시보드 (압력/취약성/트리거 3층) | 거시 시계열, 정규화 점수, 종합 게이지 |
| 3 | **포트폴리오 관리** | 현재 index.html의 모든 기능 이식 | 보유 종목, CANSLIM, 차트, 손익 |
| 4 | **관심종목** | 매수 후보 워치리스트 (Tide/섹터 태깅) | 관심 종목, 목표가, 메모, 알림 플래그 |
| 5 | **투자성향 (사주·MBTI)** | 성향 프로파일링 → 보유/관심 종목 적합도·섹터 추천 | 사주(오행) 입력, MBTI, 성향→섹터 매핑 |
| 6 | **증권사보고서** | 링크·파일 업로드 게시판 | 보고서 메타데이터, 파일(R2), 태그 |

---

## 3. 기술 아키텍처

### 3.1 권장안 (Python 기반)

```
[사용자 브라우저]
       │  HTTPS
       ▼
[Cloudflare Pages]  ← React(Vite) 정적 빌드, portfolio-solutions.net
       │  fetch /api/*
       ▼
[FastAPI 백엔드]   ← Railway / Fly.io / Render
   ├─ 인증(JWT)
   ├─ 비즈니스 로직 (모듈별 라우터)
   ├─ Anthropic API 프록시 (키는 서버 env)
   ├─ 거시 데이터 수집 스케줄러 (APScheduler / cron)
   └─ SQLAlchemy ORM
            │
            ▼
   [DB]  개발: MariaDB(PC) / 운영: 관리형 MySQL·Postgres
   [Cloudflare R2]  보고서 파일 저장 (S3 호환)
```

| 레이어 | 선택 | 이유 |
|---|---|---|
| 프론트 | **React + Vite** → Cloudflare Pages | 단일파일 탈출, 모듈·코드분할, 도메인 그대로, 무료 CDN |
| 백엔드 | **FastAPI** → Railway/Fly/Render | 이미 사용 중, pandas 거시분석 친화, 키 서버화 |
| ORM | **SQLAlchemy + Alembic** | dev/prod DB를 연결문자열로 전환, 마이그레이션 버전관리 |
| 파일 | **Cloudflare R2** | S3 호환·저렴, 보고서 PDF 저장 |
| 인증 | **JWT (python-jose) + bcrypt** | 무상태, 프론트/백 분리에 적합 |
| 형상/CI | **GitHub + GitHub Actions** | push 시 프론트→Pages, 백→Railway 자동 배포 |

### 3.2 대안 (전부 Cloudflare, JS)

Cloudflare Pages + **Functions** + **D1**(서버리스 SQLite) + R2. 한 플랫폼·최저비용·단순 운영. 단, 백엔드를 TypeScript로 작성해야 하고 거시분석의 통계 연산이 어색. **분석 비중이 크면 권장안(FastAPI) 우선.**

### 3.3 결정 사항 (작업 전 확정 필요)
- [ ] 백엔드 호스트: Railway / Fly.io / Render 중 택1
- [ ] 운영 DB: 관리형 MySQL(MariaDB 호환) vs Postgres 중 택1
- [ ] 모노레포(프론트+백 한 repo) vs 멀티레포 — **모노레포 권장**(개인 프로젝트 관리 편의)

---

## 4. 데이터 모델 (초안)

> SQLAlchemy 모델로 구현. 컬럼은 핵심만 표기, 구현 시 `id/created_at/updated_at` 공통 추가.

```
users(id, username, password_hash, display_name, role, created_at)

holdings(id, user_id→users, ticker, name, avg_cost, shares,
         currency[KRW|USD], industry, weight_strategy[확대|유지|축소],
         invest_idea, added_at)            # 현 index.html 이식

watchlist(id, user_id, ticker, name, sector, tide[AI|고령화|에너지|방산|금융혁신],
          target_price, conviction[1-5], reason, memo, alert_flags(json), added_at)

canslim_cache(id, ticker, scores(json: C..M+reason), composite, analyzed_at)

reports(id, user_id, title, broker, ticker, type[link|file],
        url, file_key(R2), published_at, tags(json), memo, created_at)

# 거시분석 (Phase 5)
macro_series(id, series_id, source[FRED|ECOS|MARKET], date, value)   # 원시 시계열
macro_scores(id, date, layer[pressure|fragility|trigger],
             indicator, raw, zscore, percentile)                     # 정규화 결과
macro_snapshot(date, pressure, fragility, trigger, bubble_gauge,
               signals(json), note)                                  # 일별 종합

# 투자성향 (Phase 7)
investor_profile(id, user_id, birth_dt, saju(json: 천간지지·오행분포),
                 mbti, risk_tolerance, horizon, derived_tendencies(json))
sector_affinity(id, profile_id, sector, tide, score, rationale)      # 성향→섹터 매핑

# 홈 (Phase 4)
market_brief(date, indices(json), summary, top_news(json), generated_at)
```

---

## 5. 기능별 상세 요구사항

### 5.1 홈
- 오늘의 시장 브리핑: 주요 지수(KOSPI/KOSDAQ/S&P500/나스닥) 스냅샷 + AI 1~2문단 요약.
- 주요 뉴스 피드(보유·관심 종목 우선).
- 내 포트폴리오 요약 위젯(총평가·손익·수익률) → "포트폴리오 관리"로 딥링크.
- 브리핑은 매일 1회 백엔드 스케줄러가 생성·캐싱(`market_brief`), 화면은 읽기만.

### 5.2 거시분석 (Bubble 체크)
- **3층 스코어링**: ① 압력(인플레·임금·기대인플레·노동), ② 취약성(ERP·집중도·마진부채·CAPEX·신용스프레드 압축), ③ 트리거(스프레드 확대·유동성고갈·단기자금스트레스·BTC/금 선제매도·MOVE·DXY).
- 각 지표 → 롤링 z-score / 5년 백분위로 정규화 → 층별 서브스코어 → 종합 버블 게이지.
- 수집: FRED API(미국), 한국은행 ECOS(한국), 시세(BTC·금·DXY·VIX). 백엔드 스케줄러 일배치 → `macro_series`→`macro_scores`→`macro_snapshot`.
- 화면: 층별 게이지 + 지표별 시계열 + "오늘 켜진 신호" 패널. **다크 네이비-시안 포맷(`--bg:#0b1220, --cyan:#34d6ff, --amber:#ffb347`)** 적용.
- 주의: 타이밍 예언기가 아니라 *상태 모니터*. 점수의 추세·가속도를 본다.

### 5.3 포트폴리오 관리 (현 index.html 이식)
- 현재 모든 기능 보존: 종목 CRUD·검색, 요약 패널, 산업 도넛, CANSLIM 레이더, 차트(lightweight/TradingView), 캔들 패턴, 뉴스, import/export.
- 변경점: localStorage → **백엔드 API + DB**. AI 호출 → **백엔드 프록시**(키 서버화). 컴포넌트 모듈 분리.

### 5.4 관심종목
- 워치리스트 CRUD, Tide/섹터 태깅, 목표가·확신도(1~5)·메모.
- 포트폴리오로 "승격"(관심→보유) 액션.
- (선택) 목표가 도달 알림 플래그.

### 5.5 투자성향 (사주·MBTI)
- 입력: 생년월일시 → 사주(천간지지·오행 분포) 파생, MBTI 선택, 위험성향·투자기간.
- 출력: 성향 프로파일 → 보유/관심 종목의 섹터·Tide와 **적합도 매칭**, 부족하면 추천 섹터 제시.
- **프레이밍 주의**: 이 메뉴는 *개인화·페르소나 보조* 기능이지 투자 자문이 아니다. 화면에 "참고용, 투자 결정의 근거가 아님" 명시. 사주 결과로 특정 종목 매수를 단정하지 않는다.

### 5.6 증권사보고서
- 게시판형 목록: 제목·증권사·관련 종목·발행일·태그·메모.
- 입력: 외부 링크 또는 파일(PDF) 업로드 → **R2 저장**(`file_key`).
- 필터: 종목·증권사·태그·기간. (선택) 업로드 시 AI 요약.

---

## 6. 비기능 요구사항
- **보안**: Anthropic·DB 키는 서버 env. JWT 만료·갱신. 파일 업로드 검증(확장자·용량). HTTPS 강제.
- **모듈화**: 백엔드 `routers/{home,macro,portfolio,watchlist,profile,reports}.py`, 프론트 `pages/`·`components/`·`api/` 분리.
- **반응형**: 모바일/데스크톱 대응(현 앱 다크 테마 유지).
- **백업**: DB 정기 백업, export 기능 유지.
- **관측성**: 기본 로깅, 스케줄러 실패 알림.

---

## 7. 마이그레이션 전략
1. localStorage 데이터 → export(JSON) → 백엔드 import 엔드포인트로 1회 이행.
2. `DATABASE_URL` 환경변수: 개발=`mysql+pymysql://...(MariaDB)`, 운영=관리형 DB. 코드 변경 없음.
3. Alembic으로 스키마 버전관리(`alembic revision --autogenerate`).
4. AI 호출 경로 교체: 프론트→백엔드 `/api/ai/*`→Anthropic.

---

## 8. 단계별 작업 계획 (Phased Roadmap)

> 각 Phase = 1~수 회 Claude 세션. 끝나면 배포·검증 후 다음으로.

| Phase | 목표 | 완료 기준(DoD) |
|---|---|---|
| **P0 셋업** | 모노레포 + Vite + FastAPI + SQLAlchemy + 배포 파이프라인 | "hello" 화면이 Pages에, `/api/health`가 백엔드에 떠서 프론트가 호출 성공 |
| **P1 앱 셸·라우팅** | 6메뉴 내비 + 공통 레이아웃 + 디자인 토큰 + 빈 페이지 6개 | 메뉴 전환·반응형 동작, 디자인 시스템 추출 |
| **P2 인증·DB·포트폴리오 이식** | 로그인(JWT) + holdings DB화 + 현 기능 전부 이식 + AI 프록시 | 클라우드에서 종목 CRUD·CANSLIM·차트 정상, 키 노출 없음 |
| **P3 관심종목** | watchlist CRUD + Tide 태깅 + 승격 | 관심→보유 이행 동작 |
| **P4 홈** | 시장 브리핑 스케줄러 + 뉴스 + 요약 위젯 | 일배치 브리핑 캐싱·표시 |
| **P5 거시분석** | FRED·ECOS 수집 + 3층 스코어링 + 대시보드 | 일배치 점수 생성, 게이지·시계열·신호 표시 |
| **P6 증권사보고서** | 링크·파일(R2) 게시판 + 필터 | 업로드·다운로드·필터 동작 |
| **P7 투자성향** | 사주·MBTI 입력 + 섹터 매칭·추천 | 프로파일→적합도·추천 출력(+면책 표기) |
| **P8 마감** | 보안 점검·백업·로깅·문서화 | 운영 체크리스트 통과 |

---

## 9. Claude에게 단계별로 요청하는 법 (프롬프트 가이드)

**핵심 원칙**: 한 번에 한 Phase, 한 모듈씩. 매 요청에 (a) 이 문서 첨부, (b) 범위 명시, (c) 관련 기존 코드 첨부, (d) 완료 기준 명시, (e) "한 모듈만" 지시.

### 재사용 프롬프트 스켈레톤
```
[첨부] woodsman_개발요구서_v1.md, (해당 시) 현재 index.html / 직전 산출물

지금은 Phase {N} "{이름}" 작업이야.
- 범위: {이 세션에서 만들 것 1~2개 모듈만}
- 제약: {권장 아키텍처 — FastAPI + SQLAlchemy + React/Vite, DB는 SQLAlchemy로 추상화}
- 완료 기준: {DoD}
- 산출: {파일 경로/구조까지 명시해서}

전체를 한 번에 만들지 말고, 먼저 {파일 구조·인터페이스}만 제안해줘.
내가 확인하면 모듈 하나씩 구현하자.
```

### Phase별 예시 요청
- **P0**: "모노레포 폴더 구조와 최소 동작하는 Vite+FastAPI 스캐폴드, `/api/health`와 프론트 호출 예제, Railway·Pages 배포 설정(GitHub Actions 포함)을 만들어줘. 코드보다 구조와 배포 흐름을 먼저 설명해줘."
- **P1**: "6메뉴 내비게이션 셸과 라우팅, 다크 테마 디자인 토큰을 추출해줘. 기존 index.html의 색상·폰트를 그대로 토큰화하고, 메뉴별 빈 페이지 컴포넌트만 생성해."
- **P2**: "첨부한 index.html의 포트폴리오 기능을 모듈 컴포넌트로 분해하고, localStorage를 FastAPI+SQLAlchemy 백엔드로 교체해줘. holdings 모델·라우터·프론트 api 레이어부터. CANSLIM AI 호출은 백엔드 프록시로 옮겨."
- **P5**: "거시분석 3층 스코어링을 구현하자. 먼저 FRED·ECOS 수집기와 macro_series 스키마, 그다음 z-score 정규화·층별 합산 로직만. 대시보드 화면은 그다음 세션에."

### 진행 팁
- 매 Phase 끝에 "다음 Phase 시작 전 점검 리스트"를 Claude에게 요청해 회귀를 막는다.
- DB 스키마가 바뀌면 항상 Alembic 마이그레이션을 같이 요청.
- 막히면 "전체 다시"가 아니라 "이 모듈만 수정"으로 범위를 좁힌다.

---

## 10. 미결 정함 (작업 시작 전 답할 것)
1. 백엔드 호스트(Railway/Fly/Render)?
2. 운영 DB(MySQL 호환 vs Postgres)?
3. 다중 사용자 유지 vs 단일 사용자(본인) 단순화?
4. 거시분석 데이터 소스 우선순위(미국 FRED 먼저 vs 한·미 동시)?
5. 투자성향 사주 로직: 직접 계산 vs 외부 만세력 라이브러리?

---

*문서 버전 v1.0 · 작성 보조: Claude · 핸들: WoodsMan(SUH)*
