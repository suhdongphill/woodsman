# Woodsman — 개발요구서 v2.0 (실제 구현 반영)

> **v1과의 관계**: v1(`woodsman_개발요구서_v1.md`)은 착수 전 구상이다. Python 백엔드,
> 6메뉴 IA, 다중 사용자 플랫폼을 전제했다. **실제로 만든 것은 다르다.**
> v1은 발상의 기록으로 남겨 두고, **지금부터의 기준 문서는 이 v2**다.
>
> 작성일 2026-08-02 · **최종 갱신 2026-08-29** · 다음 세션이 여기서 출발한다.
>
> ⚠ **이 문서는 작업할 때마다 갱신한다.** 기준 문서가 실제와 어긋나면 그건 기준이 아니라
> 착각이다 — 다음 세션이 틀린 전제 위에서 출발하게 된다(2026-08-29에 실제로 그랬다: §7 참고).
> 변경의 **이유**는 `web/CHANGELOG.md`에 남기고, 여기에는 **지금의 상태**만 적는다.

---

## 0. 무엇을 만들고 있나 (한 문단)

**Woodsman 한 사람이 자기 계좌와 판단을 공개하는 투자 기록 블로그.**
회원가입을 받지 않고, 커뮤니티는 코드만 살려 둔 채 스위치로 잠가 뒀다.
**1순위 목적은 티스토리 블로그로 트래픽을 보내는 것**이고, 성과 지표는 페이지뷰가 아니라
`/admin` 최상단의 **"티스토리로 넘어간 클릭"**이다.

지금 계좌는 **모의 투자(시뮬레이션)**다. 매매·납입은 가상이고 종목 시세는 실제 시장가격이다.
그 사실을 계좌 숫자가 나오는 모든 화면에 밝힌다 — 감추면 나중에 실제 기록을 올려도
신뢰를 회복할 수 없다.

발전 방향: 1인 베타 블로그 → 커뮤니티 개방 → 안정적 파이프라인 관리 지원 서비스 → 법인화.

---

## 1. v1에서 뒤집힌 결정 (중요)

| v1 구상 | 실제 결정 | 왜 |
|---|---|---|
| Python(FastAPI) 백엔드 + 별도 호스트 | **Next.js 15 App Router 단일 앱** | 서버 컴포넌트로 렌더와 질의를 한 곳에서. 호스트를 하나로 줄임 |
| 관리형 MySQL/Postgres | **Cloudflare D1 (SQLite at edge)** | Workers와 같은 런타임. 개인 규모에 비용·운영 부담 없음 |
| Prisma를 런타임 ORM으로 | ⚠ **Prisma는 스키마·마이그레이션 전용.** 런타임은 D1 바인딩 직접 | Workers 번들에 Prisma 엔진이 안 들어가 첫 쿼리에서 죽었다 (2026-08-02 사고) |
| Cloudflare **Pages** | **Cloudflare Workers** + OpenNext 어댑터 | SSR·미들웨어를 쓰고, Cloudflare도 Workers로 방향을 옮김 |
| 6메뉴 플랫폼(거시분석·투자성향·보고서 등) | **읽는 사이트로 축소** — 홈·인사이트·포트폴리오·투자일지·종목분석 | 가입을 파는 곳이 아니라 읽는 곳. 콘텐츠가 유입을 만든다 |
| 다중 사용자 | **운영자 1인** (가입 잠금) | 커뮤니티는 스위치로 나중에 연다 |

**v1의 미결 질문 5개는 이렇게 정리됐다**: ①②는 위 표대로, ③은 단일 사용자,
④⑤(거시분석·투자성향)는 **범위에서 뺐다** — 지금 사이트의 목적과 맞지 않는다.

