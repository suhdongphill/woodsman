"use client";

/**
 * 사이트 자료 주입 패널 (편집 화면).
 *
 * ## ⚠ 여기서 지키는 것
 * - **주입은 사람이 누를 때만** 일어난다. 자동으로 갱신하면 보고서가 참조한 숫자가
 *   읽는 날마다 달라진다(`lib/report/context.ts` 첫머리).
 * - **주입 뒤 움직인 값은 여기서만** 말한다. 공개 화면은 얼려 둔 값 그대로를 보여준다.
 * - **M축 점수는 채우지 않는다.** 근거·출처·기준일만 채우고, 왜 그런지를 화면에 적는다.
 * - 본문은 프로그램이 고치지 않는다. **붙여 넣을 마크다운을 보여줄** 뿐이다 —
 *   쓰던 글을 프로그램이 건드리면 다시는 안 쓴다.
 * - ⚠ **Envelope는 밴드 위치까지만** 보여준다. 🟢신규매수/🔴손절 같은 대응은 사람이 §09에 쓴다
 *   (`docs/아이디어_노트.md` A4 · `WOODSMAN_DOCTRINE`).
 */
import { useActionState } from "react";
import { fetchQuotesAction, fillMarketAxisAction, injectContextAction } from "../actions";
import { emptyReportFormState } from "../form-state";
import {
  CONTEXT_STALE_DAYS,
  FUNCTION_LABEL_REPORT,
  MARKET_AXIS_LIMITATION,
  recessionCounts,
  type ContextDrift,
  type ReportContextSnapshot,
} from "@/lib/report/context";
import { findBubbleTrigger } from "@/lib/bubble/catalog";

