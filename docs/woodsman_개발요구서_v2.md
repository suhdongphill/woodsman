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
`allocation` `performance` `outbound` `ads` `auth-providers` `format` `env-file`
`ai/catalog` `ai/persona` `ai/context` `ai/routing`

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
| `ModelHolding` | 대표 포트폴리오 종목 | ⚠ **아직 목업** — 다음 작업 |
| `Rebalance` | 리밸런싱 기록 | ⚠ 아직 목업 |
| `Post` / `Comment` | 콘텐츠·댓글 | ⚠ 아직 목업 (커뮤니티는 잠금 상태) |
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
| **P4** | **대표 포트폴리오(ModelHolding) DB화 + CRUD** | ⏭ **다음 작업** |
| P5 | 티스토리 RSS 수집 → Post DB화 | 대기 |
| P6 | AI 실제 호출 연결(지금은 라우팅·프롬프트까지만) | 대기 |
| P7 | AdSense 승인 후 광고 배치 | 대기(콘텐츠 축적 필요) |
| P8 | 커뮤니티 개방(가입·댓글) — ⚠ `/privacy` 먼저 갱신 | 조건부 |

---

## 6. 다음 세션에서 바로 할 일 (P4)

**대표 포트폴리오가 아직 목업이라 목표 비중을 화면에서 조정할 수 없다.**
투자일지와 똑같은 문제이고, 해법도 같다.

1. `features/portfolio/repository.ts` — `ModelHolding` · `Rebalance` D1 CRUD
   - `loadPublishedHoldings()` / `loadAllHoldings()` / `saveHolding()` / `deleteHolding()`
2. `features/portfolio/schema.ts` — 입력 검증
   - ⚠ **목표 비중 합계가 100%인지 검사**하고, 아니면 화면에 경고(막지는 않는다 — 작성 중일 수 있다)
3. `features/portfolio/actions.ts` + 폼 → `/admin/model-portfolio` 실제 편집
4. 공개 `/portfolio`·홈이 DB를 읽도록 교체 (`functionAllocation()` 목업 제거)
   - ⚠ 현재 비중은 **`holdingValueKrw()`로 환산 후** 계산할 것
5. 시세(`price`)는 아직 목업 값이다. 실시세 연동 전까지는 **관리자가 직접 입력**하는 필드로 두고,
   화면에 "수기 입력 기준일"을 밝힌다 — 자동으로 갱신되는 것처럼 보이면 안 된다.

**참고**: 투자일지 구현(`features/journal/*`)이 그대로 본보기다. 같은 모양으로 만들면 된다.

---

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

*문서 버전 v2.0 · 2026-08-02 · 이전 버전: `woodsman_개발요구서_v1.md`(구상 단계 기록)*
