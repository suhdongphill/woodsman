import { CheckIcon } from "@/components/icons";
import { cx } from "@/lib/format";
import { ROADMAP, ROADMAP_STATUS_LABEL, type RoadmapPhase } from "@/lib/site-status";

/**
 * 발전 방향 타임라인.
 *
 * 데이터는 `src/lib/site-status.ts`에만 있고 여기는 그리기만 한다 —
 * 단계가 바뀔 때 문구를 화면에서 찾아 고치는 일이 없도록.
 */

const STATUS_STYLE: Record<RoadmapPhase["status"], { chip: string; dot: string; card: string }> = {
  done: {
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-500",
    card: "border-border",
  },
  current: {
    chip: "border-gold-600/50 bg-gold-500/15 text-gold-400",
    dot: "bg-gold-500",
    card: "border-gold-600/40 bg-gold-500/[0.04]",
  },
  planned: {
    chip: "border-border bg-cardHover text-muted",
    dot: "bg-gray-600",
    card: "border-border",
  },
};

export function RoadmapTimeline() {
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {ROADMAP.map((phase) => {
        const style = STATUS_STYLE[phase.status];
        return (
          <li key={phase.id} className="relative">
            <span
              className={cx(
                "absolute -left-[27px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-bg",
                style.dot,
              )}
              aria-hidden="true"
            />
            <article className={cx("rounded-2xl border bg-card p-5", style.card)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-gold-500">{phase.step}</span>
                <h3 className="text-[15px] font-semibold text-white">{phase.title}</h3>
                <span
                  className={cx(
                    "rounded-lg border px-2 py-0.5 text-[10px] font-medium",
                    style.chip,
                  )}
                >
                  {ROADMAP_STATUS_LABEL[phase.status]}
                </span>
              </div>

              <p className="mt-2 text-[13px] leading-relaxed text-gray-300">{phase.summary}</p>

              <ul className="mt-3 space-y-1.5">
                {phase.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
                    <CheckIcon
                      size={13}
                      className={cx(
                        "mt-1 shrink-0",
                        phase.status === "current" ? "text-emerald-400" : "text-gray-600",
                      )}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
