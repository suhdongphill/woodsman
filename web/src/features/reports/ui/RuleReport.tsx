import { findHonestyRule, findReportSection } from "@/lib/report/catalog";
import { publishBlockers, validationSummary, type ReportProblem } from "@/lib/report/rules";

/**
 * 발행 전 규율 검증 결과.
 *
 * ⚠ **"틀렸다"만 말하지 않는다.** 각 항목에 어떻게 고치는지(`fix`)를 함께 띄운다 —
 *    규율은 지키라고 있는 것이지 사람을 막으라고 있는 게 아니다.
 * ⚠ 판정은 여기서 하지 않는다. `lib/report/rules.ts`가 낸 결과를 펴기만 한다.
 */
export function RuleReport({ problems }: { problems: ReportProblem[] }) {
  const blockers = publishBlockers(problems);
  const warnings = problems.filter((p) => p.severity === "warn");

  return (
    <div className="space-y-3">
      <p
        className={
          blockers.length > 0
            ? "text-[13px] text-red-300"
            : warnings.length > 0
              ? "text-[13px] text-amber-300"
              : "text-[13px] text-emerald-300"
        }
      >
        {validationSummary(problems)}
      </p>

      {problems.length === 0 && (
        <p className="text-[12px] text-gray-600">
          정직성 규율 7가지를 모두 지켰습니다. 규율의 내용은{" "}
          <code>lib/report/catalog.ts</code>의 <code>HONESTY_RULES</code>에 있습니다.
        </p>
      )}

      <ul className="space-y-2">
        {[...blockers, ...warnings].map((p, i) => {
          const section = p.sectionKey ? findReportSection(p.sectionKey) : undefined;
          const rule = p.rule ? findHonestyRule(p.rule) : undefined;
          const isBlock = p.severity === "block";

          return (
            <li
              key={`${p.rule ?? "struct"}-${p.sectionKey ?? "-"}-${i}`}
              className={`rounded-xl border px-3.5 py-2.5 ${
                isBlock
                  ? "border-red-500/30 bg-red-500/[0.06]"
                  : "border-amber-500/25 bg-amber-500/[0.05]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    isBlock ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  {isBlock ? "발행 차단" : "경고"}
                </span>
                {p.rule && (
                  <span
                    className="text-[10px] text-gray-400"
                    title={rule?.why}
                  >
                    {p.rule} · {rule?.title}
                  </span>
                )}
                {section && (
                  <span className="text-[10px] text-gray-500">
                    §{section.no} {section.name}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] text-gray-200">{p.message}</p>
              <p className="mt-1 text-[11.5px] text-gray-500">→ {p.fix}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