⚠ **정정(2026-08-29).** ④ 거시분석은 **다른 모양으로 돌아왔다.** 빼기로 한 것은 v1이 구상한
"사용자별 거시 분석 서비스"였고, 실제로 만든 것은 **읽는 대시보드**다(`/macro`, 지표 53개 ·
버블 모니터 30지표 · P9·P10). 방문자에게 파는 기능이 아니라 **읽을거리**이므로 위 결정과
어긋나지 않는다. 투자성향(⑤)은 여전히 범위 밖이다.

---

## 2. 지금의 구조

```
web/
  src/lib/**            판단 로직 — 순수 함수, DB·React 의존 없음, 전부 테스트 있음
  src/features/<도메인>/
      repository.ts     D1 질의
      actions.ts        서버 액션 (모두 requireAdmin 먼저)
      schema.ts         입력 검증(zod)
      ui/*.tsx          화면
  src/app/**            라우트 — 조립만 한다
```

운영 주소: **https://portfolio-solutions.net** (www는 301로 정본에 합침)

⚠ **배포는 지금 손으로 한다** (`cd web; npm run cf:deploy`). `.github/workflows/deploy.yml`에
자동배포(품질 게이트 → D1 마이그레이션 → OpenNext 빌드 → Workers)가 있지만 **2026-08-06 이후
12회 연속 실패**했고, 그 뒤로는 push 자체를 안 해서 실행 기록도 없다. 자세한 것은 §7.

### 순수 모듈 목록 (전부 테스트 있음 — 파일 51개 · **테스트 843개**, 2026-08-29)

사이트 · 접근 제어
`access` `site-policy` `site-status` `site-url` `site-links` `site-basics` `site-settings`
`data-mode` `security-headers` `session` `login-throttle` `comment-throttle` `quota`
`beacon-guard` `beacon-path` `user-delete` `seed-data` `seed-residue`

계좌 · 콘텐츠
`allocation` `bucket-target` `manual-price` `performance` `outbound` `outbound-repo`
`markdown` `sanitize-html` `sections` `seo` `format` `llms-txt` `ads` `ai-crawlers`
`analytics` `engagement` `comments`

도메인 묶음
`macro/{registry,catalog,series,signal,parse,freshness,layers,derived,overlay,groups,fedhike}`
`bubble/{catalog,score}` `canslim/{catalog,score}` `quote/{lookup,parse,envelope,kpi}`
`report/{catalog,context,link,rules,tistory}` `ai/{catalog,persona,context,routing,retrieval,labels}`

⚠ 판단은 여기(`lib/*`, 순수 함수)에만 둔다. 질의는 `*-repo`, 액션은 `*-actions`, 화면은 `ui/*`.
섞이기 시작하면 **화면을 띄워야만 검증할 수 있는 규칙**이 생기고, 그때부터 규칙이 조용히 틀린다.

---

## 3. 되돌리면 안 되는 규칙 (⚠)

전체 목록은 `web/CLAUDE.md` 6장. 특히 자주 깨지는 것:

1. **런타임에 Prisma 금지.** 질의는 `lib/d1.ts`. `getCloudflareContext({async:true})` 필수.
2. **조용한 실패 금지.** 실패 시 안전한 기본값으로 응답하되 **반드시 `console.error`**.
   "값이 없음"과 "읽지 못함"이 같은 화면이 되면 안 된다.
3. **계좌 숫자가 나오는 화면에는 모의/실계좌 표시**(`DataModeNotice`). 기본값은 모의.
4. **통화가 섞인 값을 그냥 더하지 않는다.** `allocation.holdingValueKrw()`로 원화 환산 후 계산.
5. **날짜만 있는 값은 정오(UTC) 저장.** 자정으로 넣으면 화면에서 하루 밀린다.
6. **AI 키는 DB에 저장하지 않는다.** `.env` → `npm run ai:sync` 한 경로뿐.
7. **AI 프롬프트에 Woodsman 공통 규범이 항상 맨 앞.** 매수 권유·목표주가·방향 단정 금지.
8. **유료 AI 제공자에 월 토큰 상한 필수.** 제한 시간도 필수.
9. **DB 정책을 읽는 페이지에 `generateStaticParams` 금지** — `force-dynamic`.
10. **가입은 항상 USER.** ADMIN은 시드/스크립트로만.

