# Woodsman Web

운영자(서동필) 한 사람이 **자신의 투자 계좌와 판단 과정을 공개하는 블로그**입니다.
성장·인컴·방어로 나눈 계좌의 납입원금 대비 평가액을 그림으로 보여주고, 매매할 때마다
근거를 투자일지로 남깁니다. 종목 추천이나 유료 서비스를 하는 곳이 아닙니다.

- 스택: Next.js(App Router) · TypeScript · Tailwind CSS v4 · Prisma · SQLite(운영은 Cloudflare D1)
- 디자인: 기존 앱의 토큰(다크 + 골드 + 에메랄드)을 100% 이식
- 현재 단계: **Phase 2 — 인증/권한 완료 + 콘텐츠 사이트로 전환**. 화면 내용은 아직
  `src/lib/mock.ts` 목업으로 그려지며, Phase 4에서 DB 데이터로 교체됩니다.

> **개발 중인 베타 사이트입니다.** 단계·비전 문구는 `src/lib/site-status.ts` 한곳에서
> 관리하고, 상단 배너와 `/about`이 같은 값을 읽습니다. 커뮤니티를 열고 안정화되면
> `SITE_STAGE`를 `"OPEN"`으로 바꾸면 배너가 사라집니다.

## 개발 방식

- **모듈로 쪼갭니다.** 판단 로직(정책·계산)은 순수 함수 모듈 `src/lib/*.ts`로 화면과
  분리하고, 화면은 `src/features/<도메인>/ui/`에 둡니다. 순수 모듈에는 테스트를 붙입니다.
- **변경 내용은 [`CHANGELOG.md`](./CHANGELOG.md)에 모듈별로 남깁니다.** "무엇을"보다
  "왜"를 적고, 되돌리면 안 되는 결정에는 ⚠ 를 붙입니다.

## 사이트 운영 모드 (중요)

지금은 **공개 회원가입과 커뮤니티를 닫아 둔 상태**입니다. 기능을 지운 게 아니라
`SiteConfig`의 스위치로 잠가 뒀습니다 — 판단은 전부 `src/lib/site-policy.ts`가 합니다.

| 스위치 | 기본값 | 끄면 벌어지는 일 |
| --- | --- | --- |
| `signupEnabled` | `false` | `/register`가 "가입 미지원" 안내로 바뀌고 상단 로그인·회원가입 링크가 사라짐 |
| `communityEnabled` | `false` | `/board`가 404, 메뉴에서 제거, 댓글도 함께 닫힘 |
| `commentsGloballyEnabled` | `true` | 커뮤니티가 켜졌을 때만 의미가 있음(둘 다 켜야 댓글이 열림) |

- **관리자 진입**: 상단에 로그인 링크가 없습니다. **Woodsman 로고를 더블클릭**하면
  `/login`으로 갑니다(`src/components/brand/Logo.tsx`). 이 화면은 `noindex`입니다.
- 여는 방법: `/admin/comments` → "사이트 개방" 카드에서 스위치를 켭니다. 코드 수정 불필요.
- **가입을 열기 전에** `/privacy`(개인정보 처리방침)의 수집 항목·목적·보유기간을 먼저
  갱신하세요. 현재 방침에는 "회원정보를 수집하지 않는다"고 명시돼 있습니다.

이 정책은 `src/lib/site-policy.test.ts`가 고정합니다 — 스위치가 조용히 열리면 테스트가 깨집니다.

## 실행 (처음 한 번)

```bash
cd web
npm install
npm run setup     # .env 생성 · AUTH_SECRET 자동생성 · 마이그레이션 · 시드
npm run dev       # http://localhost:3000
```

`npm run dev`만 실행해도 됩니다 — `predev` 훅이 준비되지 않은 상태를 감지하면 `setup`을 대신 실행합니다(이미 준비됐으면 즉시 통과).

`setup`이 관리자 비밀번호를 새로 만든 경우 **콘솔에 1회만** 표시됩니다. 값은 `.env`의 `ADMIN_PASSWORD`에 저장되어 있습니다.

## DB 명령

