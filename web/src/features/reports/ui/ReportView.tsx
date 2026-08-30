import { REPORT_SECTIONS } from "@/lib/report/catalog";
import { isBlankBody } from "@/lib/report/rules";
import { formatNumber } from "@/lib/format";
import { DataTag } from "./DataTag";
import type { StoredReport } from "../repository";
import type { ReportSectionKey } from "@/lib/report/types";

/**
 * 공개 보고서 렌더러 — 13섹션.
 *
 * ## ⚠ 여기서 지키는 것
 * - **비어 있는 칸은 비운 채로 두고 조회처를 적는다**(R2). 화면이 빈 것을 부끄러워하면
 *   누군가 추정치로 채우게 된다. 원본 3건에서 가져온 장치 중 가장 중요한 것이다.
 * - **모든 수치에 데이터 태그**를 붙인다(R5). 확정과 추정이 색으로 갈린다.
 * - **목표주가는 제3자 공표치임을 시각적으로 분리**한다(R4). 우리 판단과 같은 줄에 두지 않는다.
 * - **판정에는 철회 조건을 함께 보여준다**(R3). 판정만 보이고 반증 조건이 안 보이면 소감이 된다.
 *
 * ⚠ `bodyHtml`만 렌더한다. 저장 시점에 `lib/markdown` → `lib/sanitize-html`을 이미 거쳤다.
 *    여기서 원본 마크다운을 다시 변환하지 않는다 — 경로가 둘이 되면 한쪽만 정화된다.
 */
/**
 * 컨센서스 금액 표기.
 * ⚠ 모르는 통화를 원화·달러로 **바꿔 쓰지 않는다.** 통화를 잘못 붙인 숫자는 틀린 숫자다 —
 *    아는 통화만 서식을 입히고, 나머지는 숫자와 통화 코드를 그대로 적는다.
 */
function formatConsensus(value: number, currency: string): string {
  if (currency === "KRW" || currency === "USD") return formatNumber(value, currency);
  return `${value.toLocaleString("ko-KR")} ${currency}`;
}

