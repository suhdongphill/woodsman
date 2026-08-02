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

export function profitColor(v: number) {
  return v >= 0 ? "text-emerald-400" : "text-red-400";
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