const row = "flex flex-wrap items-baseline justify-between gap-2 py-1.5 border-b border-border/60";
const key = "text-[11.5px] text-muted";
const val = "text-[12.5px] text-gray-200";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function ContextPanel({
  ticker,
  snapshot,
  drift,
  markdown,
  ageDays,
}: {
  ticker: string;
  snapshot: ReportContextSnapshot | null;
  /** 주입 뒤 사이트에서 움직인 것 */
  drift: ContextDrift[];
  /** 본문에 붙여 넣을 표 */
  markdown: string;
  ageDays?: number;
}) {
  const [injectState, injectAction, injecting] = useActionState(
    injectContextAction,
    emptyReportFormState,
  );
  const [axisState, axisAction, filling] = useActionState(
    fillMarketAxisAction,
    emptyReportFormState,
  );
  const [quoteState, quoteAction, fetchingQuotes] = useActionState(
    fetchQuotesAction,
    emptyReportFormState,
  );

  const stale = ageDays !== undefined && ageDays > CONTEXT_STALE_DAYS;

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">사이트 자료 주입</h3>
          <p className="mt-1 text-[11.5px] text-gray-600">
            시세 · 거시 지표 · 버블 모니터 · 대표 포트폴리오를 손으로 다시 적지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            ⚠ 「시세 가져오기」와 「주입」은 **다른 버튼이다.** 시세는 매일 바뀌고
               거시·버블은 그렇지 않다. 한 버튼으로 묶으면 시세를 새로 받으려다
               보고서가 참조한 거시 숫자까지 갈아 끼우게 된다.
          */}
          <form action={quoteAction}>
            <input type="hidden" name="ticker" value={ticker} />
            <button
              type="submit"
              disabled={fetchingQuotes}
              className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white disabled:opacity-40"
            >
              {fetchingQuotes ? "받는 중…" : "시세 가져오기"}
            </button>
          </form>
          <form action={injectAction}>
            <input type="hidden" name="ticker" value={ticker} />
            <button
              type="submit"
              disabled={injecting}
              className="rounded-xl border border-gold-600/40 px-3 py-2 text-[12.5px] text-gold-300 transition-colors hover:bg-gold-600/10 disabled:opacity-40"
            >
              {injecting ? "가져오는 중…" : snapshot ? "지금 값으로 다시 주입" : "사이트 자료 주입"}
            </button>
          </form>
        </div>
      </div>

      {quoteState.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {quoteState.error}
        </p>
      )}
      {quoteState.notice && !quoteState.error && (
        <p className="text-[12px] text-emerald-400">{quoteState.notice}</p>
      )}

      {injectState.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {injectState.error}
        </p>
      )}
      {injectState.notice && !injectState.error && (
        <p className="text-[12px] text-emerald-400">{injectState.notice}</p>
      )}

      {!snapshot ? (
        <p className="text-[12.5px] text-gray-500">
          아직 주입하지 않았습니다. 누르면 <strong className="text-gray-300">지금</strong> 사이트가
          갖고 있는 값을 이 보고서에 얼려 넣습니다. ⚠ 이후 사이트 값이 바뀌어도 보고서는 그대로
          두고, 달라진 부분만 여기서 알려 줍니다.
        </p>
      ) : (
        <>
          <p className={stale ? "text-[12px] text-amber-400" : "text-[12px] text-gray-500"}>
            기준 <span className="tabular-nums">{snapshot.capturedAt}</span>
            {ageDays !== undefined && ageDays > 0 && ` · ${ageDays}일 전`}
            {stale && ` — ⚠ ${CONTEXT_STALE_DAYS}일이 넘었습니다. 다시 주입할 시점입니다.`}
          </p>

          <div>
            <div className={row}>
              <span className={key}>침체 신호 종합</span>
              <span className={val}>
                {snapshot.macro.level === "unknown" ? (
                  <span className="text-gray-500">— 아직 수집 전 (/admin/macro)</span>
                ) : (
                  <>
                    {snapshot.macro.label} · {recessionCounts(snapshot.macro)}
                    <span className="ml-1 text-[11px] text-gray-600">
                      ({snapshot.macro.total}개 지표)
                    </span>
                    {snapshot.macro.asOf && (
                      <span className="ml-2 text-[11px] text-gray-600 tabular-nums">
                        {snapshot.macro.asOf}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>

            <div className={row}>
              <span className={key}>연준 방향</span>
              <span className={val}>
                {snapshot.macro.fed ? (
                  <>
                    {snapshot.macro.fed.biasLabel} · 인상 {pct(snapshot.macro.fed.hike)} / 동결{" "}
                    {pct(snapshot.macro.fed.hold)} / 인하 {pct(snapshot.macro.fed.cut)}
                    {snapshot.macro.fed.asOf && (
                      <span className="ml-2 text-[11px] text-gray-600 tabular-nums">
                        {snapshot.macro.fed.asOf}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">
                    — Core PCE·기준금리·실업률이 있어야 계산됩니다
                  </span>
                )}
              </span>
            </div>

            <div className={row}>
              <span className={key}>AI·반도체 버블</span>
              <span className={val}>
                {snapshot.bubble.score === undefined ? (
                  <span className="text-gray-500">— 아직 채점 전 (/admin/bubble)</span>
                ) : (
                  <>
                    {snapshot.bubble.score}점 · {snapshot.bubble.regime}
                    <span className="ml-2 text-[11px] text-gray-600">
                      {snapshot.bubble.total}개 중 {snapshot.bubble.scored}개 채점
                    </span>
                  </>
                )}
              </span>
            </div>

            <div className={row}>
              <span className={key}>발화한 하드 트리거</span>
              <span className={val}>
                {snapshot.bubble.firedTriggerKeys.length === 0 ? (
                  <span className="text-gray-500">없음</span>
                ) : (
                  <span className="text-amber-300">
                    {snapshot.bubble.firedTriggerKeys
                      .map((k) => findBubbleTrigger(k)?.text ?? k)
                      .join(" / ")}
                  </span>
                )}
              </span>
            </div>

            <div className={row}>
              <span className={key}>현재가</span>
              <span className={val}>
                {snapshot.quote.price == null ? (
                  <span className="text-gray-500">— 아직 가져오지 않음 (/admin/stocks)</span>
                ) : (
                  <>
                    <span className="tabular-nums">
                      {snapshot.quote.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                    </span>
                    {snapshot.quote.currency && (
                      <span className="ml-1 text-[11px] text-gray-500">
                        {snapshot.quote.currency}
                      </span>
                    )}
                    {snapshot.quote.changePercent != null && (
                      <span
                        className={
                          snapshot.quote.changePercent >= 0
                            ? "ml-2 text-emerald-300 tabular-nums"
                            : "ml-2 text-rose-300 tabular-nums"
                        }
                      >
                        {snapshot.quote.changePercent >= 0 ? "+" : ""}
                        {snapshot.quote.changePercent.toFixed(2)}%
                      </span>
                    )}
                    {snapshot.quote.asOf && (
                      <span className="ml-2 text-[11px] text-gray-600 tabular-nums">
                        {snapshot.quote.asOf}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>

            {snapshot.quote.low52 != null && snapshot.quote.high52 != null && (
              <div className={row}>
                <span className={key}>52주 범위</span>
                <span className={val}>
                  <span className="tabular-nums">
                    {snapshot.quote.low52.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ~{" "}
                    {snapshot.quote.high52.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                  </span>
                  {snapshot.quote.position52 != null && (
                    <span className="ml-2 text-[11px] text-gray-500">
                      밴드 내 {Math.round(snapshot.quote.position52)}%
                    </span>
                  )}
                  {/* ⚠ 표본이 얇으면 그 사실을 말한다. 상장 직후 종목의 '52주'는 52주가 아니다. */}
                  {snapshot.quote.rangeSamples != null && snapshot.quote.rangeSamples < 200 && (
                    <span className="ml-2 text-[11px] text-amber-300">
                      ⚠ {snapshot.quote.rangeSamples}거래일치
                    </span>
                  )}
                </span>
              </div>
            )}

            {snapshot.quote.envelope && (
              <div className={row}>
                <span className={key}>Envelope</span>
                <span className={val}>
                  <span className="tabular-nums">
                    {Math.round(snapshot.quote.envelope.position)}% 위치
                  </span>
                  <span className="ml-2 text-[11px] text-gray-500 tabular-nums">
                    중심선 대비 {snapshot.quote.envelope.deviation >= 0 ? "+" : ""}
                    {snapshot.quote.envelope.deviation.toFixed(1)}%
                  </span>
                  {/* ⚠ 20주가 안 찼으면 숨기지 않는다 — 같은 굵기의 판단으로 읽힌다. */}
                  {snapshot.quote.envelope.weeks < 20 && (
                    <span className="ml-2 text-[11px] text-amber-300">
                      ⚠ {snapshot.quote.envelope.weeks}주로 계산
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* ⚠ 국내 종목은 Yahoo 경유라 지연·결측이 있다. 값과 같은 자리에서 말한다. */}
            {snapshot.quote.caveat && (
              <p className="px-1 py-1 text-[11px] text-amber-300">⚠ {snapshot.quote.caveat}</p>
            )}

            <div className={row}>
              <span className={key}>대표 포트폴리오</span>
              <span className={val}>
                {snapshot.holding.inPortfolio ? (
                  <>
                    편입 ·{" "}
                    {snapshot.holding.functionType
                      ? FUNCTION_LABEL_REPORT[snapshot.holding.functionType]
                      : "—"}{" "}
                    · 목표비중{" "}
                    {snapshot.holding.targetWeight != null
                      ? `${snapshot.holding.targetWeight}%`
                      : "—"}
                  </>
                ) : (
                  <span className="text-gray-500">미편입 (관찰 종목)</span>
                )}
              </span>
            </div>
          </div>

          {drift.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-[12px] text-amber-300">
                ⚠ 주입한 뒤 사이트 값이 {drift.length}건 움직였습니다. 보고서의 논지가 아직 유효한지
                보고, 다시 주입할지 정하세요.
              </p>
              <ul className="mt-2 space-y-1">
                {drift.map((d) => (
                  <li key={d.label} className="text-[12px] text-gray-300">
                    <span className="text-muted">{d.label}</span> — {d.before}{" "}
                    <span className="text-gray-600">→</span>{" "}
                    <span className="text-amber-200">{d.after}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* M축 — ⚠ 근거만 채운다 */}
          <div className="rounded-xl border border-border bg-[#12141c] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-gray-200">CANSLIM M축 근거 채우기</span>
              <form action={axisAction}>
                <input type="hidden" name="ticker" value={ticker} />
                <button
                  type="submit"
                  disabled={filling}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white disabled:opacity-40"
                >
                  {filling ? "채우는 중…" : "근거·출처·기준일 채우기"}
                </button>
              </form>
            </div>
            <p className="text-[11.5px] leading-relaxed text-gray-600">
              ⚠ {MARKET_AXIS_LIMITATION}
            </p>
            <p className="text-[11.5px] text-gray-600">
              ⚠ 이미 적어 둔 M축 근거·출처는 <strong className="text-gray-400">덮어씁니다.</strong>{" "}
              점수와 태그는 건드리지 않습니다.
            </p>
            {axisState.error && (
              <p role="alert" className="text-[12px] text-red-400">
                {axisState.error}
              </p>
            )}
            {axisState.notice && !axisState.error && (
              <p className="text-[12px] text-emerald-400">{axisState.notice}</p>
            )}
          </div>

          {/* 본문에 붙여 넣을 표 — ⚠ 프로그램이 본문을 대신 고치지 않는다 */}
          <div className="space-y-1.5">
            <p className="text-[11.5px] text-muted">
              §03 산업 분석 등에 붙여 넣을 목록 — 눌러서 전체 선택한 뒤 복사하세요.
            </p>
            <textarea
              readOnly
              value={markdown}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full min-h-[150px] rounded-xl border border-border bg-[#12141c] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-gray-300"
            />
          </div>
        </>
      )}
    </section>
  );
}