export function ReportView({ report }: { report: StoredReport }) {
  const blockOf = (key: ReportSectionKey) => report.blocks.find((b) => b.sectionKey === key);
  const consensus = report.consensusTarget;

  return (
    <article className="space-y-6">
      {/* 판정 배지 — ⚠ 철회 조건을 같은 카드에 둔다 */}
      {(report.verdictStructural || report.verdictShort) && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-wrap gap-2">
            {report.verdictStructural && (
              <span className="rounded-lg border border-gold-600/40 bg-gold-500/10 px-2.5 py-1 text-[12px] text-gold-300">
                중장기 · {report.verdictStructural}
              </span>
            )}
            {report.verdictShort && (
              <span className="rounded-lg border border-border bg-cardHover px-2.5 py-1 text-[12px] text-gray-300">
                단기 · {report.verdictShort}
              </span>
            )}
          </div>
          {report.revokeIf && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-amber-300/90">
              <span className="text-muted">철회 조건 — </span>
              {report.revokeIf}
            </p>
          )}
          {report.nextCheckAt && (
            <p className="mt-1.5 text-[11.5px] text-gray-500">
              다음 판단 시점 <span className="tabular-nums">{report.nextCheckAt}</span>
            </p>
          )}
        </section>
      )}

      {/* 섹션 본문 */}
      {REPORT_SECTIONS.map((section) => {
        const block = blockOf(section.key);
        if (!block) return null;

        const html = report.html.get(section.key) ?? "";
        const blank = isBlankBody(block.body);
        // ⚠ 현실의 "빈 프레임"은 완전히 비어 있지 않다 — 라벨은 있고 값만 `—`인 표다
        //    (한국콜마 §05의 미조회 고지가 그 모양이다). 그래서 **태그가 N/A면**
        //    표를 그대로 보여 주면서 미조회 고지를 함께 붙인다. 표만 있고 설명이 없으면
        //    읽는 사람은 "아직 안 채운 화면"으로 읽지 "일부러 안 채운 자리"로 읽지 않는다.
        const unresearched = blank || block.tag === "na";

        return (
          <section key={section.key} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex flex-wrap items-baseline gap-2 mb-3">
              <span className="text-[11px] font-mono text-gold-400">§{section.no}</span>
              <h2 className="text-[15px] font-semibold text-ink">{section.name}</h2>
              <DataTag tag={block.tag} />
            </div>

            {/* 본문이 있으면 그대로 보여준다(빈 프레임도 본문이다). */}
            {!blank &&
              (html ? (
                <div
                  className="prose-woodsman text-[13.5px]"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                /* ⚠ 조용한 실패 금지. 원본은 있는데 변환 결과가 비면 화면이 그냥 비어 보인다 —
                   "안 쓴 것"과 구분이 안 되므로 드러낸다. */
                <p className="text-[12px] text-amber-400/80">
                  본문 변환 결과가 비어 있습니다. 관리자 화면에서 다시 저장해 주세요.
                </p>
              ))}

            {/* ⚠ 미조회 고지 + 조회처. 빈 것을 숨기지 않는다 —
                "모른다"를 적을 자리가 없으면 누군가 추정치로 채운다. */}
            {unresearched && (
              <div
                className={`rounded-xl border border-dashed border-border bg-bg px-4 py-3 ${
                  blank ? "" : "mt-3"
                }`}
              >
                <p className="text-[12.5px] text-gray-400">
                  이 항목은 아직 확인하지 못했습니다.{" "}
                  <strong className="text-gray-300">원칙에 따라 추정치를 기입하지 않습니다.</strong>
                </p>
                {block.lookupHint && (
                  <p className="mt-1.5 text-[12px] text-muted">조회처 — {block.lookupHint}</p>
                )}
              </div>
            )}

            {(block.source || block.asOf) && (
              <p className="mt-3 pt-3 border-t border-border/60 text-[11px] text-gray-600">
                출처{" "}
                {block.sourceUrl ? (
                  <a
                    href={block.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener nofollow"
                    className="text-gray-500 underline decoration-dotted hover:text-gold-400"
                  >
                    {block.source ?? block.sourceUrl}
                  </a>
                ) : (
                  block.source
                )}
                {block.asOf && <span className="tabular-nums"> · 기준일 {block.asOf}</span>}
              </p>
            )}

            {/* §07 밸류에이션에는 ⚠ 방법론 한계를 붙인다 — 신뢰는 한계 고백에서 나온다 */}
            {section.key === "valuation" && report.valuationLimitation && (
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-3">
                <p className="text-[11.5px] text-amber-200">이 방법론의 한계</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-gray-300">
                  {report.valuationLimitation}
                </p>
              </div>
            )}

            {/* ⚠ 컨센서스 목표주가는 우리 판단과 **시각적으로 분리**한다 */}
            {section.key === "valuation" && consensus && (
              <div className="mt-3 rounded-xl border border-border bg-bg px-3.5 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-md bg-cardHover px-1.5 py-0.5 text-[10.5px] text-gray-400">
                    제3자 컨센서스
                  </span>
                  <span className="text-[15px] font-bold text-ink tabular-nums">
                    {formatConsensus(consensus.value, consensus.currency)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] text-gray-500">
                  {consensus.sourceUrl ? (
                    <a
                      href={consensus.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="underline decoration-dotted hover:text-gold-400"
                    >
                      {consensus.source}
                    </a>
                  ) : (
                    consensus.source
                  )}
                  <span className="tabular-nums"> · {consensus.asOf} 기준</span>
                </p>
                <p className="mt-1.5 text-[11px] text-gray-600">
                  ⚠ 증권사가 공표한 수치를 출처와 함께 옮긴 것입니다.{" "}
                  <strong>Woodsman은 목표주가를 산출하지 않습니다.</strong>
                </p>
              </div>
            )}

            {/* §11은 표로 편다 — 그대로 다음 갱신의 작업 목록이다 */}
            {section.key === "checklist" && report.checklist.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted">
                      <th className="py-2 pr-3">항목</th>
                      <th className="py-2 pr-3">소스</th>
                      <th className="py-2">확인되면</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.checklist.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 text-gray-200">{c.item}</td>
                        <td className="py-2 pr-3 text-gray-500">{c.source}</td>
                        <td className="py-2 text-gray-500">{c.impact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {/* ⚠ 투자자문업 미인가 고지 — `/disclaimer`와 연결된 법적 고지다. 빼지 않는다. */}
      <p className="text-[11px] leading-relaxed text-gray-600">
        ※ 이 보고서는 개인의 기록이자 정보 제공 목적이며 투자 권유나 자문이 아닙니다. Woodsman은
        투자자문업 등록 사업자가 아니며, 매수·매도를 권유하거나 목표주가를 제시하지 않습니다.
        과거의 성과는 미래의 수익을 보장하지 않으며 투자 판단과 그 결과의 책임은 투자자 본인에게
        있습니다.
      </p>
    </article>
  );
}