---

## 4. 데이터 모델 (실제)

Prisma 스키마 `web/prisma/schema.prisma`가 원본. 주요 모델:

| 모델 | 역할 | 상태 |
|---|---|---|
| `User` | 운영자 1명 (ADMIN) | 사용 중 |
| `SiteConfig` | 사이트 스위치 + **기본값**(모의/실계좌, 환율, 홈 문구, 티스토리, 문의 메일) | 사용 중 |
| `JournalEntry` | 투자일지 | **DB 연결 완료** (2026-08-02) |
| `AccountSnapshot` | 월 1회 계좌 스냅샷 → 자금흐름 곡선 | **DB 연결 완료** |
| `ModelHolding` | 대표 포트폴리오 종목 | **DB 연결 완료** (2026-08-06) |
| `Rebalance` | 리밸런싱 기록 | **DB 연결 완료** (2026-08-06) |
| `Post` | 콘텐츠 (본문 원본 + 형식 + 쌓일 섹션) | **DB 연결 완료** (2026-08-06) |
| `Comment` | 댓글 | ⚠ 아직 목업 (커뮤니티는 잠금 상태) |
| `MacroPoint` / `MacroIngest` | 거시 지표 시계열·수집 이력 | **DB 연결 완료** (2026-08-06) |
| `BubbleReading` / `BubbleTriggerState` | 버블 모니터 채점·트리거 | **DB 연결 완료** (2026-08-06) |
| `AiProvider` / `AiConfig` / `AiCache` | AI 제공자 상태·정책 | 상태만 DB, 카탈로그는 코드 |
| `OutboundClick` / `OutboundSource` | 티스토리 유입 집계 · 유입 출처 | 사용 중 (성과 지표) |
| `PageView` / `PageEngagement` | 자체 방문·체류 집계 | 사용 중 |
| `StockReport` / `…Block` / `…Item` | 종목분석 보고서 본문·블록·항목 | **DB 연결 완료** (2026-08-15~17) · ⚠ 발행본 0건 |
| `StockChecklistItem` / `StockReportContext` | CANSLIM 체크리스트 · 보고서에 주입한 근거 | **DB 연결 완료** |
| `StockQuote` / `StockQuoteIngest` | 종목 시세·수집 이력 (손입력 → 자동) | **DB 연결 완료** (2026-08-18) |
| `Portfolio` / `Holding` / `PortfolioBucket` | 포트폴리오·보유·대분류(데이터로 내림) | **DB 연결 완료** (2026-08-21) |
| `CommentReport` | 댓글 신고 | 스키마·관리자 화면 있음 (커뮤니티 잠금) |
| `LoginAttempt` | 로그인 시도 제한 | 사용 중 |
| `Feed` | 티스토리 RSS | 스키마 + `/admin/feeds` |

---

## 5. Phase 현황

