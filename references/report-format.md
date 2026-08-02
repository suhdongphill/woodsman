# WoodsMan 보고서 포맷 — 네이비-시안 HTML 디자인 시스템

> 이 파일은 HTML 보고서를 실제로 출력할 때만 로드한다.

## 디자인 시스템 (CSS 변수)

```css
:root{
  --bg:#0b1220;        /* 배경: 다크 네이비 */
  --panel:#101a2e;     /* 패널 */
  --panel2:#0d1626;    /* 서브 패널 */
  --line:#1e2c47;      /* 보더 */
  --cyan:#34d6ff;      /* 포인트: 일렉트릭 시안 */
  --cyan-dim:#1a8fb3;
  --amber:#ffb347;     /* 경고/확인필요 */
  --red:#ff6b7a;       /* 리스크/감점 */
  --green:#4ade9c;     /* 긍정/가점 */
  --txt:#dbe6f5;       /* 본문 */
  --sub:#8fa3c0;       /* 보조 텍스트 */
  --mono:'JetBrains Mono','Consolas',monospace;
}
```

- 폰트: Pretendard Variable (CDN: jsdelivr orioncactus/pretendard), fallback Malgun Gothic
- 레이아웃: `max-width:960px`, 카드형 패널(`border:1px solid var(--line); border-radius:14px`)
- 헤더: `linear-gradient(135deg,#101a2e 0%,#0b1220 60%)`
- 수치·티커·계산식은 `--mono` 폰트

## 데이터 태그 규칙 (정직성 원칙의 시각화)

| 태그 | 의미 | 색 |
|---|---|---|
| `확인` | 1차 자료로 검증된 수치 (출처+기준일 병기) | green |
| `확인 필요` | 지식 기준일 이후이거나 추정 — 사용 전 재확인 | amber |
| `N/A` | 데이터 부재 — 점수 산출하지 않음 | sub |

## 보고서 표준 구조

1. **헤더**: 종목명 · 티커 · 보고서 버전 · 기준일
2. **투자 논지(Thesis)**: 1~3문장
3. **CANSLIM 매트릭스**: 7항목 점수표 + 근거 1줄 + 출처 (7축 레이더 병기 가능)
4. **종합 점수**: 100점 + composite10 + 등급 밴드 + M 게이트 판정
5. **(선택) 오버레이**: 컨센서스 갭 ±10 + 근거
6. **(선택) 밸류에이션**: SOTP / 시나리오 밴드(불·기준·약세)
7. **(선택) 진입 타이밍**: 미너비니 VCP 관점
8. **리스크 매트릭스**: 확대/축소 트리거 명시
9. **푸터 고지**: "WoodsMan Framework · 본 문서는 채점 방법론이며 투자 자문이 아님.
   비중·시점은 본인 판단 및 필요 시 전문가 상담."

## 출력 변형

- **기본**: 단일 HTML 파일 (다운로드용)
- **Tistory 블로그용**: premailer로 CSS 클래스 → 인라인 style 변환,
  grid → flex-wrap(모바일 호환), 테이블은 가로 스크롤 컨테이너로 감싸기,
  HTML 모드로 붙여넣고 기본 모드로 전환 금지, 공개 게시 시 투자 고지문 포함