| 명령 | 설명 |
| --- | --- |
| `npm run setup` | 원커맨드 초기 설치(.env · generate · migrate · seed) |
| `npm run db:migrate` | 스키마 변경 후 새 마이그레이션 생성·적용 |
| `npm run db:deploy` | 기존 마이그레이션만 적용(CI·배포용) |
| `npm run db:seed` | 시드 재실행(모두 upsert라 여러 번 안전) |
| `npm run db:studio` | Prisma Studio로 데이터 확인 |
| `npm run db:reset` | DB를 비우고 다시 마이그레이션 + 시드 |

### 관리자 비밀번호를 잊었다면

`.env`의 `ADMIN_PASSWORD`를 새 값으로 바꾸고 `npm run db:seed`를 다시 실행하세요(배포 환경은 값 변경 후 재배포). 시드가 upsert로 해시를 갱신합니다. **이메일을 통한 복구는 제공하지 않으며, 로그인 화면에 기본 비밀번호 힌트를 표시하지 않습니다.**

## 인증 · 권한 (Phase 2)

Auth.js v5(next-auth beta) + Prisma 어댑터. 세션은 **JWT 전략**입니다 — Credentials 프로바이더가 DB 세션을 지원하지 않고, JWT여야 미들웨어가 DB 왕복 없이 역할을 읽습니다.

| 영역 | 규칙 |
| --- | --- |
| `/admin/*` | `role = ADMIN`만. 비로그인 → `/login?next=…`, 권한 부족 → 홈 |
| `/me/*` | 로그인 필요 (화면은 Phase 8) |
| 그 외 | 공개 |

- 규칙은 `src/lib/access.ts`의 **순수 함수**이고 `access.test.ts`가 고정합니다. 미들웨어(Edge)와 서버 컴포넌트가 같은 함수를 씁니다.
- 미들웨어는 1차 방어선일 뿐이라, `/admin` 레이아웃이 `requireAdmin()`으로 한 번 더 확인합니다.
- 가입은 **항상 `USER`**입니다. `role`은 폼 스키마에 없어 승격이 불가능하며, `ADMIN`은 시드로만 만들어집니다.
- 로그인 실패 사유(없는 계정 / 틀린 비밀번호)를 구분해 알려주지 않습니다.
- 복귀 경로 `next`는 같은 사이트 절대경로만 허용합니다(오픈 리다이렉트 방지).

### 소셜 로그인

`AUTH_GOOGLE_ID`/`SECRET`, `AUTH_KAKAO_ID`/`SECRET`이 **둘 다** 있는 것만 프로바이더로 등록되고 버튼도 그때만 보입니다. 키가 없으면 눌러도 실패하는 버튼이 남지 않습니다.

### 배포 시 주의

`AUTH_URL`에 서비스 정식 주소를 넣으세요. Auth.js는 자체 호스팅에서 `trustHost` 없이는 모든 요청을 `UntrustedHost`로 막는데(개발 서버는 localhost를 자동 신뢰해 드러나지 않습니다), 이 프로젝트는 `trustHost: true`로 열어 두었습니다. 그만큼 콜백 주소를 `AUTH_URL`로 못 박아야 Host 헤더에 휘둘리지 않습니다.

## 품질 게이트

```bash
npm run check     # typecheck → lint → test → build 순서로 전부 실행
```

개별 실행: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

## 화면 목록

`관리자` 표시된 경로는 미들웨어 + 레이아웃에서 `role = ADMIN`을 요구합니다.

