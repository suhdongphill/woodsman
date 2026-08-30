"use client";

/**
 * 보고서 편집 화면.
 *
 * ⚠ 섹션 목록·규율은 여기서 정하지 않는다. `lib/report/catalog.ts`에서 내려온 것을 편다 —
 *    화면이 섹션을 따로 들고 있으면 카탈로그를 고쳐도 화면이 안 따라온다.
 * ⚠ 초안 저장은 규율을 어겨도 된다. 막는 것은 **발행**뿐이다(쓰다 만 글을 저장 못 하면
 *    아무도 안 쓴다).
 */
import { useActionState } from "react";
import { REPORT_SECTIONS } from "@/lib/report/catalog";
import { DATA_TAGS, CANSLIM_ITEMS, POINT_MAX, POINT_MIN } from "@/lib/canslim/catalog";
import type { ReportDraft } from "@/lib/report/types";
import type { CanslimReading } from "@/lib/canslim/types";
import { saveReportAction } from "../actions";
import { emptyReportFormState } from "../form-state";

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const area = `${field} min-h-[120px] font-mono leading-relaxed`;
const label = "block text-[11px] text-muted mb-1";

/** 체크리스트에 항상 빈 줄 두 개를 더 보여 준다 — 줄을 추가하는 버튼 없이도 쓸 수 있게. */
const EXTRA_CHECK_ROWS = 2;

