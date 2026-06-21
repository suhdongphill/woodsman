# Woodsman 로고 적용 — CLI 작업 지시서

## 사전 작업

1. 같이 받은 `logo-data-uri.txt` 파일을 `index.html`이 있는 같은 폴더에 둡니다.
2. 이 파일 안에는 `data:image/jpeg;base64,...`로 시작하는 한 줄의 매우 긴 문자열이 들어있어요. 이게 로고 이미지 전체를 데이터 URI로 인코딩한 것입니다.
3. 아래 지시 2번에서 이 문자열을 코드에 붙여넣을 거예요.

⚠️ 참고: 파일명이 `.png`로 받았지만 실제로는 JPEG 포맷입니다. 그래서 데이터 URI도 `data:image/jpeg;base64,`로 시작합니다.

---

## 지시 1 — 상수 영역에 LOGO_DATA_URI 선언 추가

`/* ═══ Constants ═══ */` 블록에 로고 상수를 추가합니다. STORAGE_KEY 바로 위에 한 줄을 끼워넣어요.

### [찾기]
```js
    /* ═══ Constants ═══ */
    const STORAGE_KEY = 'stocklens_portfolio';
```

### [교체]
```js
    /* ═══ Constants ═══ */
    const LOGO_DATA_URI = '여기에_logo-data-uri.txt_파일의_내용을_그대로_붙여넣기';
    const STORAGE_KEY = 'stocklens_portfolio';
```

**중요**: 위의 `'여기에_logo-data-uri.txt_파일의_내용을_그대로_붙여넣기'` 부분을 `logo-data-uri.txt` 파일 내용으로 교체하세요. 작은따옴표 안에 통째로 들어가야 하고, **줄바꿈 없이 한 줄**이어야 합니다. 시작은 `'data:image/jpeg;base64,/9j/4AAQ...` 끝은 `...//Z'` 형태가 됩니다.

CLI에서 sed로 자동 삽입하려면:
```bash
LOGO_URI=$(cat logo-data-uri.txt | tr -d '\n')
# 위 [교체] 블록을 sed로 처리할 때 LOGO_URI를 변수로 활용
```

또는 더 간단하게 — 에디터에서 `여기에_logo-data-uri.txt_파일의_내용을_그대로_붙여넣기` 부분을 그냥 파일 내용으로 통째 치환하면 됩니다.

---

## 지시 2 — 헤더 로고 SVG를 `<img>` 태그로 교체

이전 1단계 작업에서 적용한 SVG 나이테 로고를 PNG 로고로 교체합니다.

### [찾기]
```jsx
          <div className="w-9 h-9 rounded-lg bg-forest/20 border border-gold/30 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="13" r="6" stroke="#c9a657" strokeWidth="1" opacity=".5"/>
              <circle cx="12" cy="13" r="4" stroke="#c9a657" strokeWidth="1" opacity=".7"/>
              <circle cx="12" cy="13" r="2" fill="#c9a657" opacity=".9"/>
              <path d="M5 19 L7 16 L4 16 L6 13 L4 13 L6 10 L8 10 L8 7 L10 9" stroke="#2d7a4f" strokeWidth="1.3" strokeLinejoin="round" fill="none" opacity=".85"/>
            </svg>
          </div>
```

### [교체]
```jsx
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-gold/30 flex items-center justify-center bg-black">
            <img src={LOGO_DATA_URI} alt="Woodsman" className="w-full h-full object-cover" />
          </div>
```

**디자인 메모**:
- `overflow-hidden`: 둥근 모서리 안으로 이미지가 깔끔하게 잘리도록
- `bg-black`: 로고 배경(짙은 검정)과 매끄럽게 이어지도록 컨테이너 배경도 검정으로
- `object-cover`: 정사각형 컨테이너에 꽉 차게
- `bg-forest/20`은 제거: PNG 자체에 색이 있으므로 배경 틴트가 색을 혼탁하게 만듦

---

## 검증 명령

```bash
# 상수가 정상 선언됐는지
grep -n "LOGO_DATA_URI" index.html

# 헤더 img 태그가 들어갔는지
grep -n 'src={LOGO_DATA_URI}' index.html

# 파일 크기 (대략 73KB 증가했을 것)
ls -lh index.html
```

위 두 grep이 각각 출력되어야 하고, 파일 크기가 처음보다 약 73KB 늘어 있으면 정상입니다.

---

## 적용 후 확인 사항

브라우저에서 `index.html`을 열어 다음을 체크하세요:

1. **헤더 왼쪽 로고가 보이는가** — 36x36 크기 둥근 사각형 안에 로고 표시
2. **로고 가장자리가 깨끗한가** — 둥근 모서리 따라 부드럽게 잘렸는지
3. **로고 배경과 헤더 배경이 자연스러운가** — 미세한 경계가 거슬리는지

만약 **로고 둘레에 어색한 사각형 자국**이 보이면, 컨테이너의 `bg-black`을 `bg-forest/40`이나 `bg-bg`로 바꿔보세요. 로고 PNG의 배경색에 따라 가장 잘 맞는 톤이 달라질 수 있어요.

만약 **로고가 너무 작아서 디테일이 안 보이는** 게 신경 쓰이면, 헤더 영역 사이즈를 키울 수 있어요:
- `w-9 h-9` → `w-10 h-10` (40px) 또는 `w-12 h-12` (48px)
- 단, 너무 크면 헤더 전체 높이도 같이 늘어남