| 구분 | 경로 | 설명 |
| --- | --- | --- |
| 공개 | `/` | 계좌 요약 · 자금흐름 곡선 · 운영 원칙 · 최신 인사이트 · 최근 투자일지 · 주목 종목 |
| 공개 | `/portfolio` | **납입원금 대비 평가액 곡선** · 기능별 배분 · 종목 thesis · 최근 투자일지 |
| 공개 | `/journal` | 투자일지 — 매수·매도·리밸런싱·관찰 기록(체결 수량·단가 포함) |
| 공개 | `/insights`, `/insights/[slug]` | 인사이트 목록/상세 (티스토리 원문 링크) |
| 공개 | `/stocks`, `/stocks/[ticker]` | 종목 목록/상세 (차트 · CANSLIM · 뉴스) |
| 공개 | `/about` · `/disclaimer` · `/privacy` | 사이트 소개 · 투자 판단 책임 고지 · 개인정보 처리방침 |
| 잠김 | `/board`, `/board/[id]` | 게시판 — `communityEnabled`가 꺼져 있어 현재 404 |
| 잠김 | `/register` | `signupEnabled`가 꺼져 있어 "가입 미지원" 안내를 표시 |
| 운영자 | `/login` | 로고 더블클릭으로만 도달. `noindex` |
| 관리자 | `/admin` | 대시보드(방문 · 댓글 · AI 토큰) |
| 관리자 | `/admin/model-portfolio` | 대표 포트폴리오 관리(공개여부/기능분류/thesis/목표비중) |
| 관리자 | `/admin/journal` | **투자일지 작성 · 월 계좌 스냅샷 입력** — 공개 화면의 원천 |
| 관리자 | `/admin/posts` | 콘텐츠 CRUD · 글별 댓글 on/off |
| 관리자 | `/admin/comments` | **사이트 개방 스위치** · 전역 댓글 정책 · 모더레이션 |
| 관리자 | `/admin/ai` | AI 제공자(무료 우선 폴백) · 월 토큰 캡 · 연결 상태 |
| 관리자 | `/admin/feeds` | 티스토리 RSS 등록 · 가져오기 |
| 관리자 | `/admin/home` | 히어로 · 홈 블록 편집 |
| 관리자 | `/admin/users` | 사용자 역할 관리 |

## 폴더 구조

```
prisma/
  schema.prisma      데이터 모델 (SQLite/D1 호환 — enum·@db.Text 미사용)
  seed.ts            upsert 시드 (관리자 계정은 .env 값 기준)
  migrations/        마이그레이션 이력 (커밋 대상)
scripts/
  setup.mjs          원커맨드 설치
  ensure-db.mjs      predev 훅
src/
  app/
    (public)/        공개 라우트 (TopNav + Footer 레이아웃)
    admin/           관리자 라우트 (사이드바 레이아웃)
  components/
    brand/           로고
    layout/          TopNav · Footer · 사이드바 · 페이지 헤더
    ui/              Button · Card · Badge/Chip · CanslimScore · BoardRow · StatBar · Donut · Table · Toggle …
    icons.tsx        feather 스타일 stroke 아이콘
  features/
    auth/            schema(zod) · actions(서버 액션) · form-state · ui/폼·소셜버튼
    portfolio/ui/    HoldingCard
    posts/ui/        PostCard
    comments/ui/     CommentSection (노출 규칙 서버 계산)
    stocks/ui/       StockCard · MockChart
    ai/ui/           CanslimPanel
  generated/prisma/  Prisma Client (생성물 · gitignore)
  lib/
    auth.ts          Auth.js 완전판 (Prisma 어댑터 + Credentials) — Node 전용
    auth.config.ts   Edge 안전판 (미들웨어용) — OAuth 프로바이더 · JWT 콜백
    auth-providers.ts 소셜 가용성 판정 (순수 함수, 키 값 미노출)
    access.ts        라우트 접근 정책 (순수 함수 — 미들웨어/서버 공용)
    session.ts       currentUser · requireUser · requireAdmin
    db.ts            Prisma Client 싱글턴
    env.ts           서버 전용 환경변수 검증(zod) — 클라이언트에서 import 금지
    seed-data.ts     시드 값·빌더 (DB 없이 테스트 가능)
    mock.ts          Phase 0 목업 데이터 (Prisma 스키마와 동일한 필드명)
    types.ts         도메인 타입
    format.ts        숫자·날짜·색상 헬퍼 (기존 index.html 규칙 이식)
  middleware.ts      보호 라우트 (matcher는 access.ts와 access.test.ts가 대조)
  types/next-auth.d.ts  세션·JWT에 id/role 타입 확장
```

`next.config.ts`의 웹팩 훅은 `src/generated/prisma`를 파일 트레이싱에서 제외합니다 — 그 안에 번들된 dotenv의 `os.homedir()`를 Next 트레이서가 정적 평가해 홈 디렉터리 전체를 훑고, Windows에서 `Application Data` 정션 때문에 빌드가 EPERM으로 죽습니다. 자세한 이유는 파일 주석에 적어 두었습니다.

각 feature 폴더는 Phase 1 이후 `services/`(도메인 로직)와 `schema/`(zod)를 추가해 확장합니다.

## 디자인 토큰 (변경 금지)

