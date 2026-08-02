/**
 * "이 숫자가 모의인가 실계좌인가"를 밝히는 안내 줄.
 *
 * ⚠ 계좌 숫자를 보여주는 화면에는 **반드시** 붙인다.
 * 사과문이 아니라 설명이다 — 무엇이 가상이고 무엇이 실제인지를 적는다.
 * (매매·납입은 가상, 종목 시세는 실제 시장가격)
 */
import { Badge } from "./Badge";
import { dataModeNotice } from "@/lib/data-mode";
import type { DataMode } from "@/lib/data-mode";
import { cx } from "@/lib/format";

export function DataModeNotice({
  mode,
  className,
  compact = false,
}: {
  mode: DataMode;
  className?: string;
  compact?: boolean;
}) {
  const notice = dataModeNotice(mode);

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3.5 py-2.5",
        notice.tone === "ok"
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-gold-600/25 bg-gold-600/5",
        className,
      )}
    >
      <Badge tone={notice.tone === "ok" ? "emerald" : "gold"}>{notice.badge}</Badge>
      <span className={cx("text-gray-400 leading-relaxed", compact ? "text-[11.5px]" : "text-[12.5px]")}>
        {notice.line}
      </span>
    </div>
  );
}
