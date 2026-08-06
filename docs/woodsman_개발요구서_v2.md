# Woodsman — 개발요구서 v2.0 (실제 구현 반영)

> **v1과의 관계**: v1(`woodsman_개발요구서_v1.md`)은 착수 전 구상이다. Python 백엔드,
> 6메뉴 IA, 다중 사용자 플랫폼을 전제했다. **실제로 만든 것은 다르다.**
> v1은 발상의 기록으로 남겨 두고, **지금부터의 기준 문서는 이 v2**다.
>
> 작성일 2026-08-02 (야간 작업 종료 시점) · 다음 세션이 여기서 출발한다.

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

배포: `main`에 push → GitHub Actions(품질 게이트 → D1 마이그레이션 → OpenNext 빌드 → Workers)
운영 주소: **https://portfolio-solutions.net** (www는 301로 정본에 합침)

### 순수 모듈 목록 (전부 테스트 있음, 179개)

`access` `site-policy` `site-status` `site-url` `site-links` `site-basics` `data-mode`
`allocation` `manual-price` `performance` `outbound` `ads` `auth-providers` `format` `env-file`
`markdown` `sanitize-html` `seo` `sections` `macro/{registry,series,signal,parse}`
`bubble/{catalog,score}` `ai/{catalog,persona,context,routing,retrieval}`

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
| `OutboundClick` | 티스토리 유입 집계 | 사용 중 (성과 지표) |
| `Feed` | 티스토리 RSS | 스키마만 |

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
| P5.5 | 티스토리 RSS 수집 → Post 자동 등록 | ⏭ **다음 작업** |
| P6 | AI 실제 호출 연결(지금은 라우팅·프롬프트까지만) | 대기 |
| P7 | AdSense 승인 후 광고 배치 | 대기(콘텐츠 축적 필요) |
| P8 | 커뮤니티 개방(가입·댓글) — ⚠ `/privacy` 먼저 갱신 | 조건부 |

---

## 6. 다음 세션에서 바로 할 일 (P5)

**P4는 끝났다** — 대표 포트폴리오·리밸런싱이 D1로 옮겨졌고 `/admin/model-portfolio`에서
실제로 편집된다. 현재가는 관리자가 손으로 넣고, 기준일(`priceAsOf`)이 값과 함께 저장·표시된다
(`lib/manual-price.ts`). 목표 비중 합계가 100%가 아니면 경고하되 **막지는 않는다.**

다음은 **콘텐츠(Post)가 아직 목업**이라는 것이다. 인사이트 목록·상세가 `lib/mock.ts`를
읽고 있어 글을 쓸 수도, 티스토리 글을 끌어올 수도 없다. 1순위 목적이 티스토리 유입인데
연결 통로가 목업인 셈이다.

1. `features/posts/repository.ts` — `Post` D1 CRUD (투자일지·포트폴리오와 같은 모양)
2. `features/feeds/*` — `Feed`(티스토리 RSS) 수집 → `Post`(source=TISTORY) 저장
   - ⚠ 티스토리 원문은 **canonical을 원문으로**. 전문을 복제하지 않는다(요약 + 원문 링크).
   - 유입 측정은 이미 있는 `/go/*`를 그대로 쓴다.
3. 공개 `/insights`·`/insights/[slug]`를 DB로 교체 (`force-dynamic`)
4. 댓글(`Comment`)은 커뮤니티가 잠겨 있으므로 목업 그대로 둔다 — P8에서 함께 연다.

**참고**: `features/journal/*`와 `features/portfolio/*`가 그대로 본보기다.
repository → schema → actions → ui 순서로 같은 모양을 만들면 된다.

## 7. 운영 절차

옵시디언 `05_Methodology/Woodsman 사이트 운영방법.md`에 있다.

```bash
cd web
npm run dev            # 로컬 (로컬 D1 사용)
npm run db:setup       # 로컬 D1 마이그레이션 + 시드
npm run check          # ⚠ dev를 먼저 끄고 실행 (Windows에서 .next가 깨진다)
npm run cf:deploy      # 수동 배포 (평소엔 push로 자동)
npm run ai:sync        # .env의 AI 키를 Cloudflare 시크릿으로
npm run admin:set      # 관리자 계정 변경 (대화식)
npm run admin:apply    # .env에 적힌 값으로 관리자 계정 반영 (비대화식)
```

---

*문서 버전 v2.1 · 2026-08-06(P4 완료 반영) · 이전 버전: `woodsman_개발요구서_v1.md`(구상 단계 기록)*
