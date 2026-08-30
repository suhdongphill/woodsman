/** 숫자·날짜 포맷 헬퍼 — 기존 index.html 포맷 규칙 이식 */

export function formatNumber(n: number, c: "KRW" | "USD" = "KRW") {
  if (c === "KRW") return n.toLocaleString("ko-KR") + "원";
  return (
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatCompact(n: number, c: "KRW" | "USD" = "KRW") {
  if (c === "KRW") {
    if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
    if (n >= 1e4) return (n / 1e4).toFixed(0) + "만";
    return n.toLocaleString("ko-KR") + "원";
  }
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

export function formatPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

/**
 * 등락 색 — **여기 한 곳에서만 정한다.**
 *
 * ⚠ 한국식이다: **상승 적색 · 하락 청색**(2026-08-30 결정). 미국과 반대다.
 * ⚠ 색만으로 등락을 말하지 않는다. 부르는 쪽은 반드시 부호(+/−)나 화살표를 함께 낸다 —
 *    `formatPct`가 이미 부호를 붙인다.
 * ⚠ `text-emerald-*`를 등락에 쓰지 않는다. 녹색은 성공·발행의 색이다.
 */
export function profitColor(v: number) {
  return v >= 0 ? "text-up" : "text-down";
}

/** CANSLIM 종합점수 색상 (7↑ 초록 / 5↑ 노랑 / 그 외 빨강) */
export function scoreColor(s: number) {
  if (s >= 7)
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-400",
      ring: "ring-emerald-400/30",
      border: "border-emerald-500/40",
      soft: "bg-emerald-500/15",
    };
  if (s >= 5)
    return {
      text: "text-yellow-400",
      bg: "bg-yellow-400",
      ring: "ring-yellow-400/30",
      border: "border-yellow-500/40",
      soft: "bg-yellow-500/15",
    };
  return {
    text: "text-red-400",
    bg: "bg-red-400",
    ring: "ring-red-400/30",
    border: "border-red-500/40",
    soft: "bg-red-500/15",
  };
}

const DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

/** SSR/CSR 결과가 동일하도록 타임존을 고정한다(hydration mismatch 방지) */
export function formatDate(iso?: string) {
  if (!iso) return "-";
  return DATE_FMT.format(new Date(iso)).replace(/\.$/, "");
}

export function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const t = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(d);
  return `${formatDate(iso)} ${t}`;
}

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * `**강조**`만 뽑아 조각으로 나눈다 — 카탈로그 설명글 전용.
 *
 * ## 왜 이게 필요했나
 * `sectors/*.ts`의 "어떻게 읽나요" 문장에 `**…**`가 섞여 있었는데 화면은 그대로 별표를
 * 찍고 있었다(2026-08-22 발견). 초보자용 설명에서 강조가 별표로 보이면 오히려 방해다.
 *
 * ⚠ **마크다운 렌더러가 아니다.** 이 함수는 카탈로그(코드 상수)만 받는다.
 *    사용자 입력에 쓰지 말 것 — 그쪽은 `lib/sanitize-html.ts`가 맡는다.
 */
export function splitEmphasis(text: string): { text: string; strong: boolean }[] {
  const out: { text: string; strong: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), strong: false });
    out.push({ text: m[1], strong: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), strong: false });
  return out;
}

/**
 * 같은 문장을 **기계가 읽는 자리**에 넣을 때 쓴다 — 메타 설명·JSON-LD·AI 검색 색인.
 *
 * ⚠ 여기서는 강조를 굵게 만들 수 없으니 **표시만 걷어낸다.** 그대로 흘리면
 *   검색 결과 미리보기와 구조화 데이터에 `**별표**`가 그대로 찍힌다
 *   (2026-08-25 운영에서 확인했다 — 화면은 `Emphasis`가 막고 있었지만 메타는 뚫려 있었다).
 *
 * `splitEmphasis`와 짝이다. **보이는 자리는 `Emphasis`, 안 보이는 자리는 이 함수**로 통일한다.
 */
export function stripEmphasis(text: string): string {
  return (
    splitEmphasis(text)
      .map((p) => p.text)
      .join("")
      /**
       * ⚠ 짝이 안 맞는 별표까지 걷어낸다 — `splitEmphasis`와 **일부러 다르다.**
       *   보이는 화면에서 짝 안 맞는 별표는 눈에 띄어야 고칠 수 있는 오타지만,
       *   검색 결과 미리보기에서는 그냥 노이즈다. 이 함수의 약속은
       *   **"결과에 별표가 없다"** 하나다.
       */
      .replace(/\*+/g, "")
  );
}