| Phase | 내용 | 상태 |
|---|---|---|
| P0 | Next.js 뼈대·디자인 토큰·화면 목업 | ✅ |
| P1 | Cloudflare 배포 파이프라인·D1·자동배포 | ✅ |
| P2 | 인증·권한(Auth.js v5, JWT) | ✅ |
| P2.5 | 사이트 성격 전환(1인 블로그) · 정책 페이지 · 광고/SEO 기반 | ✅ |
| P2.6 | 티스토리 유입 측정(`/go/*`) | ✅ |
| P2.7 | 도메인 이전 · 검색 색인 개방 | ✅ |
| P2.8 | AI 모듈(카탈로그·페르소나·컨텍스트·라우팅·키 등록·제한 시간) | ✅ |
| **P3** | **투자일지·계좌 스냅샷 DB화 + 관리자 CRUD** | ✅ (2026-08-02) |
| **P4** | **대표 포트폴리오(ModelHolding) DB화 + CRUD** | ✅ (2026-08-06) |
| **P5** | **Post DB화 + 3모드 편집기(보기/MD/HTML) + 섹션 프레임** | ✅ (2026-08-06) |
| **P9** | **거시 지표 대시보드 — 볼트 화면 이식 + FRED/Yahoo 자동 수집** | ✅ (2026-08-06) |
| **P10** | **버블 모니터(5레이어 28지표) + 사이트 로컬 RAG** | ✅ (2026-08-06) |
| P11 | 종목분석 보고서 1~5단계 — 규율을 문서가 아니라 **코드가** 지킨다 | ✅ (2026-08-15~21) |
| P12 | 종목 시세 자동 수집(`StockQuote`) — 손으로 찾아 넣던 것을 사이트가 받는다 | ✅ (2026-08-18) |
| P13 | 댓글 관리 · 방문 집계(`PageView`) · 유입 출처 | ✅ (2026-08-07~) |
| **P14** | **볼트 거시 대시보드 이식 2차** — 신선도·인과 레이어(L0~L6)·유동성 묶음·겹쳐 보기·순유동성 | ✅ (2026-08-22~26) |
| P5.5 | 티스토리 RSS 수집 → Post 자동 등록 | 스키마·`/admin/feeds`까지. 자동 등록은 대기 |
| P6 | AI 실제 호출 연결(지금은 라우팅·프롬프트까지만) | 대기 |
| P7 | AdSense 승인 후 광고 배치 | 대기(콘텐츠 축적 필요) |
| P8 | 커뮤니티 개방(가입·댓글) — ⚠ `/privacy` 먼저 갱신 | 조건부 |

⚠ **Phase가 ✅라는 것은 "코드가 있다"는 뜻이지 "화면에 값이 있다"는 뜻이 아니다.**
2026-08-29 현재 대표 포트폴리오·계좌 스냅숏·종목 보고서는 **전부 0건**이고, 거시 지표도
유동성 4 + 금리 4 + DXY·금이 값 0건이다. 그래서 §6의 1순위는 코드가 아니다.

---

## 6. 다음에 바로 할 일 (2026-08-29 기준)

⚠ **병목은 코드가 아니다.** 네 세션째 같은 항목이 그대로다. 화면·판정·수집은 다 만들어져
있는데 **관리자 화면에 값이 안 들어가 있어서** 홈·`/portfolio`·`/stocks`의 막대·곡선·카드가
비어 있다. 1순위 목적이 티스토리 유입인데, **넘길 볼거리가 없는 상태**다.
여기서 코드를 더 쌓아도 화면은 그대로 비어 있다.

### 6-1. 사람만 할 수 있는 것 (⭐ 1순위)

| # | 할 일 | 왜 |
|---|---|---|
| **1** | `/admin/macro` **전체 자료 가져오기** | 유동성 4 + 금리 4 + DXY·금이 값 0건. **순유동성도 여기 걸려 있다** — 하나로 여럿이 산다 |
| **2** | `/admin/사이트 기본값`의 **환율** | ⚠ `1,350원`인데 거시 지표는 `1,409.9원`. **보유 종목을 넣기 전에** 고쳐야 틀린 평가액이 안 쌓인다 |
| **3** | `/admin/model-portfolio` 목표 구성비 → 실제 보유 | 홈·`/portfolio` 막대가 산다 |
| **4** | `/admin/journal` 계좌 스냅숏 1건 | 한 점만 있어도 곡선이 되살아난다 |
| **5** | `/admin/stocks` 첫 보고서 발행 → 전체 시세 가져오기 | 발행이 먼저다(시세는 발행본이 있어야 쓸 데가 생긴다) |
| 6 | `/admin/bubble` `llm_token_spend`·`asset_life_mismatch` | 28/30 → 30/30 |
| 7 | 버블 채점 갱신(`/bubble-review`) | ⚠ 가장 오래된 판정이 **2026-03-28**. 다섯 달 묵었다 |

