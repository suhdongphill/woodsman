# 개발 로그

변경 사항을 **모듈 단위로** 기록합니다. 커밋 메시지 대신 사람이 읽는 기록으로 남깁니다.

작성 규칙

- 날짜(YYYY-MM-DD) → 주제 → **모듈별**로 나눠 적습니다.
- "무엇을 바꿨나"보다 **"왜 그렇게 했나"**를 남깁니다. 코드를 보면 알 수 있는 건 생략합니다.
- 되돌리면 안 되는 결정(정책·보안·데이터)에는 ⚠ 를 붙입니다.

---

## 2026-08-02 — ⚠ 런타임에서 Prisma 제거, D1 직접 사용 (배포가 조용히 죽던 문제)

### 무슨 일이 있었나

배포는 성공하고 화면도 떴는데 **모든 DB 호출이 실패**하고 있었다.
그런데 실패 결과가 "설정이 비어 있는 정상 상태"와 똑같아 보여서 알 수가 없었다
(커뮤니티 닫힘 = 정책이기도 하고 DB 실패 시 폴백이기도 했다).

D1에서 `communityEnabled=1`로 바꿔도 사이트가 안 바뀌는 걸 보고 확정했다.

### 원인 (셋이 겹쳤다)

1. `prisma-client-js` 생성기는 **바이너리 쿼리 엔진**을 찾는다 → Workers엔 실행 파일이 없다
2. `prisma-client` + `runtime="cloudflare"`로 바꾸니 **WASM 엔진**을 찾는데,
   OpenNext가 만든 Worker 번들에 그 .wasm이 포함되지 않는다
   (opennextjs-cloudflare #471 / prisma #23457 — 2026-08 기준 **미해결**)
3. `getCloudflareContext()`를 동기로 부르면 정적 생성 단계에서 실패한다 → `{ async: true }` 필수

### 결정: Prisma는 스키마·마이그레이션 도구로만 남긴다

런타임 쿼리는 **D1 바인딩을 직접** 쓴다(`src/lib/d1.ts`). 우리가 쓰는 쿼리는 6개뿐이라
ORM을 억지로 얹을 이유가 없었다. 얻은 것:

- 배포가 **실제로 동작한다** (가장 중요)
- `next.config.ts`의 우회 두 개(WASM 실험 플래그, 파일트레이싱 제외)가 **전부 불필요해져 삭제**
- 의존성 3개 제거(`@prisma/client`, `@prisma/adapter-d1`, `@auth/prisma-adapter`), 번들 축소
- 로컬/운영 DB 경로가 **하나로 통일**됨 (`next dev`도 로컬 D1을 쓴다)

`prisma/schema.prisma`는 여전히 스키마의 원본이고, 마이그레이션도 계속 Prisma로 만든다.

### 재발 방지

- ⚠ **조용한 폴백을 만들지 않는다.** DB에 못 붙는 상태가 "정상"처럼 보이면 안 된다.
  실패는 던지고, 호출부가 로그를 남긴 뒤 안전한 기본값으로 응답한다.
- ⚠ 도메인 쿼리는 각 기능의 repository 모듈에 모은다
  (`features/auth/repository.ts`, `lib/outbound-repo.ts`).
- Auth.js 어댑터는 뗐다. 지금은 JWT + Credentials라 필요 없다.
  소셜을 열 때는 `@auth/d1-adapter`를 붙이면 된다(스키마에 Account/Session은 이미 있다).

### 클릭 집계가 적게 잡히던 문제

`/go/*` 리다이렉트가 캐시돼 두 번째 호출부터 Worker가 실행되지 않았다(3회 중 1회만 집계).
`next/navigation`의 `redirect()` 대신 `cache-control: no-store`를 붙인 Response를 직접 돌려준다.
검증: 7회 호출 → 정확히 7 기록.

---

## 2026-08-02 — 티스토리 트래픽 유도 우선 재배치 + 유입 측정

운영자가 밝힌 **1순위 목적: 티스토리 블로그로 트래픽을 보내는 것.**
사이트 체류나 광고 수익이 아니다. 그 기준으로 자리 배치를 다시 했다.

### `features/site/ui/TistoryCta.tsx` (신규) — 유도 CTA

- ⚠ **글 본문 끝 자리를 광고가 아니라 CTA가 차지한다.** 광고는 그 아래로 밀린다.
  자리 경쟁이 붙으면 트래픽 유도가 이긴다.
- 배치: 인사이트 상세(prominent) · 인사이트 목록 · 홈 · 투자일지(compact).
- 원문이 이미 티스토리인 글에는 CTA를 겹쳐 붙이지 않는다(위에 원문 링크가 이미 있다).

### `lib/outbound.ts` · `app/go/[target]/route.ts` · `OutboundClick` 모델 (신규) — 유입 측정

- 외부로 나가는 클릭은 우리 서버에 흔적을 남기지 않는다. `/go/tistory`를 경유해
  302로 넘기면서 카운트만 남긴다. **성과 판단 기준이 "몇 명이 넘어갔나"라서** 필요하다.
- ⚠ **오픈 리다이렉트 방지**: 목적지를 쿼리로 받지 않는다. 등록된 대상과, 우리가
  저장해 둔 글의 원문 URL만 허용한다. `outbound.test.ts`가 공격 문자열들을 검사한다.
- ⚠ 집계 실패가 이동을 막지 않는다. DB가 죽어도 사용자는 블로그로 가야 한다.
- 쿠키·IP·UA를 저장하지 않고 날짜별 합계만 센다 — 개인정보 처리방침과 어긋나지 않는다.
- KST 기준으로 하루를 자른다. UTC로 자르면 밤 9시 이후 클릭이 다음 날로 넘어간다.

### `features/site/ui/OutboundStats.tsx` — 관리자 대시보드 최상단

- 1순위 지표를 맨 위에 뒀다. 오늘·최근 7일·누적과 일별 추이.

### 티스토리 원문 글의 canonical

- ⚠ `source=TISTORY` 글은 **canonical을 원문 URL로** 지정한다. 우리가 순위를
  가져가는 게 아니라 원문으로 트래픽이 모이는 게 목적이고, 중복 콘텐츠로 서로
  순위를 깎는 것도 막는다.

---

## 2026-08-02 — 광고 노출 설계 (AdSense 자리 배치)

스크립트만 넣는 것과 광고 자리를 만드는 것은 별개다. 자리를 코드로 고정하고,
켤지 말지는 환경변수로 분리했다.

### `lib/ads.ts` (신규) — 배치 정책

- 자리는 세 곳: `article-end`(본문 끝) · `feed-end`(목록 하단) · `content-bottom`(홈·일지 하단).
- ⚠ **퍼블리셔 ID와 슬롯 ID가 둘 다 있어야** 광고를 그린다. 슬롯 없이 `ins`만 넣으면
  빈 영역이 남고, 오타난 ID로 요청을 쏘면 계정 문제로 이어질 수 있다.
- 형식 검증(`ca-pub-` + 숫자, 슬롯은 숫자)을 통과한 값만 유효로 본다 — 자리표시자가
  그대로 배포되는 사고를 막는다.

### `components/analytics/AdSlot.tsx` · `AdUnit.tsx` (신규)

- 배치 판단은 서버(`AdSlot`), `adsbygoogle.push`는 클라이언트(`AdUnit`)로 나눴다.
- ⚠ 같은 유닛에 push를 두 번 하면 AdSense가 오류를 낸다. React 개발 모드가 effect를
  두 번 실행하므로 ref로 한 번만 밀어 넣는다.
- 자리마다 `minHeight`를 잡아 로드 후 콘텐츠가 밀리지 않게 했다(CLS).
- "광고" 라벨을 붙인다 — 콘텐츠로 오인되면 정책 위반이다.

### 배치 원칙 (`ads.test.ts`가 강제)

- 첫 화면은 광고 없이 콘텐츠로 시작한다. 다 읽은 자리에만 둔다.
- 버튼·페이지네이션과 떨어뜨려 오조작을 피한다. 실수 클릭은 수익이 아니라 정지 사유다.
- ⚠ **관리자·로그인·회원가입·정책 문서 화면에는 넣지 않는다.** 테스트가 소스를 훑어
  이 규칙을 검사한다.

---

## 2026-08-02 — Cloudflare 배포 · 자동화 · 수익화 준비

GitHub 공개 저장소로 올리고, push하면 자동 배포되도록 파이프라인을 붙였습니다.

### `wrangler.jsonc` · `open-next.config.ts` (신규) — Workers 배포

- Next.js는 그대로 안 올라가서 `@opennextjs/cloudflare`가 `.open-next/worker.js`로 변환합니다.
- ⚠ `migrations_pattern`을 지정해야 합니다. Prisma는 마이그레이션을
  `prisma/migrations/<타임스탬프>/migration.sql`로 만드는데, wrangler 기본 패턴은
  `*.sql`이라 **하나도 못 찾고 "No migrations to apply"로 조용히 넘어갑니다.**
- ⚠ 대시보드의 Worker 이름과 `name`이 같아야 빌드가 성공합니다.

### `lib/db.ts` — 로컬/운영 이중 지원

- ⚠ `db` 싱글턴 export를 **`getDb()` 비동기 함수로** 바꿨습니다. D1 바인딩은 요청
  컨텍스트에서만 보여 모듈 최상단에서 클라이언트를 만들 수 없습니다.
- 판단 기준은 "D1 바인딩이 실제로 붙어 있는가" 하나입니다. `NODE_ENV` 같은 값으로
  추측하면 로컬은 되는데 배포만 죽는 상황을 만듭니다.
- `auth.ts`는 `NextAuth(async () => config)` 형태로 바꿔 요청마다 DB를 얻습니다.

### `scripts/generate-d1-seed.mjs` (신규) — D1 시드

- `npm run db:seed`는 파일 SQLite에 직접 쓰므로 원격 D1에는 못 씁니다. 같은
  시드 데이터로 SQL을 만들어 `wrangler d1 execute`로 밀어 넣습니다.
- ⚠ 산출물 `prisma/seed.d1.sql`에는 **관리자 비밀번호 해시**가 들어갑니다. gitignore 대상.
- 로컬 D1(`--local`)에 마이그레이션 + 시드를 실제로 돌려 검증했습니다.

### ⚠ 정책을 읽는 페이지의 정적 생성 버그 (수정)

- `/board`, `/board/[id]`, `/insights/[slug]`가 `generateStaticParams`로 **정적 생성**되면서
  `getSitePolicy()`를 호출하고 있었습니다. 즉 빌드 시점의 "커뮤니티 닫힘" 판정이 그대로
  구워져, **나중에 관리자가 스위치를 켜도 페이지가 열리지 않습니다.**
- `export const dynamic = "force-dynamic"`로 바꾸고 `generateStaticParams`를 제거했습니다.
- 같은 실수가 재발하지 않도록 `site-policy.test.ts`가 소스를 훑어
  "정책을 읽는 페이지 + generateStaticParams" 조합을 금지합니다.
- `robots.ts`도 같은 이유로 동적입니다 — `SITE_URL`이 런타임 값이라, 정적으로 구우면
  "전체 색인 금지"가 박제됩니다.

### `.github/workflows/deploy.yml` (신규) — 자동 배포

- main에 push → 품질 게이트(typecheck·lint·test) 통과 → D1 마이그레이션 → 빌드·배포.
- ⚠ 게이트를 통과해야만 배포합니다. 안 그러면 "배포는 됐는데 깨진" 상태를 나중에 압니다.
- ⚠ 마이그레이션을 배포보다 **먼저** 적용합니다. 새 컬럼을 기대하는 코드가 옛 스키마를
  만나면 배포 직후 500이 납니다.
- OpenNext가 Windows를 완전히 지원하지 않는다고 경고합니다. CI(Linux)에서 배포하는
  이 방식이 로컬 배포보다 안전합니다.

### `app/robots.ts` · `sitemap.ts` · `ads.txt/route.ts` · `components/analytics/AdSense.tsx` (신규)

- ⚠ `SITE_URL`이 비어 있으면 robots가 **전체 차단**입니다. 도메인이 정해지기 전에
  미리보기 주소(`*.workers.dev`)가 색인되면 나중에 정리하기 어렵습니다.
- sitemap은 닫힌 영역(커뮤니티)과 티스토리 원문 링크 글을 제외합니다 — 404나 중복을
  색인 요청하지 않기 위해서입니다.
- `ADSENSE_CLIENT_ID`가 없으면 광고 스크립트도 `/ads.txt`도 나가지 않습니다.
  자리표시자를 커밋해 두면 그대로 배포될 위험이 있어 아예 환경변수로만 받습니다.

---

## 2026-08-02 — 콘텐츠 사이트로 전환 (베타)

가입자를 받는 커뮤니티 플랫폼에서 **운영자 1인이 계좌와 판단을 공개하는 블로그**로
성격을 바꿨습니다. 커뮤니티 기능은 나중에 열기 위한 준비물이라 **지우지 않고 잠갔습니다.**

### `lib/site-policy.ts` (신규) — 사이트 개방 정책

- 가입·커뮤니티·댓글 개방 여부를 판단하는 순수 함수. DB의 `SiteConfig` 스위치를 읽습니다.
- ⚠ 기본값은 **전부 닫힘**. 설정 조회에 실패해도 닫는 쪽으로 떨어집니다 — 조회 실패를
  이유로 커뮤니티가 열리는 사고를 막기 위해서입니다.
- ⚠ 커뮤니티가 닫혀 있으면 댓글도 열리지 않습니다. 스위치 하나를 잊어 글쓰기 창구가
  열리는 조합을 만들지 않습니다.
- `site-policy.test.ts`가 이 규칙을 고정합니다.

### `lib/site-settings.ts` (신규) — 설정 조회

- 요청 단위 캐시(`react.cache`)로 SiteConfig를 한 번만 읽습니다. 실패 시 닫힌 정책 반환.

### `lib/site-status.ts` · `features/site/ui/RoadmapTimeline.tsx` · `components/layout/BetaBanner.tsx` (신규) — 단계와 비전

- **말**(단계·로드맵 문구)과 **동작**(기능 개방)을 분리했습니다. 여기는 말, `site-policy`는 동작.
- 상단 베타 배너는 닫기 버튼이 없습니다 — 수치와 기능이 계속 바뀌는 동안에는 계속
  보이는 편이 정직하다고 판단했습니다. `SITE_STAGE`를 `"OPEN"`으로 바꾸면 사라집니다.
- `site-status.test.ts`가 **말과 동작의 일치**를 검사합니다. 로드맵에 "커뮤니티 예정"이라
  적혀 있는데 실제 스위치가 열려 있으면 테스트가 깨집니다.
- 로드맵에 "곧 오픈" 같은 시점 확정 표현을 금지하는 테스트도 넣었습니다.

### `components/brand/Logo.tsx` — 로고 교체 + 관리자 진입

- 인라인 SVG를 실제 엠블럼(`public/woodsman-logo.jpg`, `logo-data-uri.txt`에서 추출)으로 교체.
- ⚠ **로고 더블클릭 = 관리자 로그인.** 공개 메뉴에 로그인 링크를 두지 않으므로 이게
  유일한 진입 경로입니다. 첫 클릭은 평범한 홈 링크라 크롤러·키보드 사용자에게는 그대로입니다.

### `components/layout/TopNav.tsx` · `Footer.tsx` · `app/(public)/layout.tsx`

- 로그인·회원가입 버튼과 커뮤니티 메뉴를 정책에 따라 조건부로 바꿨습니다.
- 내비게이션에 `투자일지`를 추가하고, 푸터를 콘텐츠/안내 두 열로 나눠 정책 문서를 노출했습니다.

### `app/(public)/register` · `login` — 가입 차단

- ⚠ 가입 폼을 지우지 않고 `signupEnabled`로 감쌌습니다. 꺼져 있으면 **"아직 회원가입은
  지원하지 않습니다"** 안내와 그 이유를 보여줍니다. 죽은 폼을 남기면 광고·검색 심사에서
  동작하지 않는 기능으로 읽힙니다.
- 로그인 화면은 `noindex`, 제목도 "운영자 로그인"으로 바꿨습니다.

### `app/(public)/board` — 커뮤니티 차단

- 커뮤니티가 닫혀 있으면 목록·상세 모두 404. 링크만 숨기고 페이지를 남기면 검색엔진에
  빈 커뮤니티가 노출됩니다.

### `features/comments/ui/CommentSection.tsx`

- `open` / `showAuthLinks` prop 추가. 닫혀 있으면 입력창 대신 "댓글은 아직 열지
  않았습니다 · 의견은 이메일로" 안내를 보여줍니다.

### `app/(public)/about` · `disclaimer` · `privacy` (신규) — 정책 문서

- ⚠ **투자 판단 책임 고지**: 정보 제공 목적, 투자자문업자 아님, 과거 성과가 미래를
  보장하지 않음, 이해관계(보유 종목) 고지.
- ⚠ **개인정보 처리방침**: "회원가입을 지원하지 않으며 회원 개인정보를 수집하지 않는다"를
  명시. 가입을 열기 전에 **이 문서를 먼저 갱신**해야 합니다(관리자 화면에도 경고 문구 추가).
- `components/layout/PolicyPage.tsx`로 문서 껍데기를 공용화하고 시행일을 함께 표기합니다.

---

## 2026-08-02 — 계좌 공개와 투자일지 (주력 콘텐츠)

"운용자가 자기 계좌를 보여주는" 형태로 포트폴리오를 다시 짰습니다.

### `prisma/schema.prisma` — 모델 추가

- `AccountSnapshot` — 월 1회 계좌 스냅샷(납입원금·평가액·누적 배당).
- `JournalEntry` — 매수/매도/리밸런싱/관찰 기록. 체결 수량·단가를 함께 남깁니다.
- `SiteConfig.signupEnabled` / `communityEnabled` 추가(기본 false).
- 마이그레이션: `20260802051202_site_mode_journal_snapshot`

### `lib/performance.ts` (신규) — 성과 계산

- ⚠ **납입원금 기준 수익률만** 계산합니다. TWR처럼 입금 시점을 지우는 지표는 쓰지
  않습니다 — "내가 넣은 돈이 얼마가 됐나"가 이 사이트가 답하는 질문이라서입니다.
- 원금을 밑돈 적이 없으면 '최악 구간'을 만들어내지 않습니다(없는 걸 있는 척하지 않음).
- `performance.test.ts`가 계산과 함께 **손실 구간이 데이터에 남아 있는지**도 검사합니다.

### `features/portfolio/ui/CapitalFlowChart.tsx` (신규) — 자금 흐름 차트

- 같은 단위(원)이므로 **축은 하나**만 씁니다(이중 축 금지).
- 원금은 **면적**, 평가액은 **선** — 색이 아니라 형태로 구분되어 색각 이상에서도 안 섞입니다.
- 둘 사이의 간격이 곧 손익이라 위로 벌어지면 초록, 아래로 벌어지면 빨강으로 채웁니다.
- 팔레트(`#36a06a` 선 / `#d8bd7a` 리밸런싱 마커)는 색각·대비 검증을 통과한 조합입니다.
- 크로스헤어 툴팁 + "숫자로 보기" 표를 함께 제공합니다(색·마우스 없이도 읽히도록).
- **초기 버그**: 손익 영역 클립을 반대로 써서 수익 구간이 빨갛게 칠해졌습니다. 화면을
  실제로 띄워 보고 발견 — 클립 이름을 `underValue`/`overValue`로 바꿔 헷갈리지 않게 했습니다.

### `features/portfolio/ui/JournalTimeline.tsx` (신규) — 투자일지

- 근거만 있고 숫자가 없으면 사후에 쓴 글과 구분되지 않으므로 체결 정보를 함께 보여줍니다.

### `app/(public)/journal` (신규) · `portfolio` · `page.tsx`(홈)

- 홈에서 가입 유도 퍼널을 걷어내고 계좌 요약 · 자금흐름 · 운영 원칙 · 최근 투자일지로 재편.
- 포트폴리오 상단에 성과 요약과 자금흐름 곡선을 배치하고, 리밸런싱 이력은 투자일지로 흡수.

### `app/admin/journal` (신규) · `admin/comments`

- 투자일지 작성과 월 스냅샷 입력 화면(현재 목업 UI). 사이드바에 메뉴 추가.
- 관리자 댓글 화면 맨 위에 **"사이트 개방"** 스위치 카드를 넣었습니다.

### `lib/site-links.ts` (신규) — 외부 채널

- 티스토리 주소를 한곳에서 관리합니다. 홈 배너·푸터·RSS 시드가 함께 따라갑니다.
- 현재 값: <https://suhdp.tistory.com/2> (기존 목업의 `woodsman.tistory.com`은 실제 주소로 교체)

---

## 2026-08-02 — Phase 2: 인증 · 권한

### `lib/auth.config.ts` · `auth.ts` — 설정 분리

- 미들웨어는 Edge에서 돌아 Prisma·bcrypt를 못 씁니다. 그래서 Edge 안전판(`auth.config.ts`)과
  완전판(`auth.ts`)으로 나눴습니다.
- ⚠ **`trustHost: true`** — 없으면 자체 호스팅 프로덕션에서 Auth.js가 모든 요청을
  `UntrustedHost`로 막아 로그인이 통째로 실패합니다. 개발 서버는 localhost를 자동 신뢰해
  드러나지 않고, 프로덕션 빌드로 띄워야 재현됩니다. 배포 시 `.env`의 `AUTH_URL`을 함께 설정하세요.
- 세션은 JWT 전략(Credentials가 DB 세션을 지원하지 않고, 미들웨어가 DB 없이 role을 읽어야 함).

### `lib/access.ts` · `middleware.ts` — 접근 정책

- 판단을 순수 함수로 분리해 미들웨어와 서버 컴포넌트가 같은 규칙을 씁니다.
- ⚠ Next.js는 `matcher`를 빌드 타임 리터럴로만 읽어 상수를 참조할 수 없습니다. 그래서
  `access.test.ts`가 미들웨어 소스를 읽어 두 곳이 어긋나지 않는지 대조합니다.
- ⚠ `/admin`은 미들웨어 + 레이아웃(`requireAdmin`) 이중 확인. matcher 실수 한 번에 전
  구역이 열리지 않도록.

### `features/auth/` — 로그인·회원가입

- ⚠ 가입은 항상 `USER`. `role`이 스키마에 없어 폼으로 승격할 수 없습니다.
- ⚠ 로그인 실패 사유를 구분해 알려주지 않습니다(계정 존재 여부 노출 방지).
- ⚠ 복귀 경로 `next`는 같은 사이트 절대경로만 허용(오픈 리다이렉트 방지).
- `"use server"` 파일은 async 함수 외에는 export할 수 없어 상수를 `form-state.ts`로 뺐습니다.

### `next.config.ts` — Windows 빌드 실패 대응

- ⚠ Prisma 생성 클라이언트를 파일 트레이싱에서 제외합니다. `src/generated/prisma`에
  번들된 dotenv의 `os.homedir()`를 Next 트레이서가 정적 평가해 홈 디렉터리 전체를 glob하고,
  Windows의 접근 불가 정션(`Application Data`)에서 EPERM으로 빌드가 죽습니다.
  node_modules 안이면 기본 무시 규칙에 걸리는데, `src/` 아래라 비껴갑니다.
- Next 업그레이드로 이 훅이 안 먹으면 빌드가 다시 EPERM으로 실패하므로 조용히 망가지진 않습니다.
