---
name: release-log
description: 배포가 성공하면 그 배포의 가설을 `/admin/releases`(운영 D1 `SiteRelease`)에 기록한다. CHANGELOG의 「배포 전 가설」을 읽어 `web/scripts/release-log.mjs`로 넣고, 빠진 배포가 있는지도 대조한다. 사용자가 "/release-log", "배포 기록", "릴리스 기록", "가설 붙여 줘", "releases에 적어 줘"라고 할 때, 그리고 **main에 push한 배포가 GitHub Actions에서 성공한 직후 자동으로** 사용한다.
---

# release-log — 배포 가설은 사람이 붙이지 않는다

## 왜 이 스킬이 있나

`web/CLAUDE.md` §7 — 「배포할 때마다 `/admin/releases`에 **가설과 함께** 기록한다.」
이 일은 운영자가 관리자 화면에서 손으로 붙이는 것이었고, **9/19 뒤로 한 건도 붙지 않았다**
(9/20 GCRM 운영 배포 ~ 9/26 (70)). 운영자 결정(2026-09-26): 「붙이는 것은 스킬에 담아 둬요.」

⚠ 기록이 빠지면 `/admin/releases`의 효과 판정(`lib/release-effect.ts`)이 **겹친 배포를 못 알아본다** —
데이터 배포가 홈 줄을 바꾼 날의 클릭 변화를 화면 배포의 효과로 읽게 된다.

## 언제

- main push → **Deploy to Cloudflare Workers 성공을 확인한 직후.** 실패한 배포는 기록하지 않는다.
- 사용자가 요청할 때.
- ⚠ 커밋만 하고 push 안 한 것은 배포가 아니다. 기록하지 않는다.

## 절차

1. **배포 확인** — `gh run list --limit 3` → 해당 run의 `gh run view <id> --json conclusion,headSha,updatedAt`.
   `conclusion`이 `success`가 아니면 멈춘다. 시각은 `updatedAt`(배포 끝난 시각, UTC).
2. **가설 읽기** — `web/CHANGELOG.md`에서 그 커밋의 절(`## 날짜 (번호) — 제목`)과 **「배포 전 가설」** 목록.
   ⚠ 가설을 지어내지 않는다. CHANGELOG에 가설이 없으면 기록하지 말고 운영자에게 알린다(가설 없는 기록은 사후 정당화가 된다).
3. **값 고르기**
   | 칸 | 규칙 |
   |---|---|
   | `--id` | `rel_YYYYMMDD_짧은이름` (배포 날짜 KST · 소문자·숫자·밑줄) |
   | `--title` | CHANGELOG 절 제목을 한 줄로 · 앞에 `(번호)`를 붙이지 않아도 된다 |
   | `--kind` | 배치 `LAYOUT` · 문구 `COPY` · 메뉴 `NAV` · 디자인 `VISUAL` · **데이터·모델·콘텐츠 `CONTENT`** · 고침 `FIX` |
   | `--metric` | 기본 **`TISTORY_CLICK`**(1순위). 읽기 경험만 바꾼 것은 `VIEWS` |
   | `--commit` | 배포된 커밋 앞 7자리(`headSha`) |
   | `--hypothesis` | 가설 번호를 이어 한 문단 + **티스토리 클릭에 영향이 있을지 한 줄**(없어야 하면 없어야 한다고) + `CHANGELOG (번호)` |
4. **모의 실행 먼저** — `cd web && node scripts/release-log.mjs ... --dry-run`. 출력(제목·종류·가설)을 한 번 읽는다.
5. **넣기** — 같은 명령에서 `--dry-run`만 뺀다. 스크립트가 같은 id·같은 커밋이 있으면 넣지 않고 멈춘다(종료 2).
   ⚠ 운영 D1에 쓰는 일이다. 스크립트는 `--command`로 한 줄만 넣는다(`--file` 금지 — CLAUDE.md §4).
6. **대조** — 기록 뒤 최근 `SiteRelease`와 최근 배포 run을 맞춰 본다. 빠진 배포가 보이면 **목록으로 알린다**
   (지난 것을 멋대로 채우지 않는다 — 가설이 CHANGELOG에 있는 것만, 운영자 확인 뒤 `rel_..._backfill`로).
7. **보고** — 사용자에게 한국어로: 기록한 id·제목·가설 요약, 그리고 「/admin/releases에서 보인다」.
   CHANGELOG의 그 절 끝에 `기록: /admin/releases rel_…` 한 줄을 더한다.

## 하지 않는 것

- 가설을 만들어 넣지 않는다. 결과(검증)를 가설 칸에 적지 않는다 — 결과는 CHANGELOG의 「확인」 절이다.
- 한 배포를 두 번 기록하지 않는다. 배포 여럿을 한 줄로 묶지 않는다(변경은 하나씩 — 기록도 하나씩).
- 지우기는 관리자 화면에서 사람이 한다(`deleteReleaseAction` — 관리자 로그가 남는다).