### 6-2. 코드 쪽

- **자동배포 복구** — §7. 배포를 손으로 하는 한 "고쳐 놓고 배포를 잊는" 사고가 또 난다
  (2026-08-25→29에 실제로 났다).
- **비콘 볼륨 상한이 병렬에 안 듣는다**(`lib/beacon-guard.ts`, 점검 중간 1건).
  후속안은 **엣지 WAF Rate Limiting**. ⚠ 무료 등급에서 막히면 **우회 설계하지 말고 유료 전환을 먼저 알린다.**
- **볼트에서 아직 안 옮긴 것** — 판정 원장(`_calls/`, ⚠ 표본이 쌓여야 값이 난다) ·
  자본흐름 지도(관계 그래프·D1이 얽힌 큰 작업, `/macro-pipeline`에서) · EIA 원유재고 3종(어댑터 필요) ·
  M1 증가율 · ISM 신규주문 · 주가지수.
- **보고서 5단계 C·D**(구조화·AI 초안 페르소나)는 **발행본 0건인 지금은 이르다.**

## 7. 운영 절차

옵시디언 `05_Methodology/Woodsman 사이트 운영방법.md`에 있다.

```bash
cd web
npm run dev            # 로컬 (로컬 D1 사용)
npm run db:setup       # 로컬 D1 마이그레이션 + 시드
npm run check          # ⚠ dev를 먼저 끄고 실행 (Windows에서 .next가 깨진다)
npm run cf:deploy      # ⚠ 지금은 이것이 유일한 배포 경로다 (자동배포 고장, 아래 참고)
npm run ai:sync        # .env의 AI 키를 Cloudflare 시크릿으로
npm run admin:set      # 관리자 계정 변경 (대화식)
npm run admin:apply    # .env에 적힌 값으로 관리자 계정 반영 (비대화식)
```

⚠ **Windows에서 dev를 껐는지 실제로 확인한다.** `pkill -f`는 node 프로세스를 **못 잡는다** —
2026-08-25에 살아남은 dev 서버 두 개가 `.open-next`를 잡고 있어 배포가 `EPERM`으로 죽었다.

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'"   # 세고
Stop-Process -Force -Id <pid>                              # 끈다
```

### ⚠ 자동배포가 고장 나 있다 (2026-08-29 확인)

`gh secret list`에 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`가 **둘 다 있는데도**
(2026-08-06 등록) `deploy.yml`의 D1 마이그레이션 단계가 매번 이렇게 죽는다.

```
✘ [ERROR] In a non-interactive environment, it's necessary to set
          a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

**2026-08-06 이후 12회 연속 실패**했고, 그 뒤로는 push를 안 해서 실행 기록조차 없다
(⚠ 2026-08-29 현재 로컬이 `origin/main`보다 **16커밋 앞서 있다**).

⚠ **그동안 문서에 적혀 있던 "시크릿 미등록"은 틀린 진단이었다.** 등록은 돼 있고,
러너에서 값이 비어 보인다 — **토큰 값 자체를 다시 넣어야 한다**(`gh secret set CLOUDFLARE_API_TOKEN`).
값은 사람만 가지고 있으므로 이 항목은 §6-1과 같은 부류다.

⚠ 그때까지는 **배포 후 운영본을 직접 열어 확인한다.** 로컬 통과는 배포 성공이 아니고,
손 배포는 **잊을 수 있다** — 2026-08-25에 커밋만 하고 배포를 빠뜨려 나흘간 운영본에
고친 내용이 안 올라가 있었다.


---

*문서 버전 **v2.2** · 2026-08-29(P11~P14 반영 · 자동배포 고장 기록 · 다음 할 일 갱신)*
*이전: v2.1 2026-08-06(P4 완료) · v1 `woodsman_개발요구서_v1.md`(구상 단계 기록)*
