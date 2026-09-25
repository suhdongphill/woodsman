import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { className as clsName } from "@/lib/leaders/view";

/** 판정 칩 — 운영 포트폴리오 카드(`HoldingTagChips`)와 같은 색을 쓴다. 색은 판정 칩에만. */
const TONE: Record<string, BadgeTone> = {
  leader: "emerald",
  candidate: "info",
  watch: "warn",
  out: "neutral",
  unknown: "neutral",
};
const STARS: Record<string, string> = { prime: "★★", core: "★" };

export function LeaderBadge({ cls, tier }: { cls: string | null; tier?: string | null }) {
  const stars = cls === "leader" ? (STARS[tier ?? ""] ?? "") : "";
  return (
    <Badge tone={TONE[cls ?? ""] ?? "neutral"}>
      {clsName(cls)}
      {stars && ` ${stars}`}
    </Badge>
  );
}