export function ReportEditor({
  draft,
  readings,
}: {
  draft: ReportDraft;
  readings: Map<string, CanslimReading>;
}) {
  const [state, formAction, pending] = useActionState(saveReportAction, emptyReportFormState);
  const blockOf = (key: string) => draft.blocks.find((b) => b.sectionKey === key);
  const checkRows = [...draft.checklist, ...Array(EXTRA_CHECK_ROWS).fill(null)];

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="ticker" value={draft.ticker} />
      <input type="hidden" name="status" value={draft.status} />

      {/* 기본 정보 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">기본 정보</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={label}>종목명</span>
            <input name="name" defaultValue={draft.name} className={field} />
          </label>
          <label>
            <span className={label}>시장</span>
            <select name="market" defaultValue={draft.market} className={field}>
              <option value="US">미국</option>
              <option value="KR">한국</option>
            </select>
          </label>
          <label>
            <span className={label}>산업</span>
            <input name="industry" defaultValue={draft.industry ?? ""} className={field} />
          </label>
        </div>
        <label className="block">
          <span className={label}>한 줄 논지 (§00 · 목록에 그대로 쓰입니다)</span>
          <input name="headline" defaultValue={draft.headline} className={field} />
        </label>
      </section>

      {/* 판정 — R3 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">판정 · 철회 조건 (R3)</h3>
        <p className="text-[11.5px] text-gray-600">
          ⚠ 반증 조건 없는 판정은 판정이 아니라 소감입니다. 철회 조건이 없으면 발행이 막힙니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={label}>구조 판정 (중장기)</span>
            <input
              name="verdictStructural"
              defaultValue={draft.verdictStructural ?? ""}
              className={field}
            />
          </label>
          <label>
            <span className={label}>단기 판정 (⚠ 시계를 나눠 적으면 모순돼 보이지 않습니다)</span>
            <input name="verdictShort" defaultValue={draft.verdictShort ?? ""} className={field} />
          </label>
        </div>
        <label className="block">
          <span className={label}>
            철회 조건 — 무엇이 관측되면 이 판정을 접나 (예: 수출 ΔYoY 2개월 연속 마이너스)
          </span>
          <input name="revokeIf" defaultValue={draft.revokeIf ?? ""} className={field} />
        </label>
      </section>

      {/* 티스토리 원문 — ⚠ 1순위 지표(넘어간 클릭)의 경로다 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">티스토리 원문 주소</h3>
        <p className="text-[11.5px] text-gray-600">
          이 보고서를 티스토리에 옮겨 실었으면 그 글 주소를 적습니다. 적으면 공개 화면이
          <strong className="text-gray-300"> 경유 링크(/go)</strong>로 보내고 클릭을 셉니다 —
          그 숫자가 이 사이트의 1순위 지표입니다. ⚠ https 주소만 저장됩니다.
        </p>
        <input
          name="tistoryUrl"
          type="url"
          inputMode="url"
          placeholder="https://<블로그>.tistory.com/123"
          defaultValue={draft.tistoryUrl ?? ""}
          className={field}
        />
      </section>

      {/* 밸류에이션 한계 + 컨센서스 — R6·R4 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">밸류에이션 한계 (R6) · 컨센서스 (R4)</h3>
        <label className="block">
          <span className={label}>
            ⚠ 이 방법이 언제 틀리나 — 밸류에이션 섹션을 쓰면 필수입니다
          </span>
          <textarea
            name="valuationLimitation"
            defaultValue={draft.valuationLimitation ?? ""}
            className={`${field} min-h-[70px]`}
          />
        </label>

        <p className="text-[11.5px] text-gray-600">
          ⚠ 목표주가는 <strong>우리가 산출하지 않습니다.</strong> 증권사가 공표한 값을 출처·기준일과
          함께 인용할 때만 아래를 채웁니다. 비워 두면 인용하지 않는 것입니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className={label}>컨센서스 목표주가</span>
            <input
              name="consensus.value"
              defaultValue={draft.consensusTarget?.value ?? ""}
              className={field}
              placeholder="예: 118833"
            />
          </label>
          <label>
            <span className={label}>통화</span>
            <input
              name="consensus.currency"
              defaultValue={draft.consensusTarget?.currency ?? ""}
              className={field}
              placeholder="KRW"
            />
          </label>
          <label>
            <span className={label}>집계처</span>
            <input
              name="consensus.source"
              defaultValue={draft.consensusTarget?.source ?? ""}
              className={field}
              placeholder="18개사 컨센서스 · Investing.com 집계"
            />
          </label>
          <label>
            <span className={label}>기준일</span>
            <input
              type="date"
              name="consensus.asOf"
              defaultValue={draft.consensusTarget?.asOf ?? ""}
              className={field}
            />
          </label>
        </div>
        <label className="block">
          <span className={label}>집계처 링크</span>
          <input
            name="consensus.sourceUrl"
            defaultValue={draft.consensusTarget?.sourceUrl ?? ""}
            className={field}
          />
        </label>
      </section>

      {/* 섹션 본문 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-ink">섹션 본문</h3>
        {REPORT_SECTIONS.map((section) => {
          const b = blockOf(section.key);
          return (
            <div key={section.key} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[11px] font-mono text-gold-400">§{section.no}</span>
                <h4 className="text-[13.5px] font-semibold text-ink">{section.name}</h4>
                {section.required && (
                  <span className="rounded-md bg-gold-500/12 px-1.5 py-0.5 text-[10px] text-gold-400">
                    필수
                  </span>
                )}
                {section.numeric && (
                  <span className="rounded-md bg-cardHover px-1.5 py-0.5 text-[10px] text-gray-400">
                    수치 — 태그 필수 (R5)
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-muted">{section.question}</p>
              <p className="text-[11px] text-gray-600">담을 것: {section.devices.join(" · ")}</p>

              <textarea
                name={`block.${section.key}.body`}
                defaultValue={b?.body ?? ""}
                className={area}
                placeholder="마크다운으로 적습니다. 모르는 값은 —로 두고 아래 조회처를 채우세요."
              />

              <div className="grid gap-3 sm:grid-cols-4">
                <label>
                  <span className={label}>데이터 태그</span>
                  <select name={`block.${section.key}.tag`} defaultValue={b?.tag ?? ""} className={field}>
                    <option value="">선택 안 함</option>
                    {DATA_TAGS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={label}>출처</span>
                  <input
                    name={`block.${section.key}.source`}
                    defaultValue={b?.source ?? ""}
                    className={field}
                  />
                </label>
                <label>
                  <span className={label}>출처 링크</span>
                  <input
                    name={`block.${section.key}.sourceUrl`}
                    defaultValue={b?.sourceUrl ?? ""}
                    className={field}
                  />
                </label>
                <label>
                  <span className={label}>기준일</span>
                  <input
                    type="date"
                    name={`block.${section.key}.asOf`}
                    defaultValue={b?.asOf ?? ""}
                    className={field}
                  />
                </label>
              </div>

              <label className="block">
                <span className={label}>
                  ⚠ 조회처 (R2) — 비운 칸은 추정치로 채우지 말고 어디서 구하는지 적습니다
                </span>
                <input
                  name={`block.${section.key}.lookupHint`}
                  defaultValue={b?.lookupHint ?? ""}
                  className={field}
                  placeholder="예: KRX 정보데이터시스템 → 투자자별 매매동향"
                />
              </label>
            </div>
          );
        })}
      </section>

      {/* CANSLIM 7축 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">CANSLIM 채점</h3>
        <p className="text-[11.5px] text-gray-600">
          ⚠ 점수를 비워 두면 <strong>N/A</strong>입니다. 0점이 아니라 <strong>분모에서 빠집니다</strong>(R1).
          모르는 축을 0으로 적으면 채점을 미룬 종목이 자동으로 저조 등급을 받습니다.
        </p>
        {CANSLIM_ITEMS.map((item) => {
          const r = readings.get(item.key);
          return (
            <div key={item.key} className="border-t border-border/60 pt-3 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[12px] font-bold text-gold-400 w-4">{item.key}</span>
                <span className="text-[12.5px] text-ink">{item.name}</span>
                <span className="text-[10.5px] text-gray-500">가중치 {item.weight}</span>
              </div>
              <p className="text-[11px] text-gray-600">{item.rubric}</p>
              <p className="text-[11px] text-amber-500/80">{item.caveat}</p>
              <div className="grid gap-3 sm:grid-cols-[90px_130px_1fr]">
                <label>
                  <span className={label}>점수(0~10)</span>
                  <input
                    name={`axis.${item.key}.points`}
                    type="number"
                    min={POINT_MIN}
                    max={POINT_MAX}
                    step={1}
                    defaultValue={r?.points ?? ""}
                    className={field}
                    placeholder="N/A"
                  />
                </label>
                <label>
                  <span className={label}>태그</span>
                  <select name={`axis.${item.key}.tag`} defaultValue={r?.tag ?? "na"} className={field}>
                    {DATA_TAGS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={label}>근거 한 줄 (숫자가 들어가야 합니다)</span>
                  <input
                    name={`axis.${item.key}.evidence`}
                    defaultValue={r?.evidence ?? ""}
                    className={field}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={label}>출처</span>
                  <input
                    name={`axis.${item.key}.source`}
                    defaultValue={r?.source ?? ""}
                    className={field}
                  />
                </label>
                <label>
                  <span className={label}>출처 링크</span>
                  <input
                    name={`axis.${item.key}.sourceUrl`}
                    defaultValue={r?.sourceUrl ?? ""}
                    className={field}
                  />
                </label>
                <label>
                  <span className={label}>기준일</span>
                  <input
                    type="date"
                    name={`axis.${item.key}.asOf`}
                    defaultValue={r?.asOf ?? ""}
                    className={field}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </section>

      {/* 체크리스트 + 다음 판단 시점 — R7 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">미확정 체크리스트 · 다음 판단 시점 (R7)</h3>
        <p className="text-[11.5px] text-gray-600">
          ⚠ &ldquo;지켜본다&rdquo;는 지켜보지 않는다는 뜻입니다. 날짜가 있어야 갱신이 일어납니다.
        </p>
        <label className="block max-w-xs">
          <span className={label}>다음 판단 시점</span>
          <input
            type="date"
            name="nextCheckAt"
            defaultValue={draft.nextCheckAt ?? ""}
            className={field}
          />
        </label>

        {checkRows.map((row, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className={label}>{i === 0 ? "항목 (무엇을 모르나)" : ""}</span>
              <input name={`check.${i}.item`} defaultValue={row?.item ?? ""} className={field} />
            </label>
            <label>
              <span className={label}>{i === 0 ? "소스 (어디서 확인하나)" : ""}</span>
              <input name={`check.${i}.source`} defaultValue={row?.source ?? ""} className={field} />
            </label>
            <label>
              <span className={label}>{i === 0 ? "영향 (확인되면 무엇이 바뀌나)" : ""}</span>
              <input name={`check.${i}.impact`} defaultValue={row?.impact ?? ""} className={field} />
            </label>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 sticky bottom-4">
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
        {state.notice && !state.error && (
          <span className="text-[12px] text-emerald-400">{state.notice}</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-5 py-2.5 text-[13px] font-medium text-onAccent shadow-lg transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "초안 저장"}
        </button>
      </div>
    </form>
  );
}