| 이름 | 값 |
| --- | --- |
| bg | `#0f1117` |
| card / cardHover | `#1a1d27` / `#222633` |
| border | `#2a2e3a` |
| text / muted | `#e5e7eb` / `#9ca3af` |
| gold (밝게) | `#c9a657` (`#d8bd7a`) |
| emerald | `#2f9e63` · 500 `#36a06a` · 400 `#56b98a` |

`src/app/globals.css`의 `@theme` 블록에 정의되어 있으며, `src/app/design-policy.test.ts`가 값 변경을 회귀 테스트로 막습니다.

## 보안 원칙

- **모든 시크릿은 서버 전용.** `NEXT_PUBLIC_` 접두사를 붙이지 않으며, `src/lib/env.ts`는 클라이언트 컴포넌트에서 import하지 않습니다.
- **AI API 키는 DB에 저장하지 않습니다.** `AiProvider`에는 env 변수명(`apiKeyEnv`)만 기록하고, 화면에는 "연결됨/미설정"만 표시합니다.
- 비밀번호는 bcrypt(cost 12) 해시로만 저장합니다. 72바이트를 넘는 입력은 bcrypt가 조용히 잘라내므로 가입 스키마에서 미리 막습니다.
- **권한 승격 경로를 만들지 않습니다.** 가입 스키마에 `role`이 없고, 서버 액션이 `USER`를 고정으로 씁니다.
- 로그인 실패 사유를 구분해 알려주지 않습니다(계정 존재 여부 노출 방지).
- 리다이렉트 파라미터 `next`는 같은 사이트 절대경로만 허용합니다(`//evil.com` 등 차단, `access.test.ts`).
- `.env` · `prisma/*.db` · `src/generated/`는 gitignore 대상입니다.

## 주력 콘텐츠 — 계좌 공개와 투자일지

이 사이트의 핵심 콘텐츠는 두 가지이고, 둘 다 관리자 화면(`/admin/journal`)에서 만듭니다.

| 모델 | 무엇 | 어디에 나오나 |
| --- | --- | --- |
| `AccountSnapshot` | 월 1회 계좌 스냅샷 (납입원금 · 평가액 · 누적 배당) | 홈·`/portfolio`의 자금흐름 곡선 |
| `JournalEntry` | 매수 · 매도 · 리밸런싱 · 관찰 기록 | `/journal`, `/portfolio` 하단 |

- 수익률은 **납입원금 기준**으로만 말합니다. 입금 시점을 지워버리는 TWR 같은 지표는 쓰지
  않습니다 — "내가 넣은 돈이 얼마가 됐나"가 이 사이트가 답하는 질문이기 때문입니다.
  계산은 `src/lib/performance.ts`에 있고 `performance.test.ts`가 고정합니다.
- 자금흐름 차트(`CapitalFlowChart`)는 축을 하나만 씁니다. 원금은 **면적**, 평가액은 **선**이라
  색이 아니라 형태로 구분되고, 벌어진 폭이 곧 손익입니다(수익 초록 / 손실 빨강).
  색 조합은 dataviz 검증기로 색각이상·대비를 통과시킨 값입니다.
- **손실 구간을 지우지 않습니다.** 목업·시드 데이터에도 원금을 밑돈 달이 들어 있고,
  `performance.test.ts`가 그 사실을 검사합니다.

## 외부 채널

블로그 주소는 `src/lib/site-links.ts` 한 곳에서만 관리합니다(홈 배너 · 푸터 · RSS 시드가 함께 따라감).
현재 값: <https://suhdp.tistory.com/2>

## 다음 단계

Phase 3 — 티스토리 RSS 가져오기 + 콘텐츠 CRUD를 DB에 연결(`/admin/posts`, `/admin/feeds`, `/admin/journal`).
지금 공개 화면은 여전히 `src/lib/mock.ts`를 읽습니다.

남겨둔 것:

- **기존 localStorage 데이터 가져오기 마법사** — 개인 포트폴리오 화면(`/me`)과 함께 Phase 8에서. `Portfolio`/`Holding` 모델과 `/me` 접근 규칙은 이미 준비돼 있습니다(화면만 없어 지금은 404).
- 소셜 로그인은 코드상 준비만 됐고, 실제 동작은 Google/Kakao 앱 등록 후 `.env`에 키를 넣어야 확인할 수 있습니다.
- 커뮤니티(회원가입·게시판·댓글)는 코드가 살아 있고 스위치로만 잠겨 있습니다 — 위 "사이트 운영 모드" 참고.
