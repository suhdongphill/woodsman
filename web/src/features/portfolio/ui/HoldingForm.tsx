"use client";

/**
 * 대표 포트폴리오 종목 작성·수정 폼.
 *
 * 목록에서 "수정"을 누르면 `?edit=<id>`로 돌아와 그 종목을 채워 넣는다.
 * 새 종목은 빈 폼이다.
 *
 * ⚠ 현재가 칸 옆에 **기준일**이 붙어 있다. 스키마가 둘을 함께 요구한다 —
 *    날짜 없는 숫자는 자동으로 갱신되는 시세처럼 읽히기 때문이다.
 *
 * ## ⚠ 조회를 먼저 한다 (2026-08-17)
 * 전에는 조회가 없어서 이름·시장·통화·현재가를 전부 손으로 쳤고, **티커만 치고 Enter를
 * 누르면 나머지가 텅 빈 종목이 그대로 등록됐다.** 두 가지로 막는다.
 *   1. **Enter로는 제출되지 않는다.** 텍스트 칸에서 Enter는 조회를 부른다.
 *      (여러 줄을 쓰는 편입 논리 칸은 그대로 둔다.)
 *   2. **조회로 확인되기 전에는 등록 버튼이 눌리지 않는다.**
 *      ⚠ 다만 조회가 막혔을 때를 위해 "직접 입력" 통로를 남긴다 — Yahoo가 죽었다고
 *      종목을 못 넣게 되면 안 된다. 대신 그 경우 사람이 명시적으로 눌러야 한다.
 * ⚠ 기존 종목을 **수정**할 때는 이미 확인된 것이라 조회를 요구하지 않는다.
 */
import { useActionState, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { saveHoldingAction } from "../actions";
import { lookupTickerAction } from "../lookup-actions";
import { emptyPortfolioFormState } from "../form-state";
import type { LookupResult } from "../lookup-form-state";
import type { ModelHolding } from "@/lib/types";
import type { PortfolioBucket } from "@/lib/bucket-target";

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function HoldingForm({
  holding,
  today,
  buckets,
}: {
  holding?: ModelHolding;
  today: string;
  /** ⚠ 관리자가 만든 분류 그대로. 목록을 코드에 박으면 새 분류가 저장 거부된다 */
  buckets: PortfolioBucket[];
}) {
  const [state, formAction, pending] = useActionState(saveHoldingAction, emptyPortfolioFormState);

  // 조회 결과 — 이 값이 있어야 등록 버튼이 열린다.
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [looking, startLookup] = useTransition();
  /** ⚠ 조회를 건너뛰고 직접 넣겠다고 사람이 명시적으로 누른 경우 */
  const [manual, setManual] = useState(false);

  // 폼 칸 값 — 조회 결과로 덮어쓰려면 제어 컴포넌트여야 한다.
  const [ticker, setTicker] = useState(holding?.ticker ?? "");
  const [market, setMarket] = useState(holding?.market ?? "");
  const [name, setName] = useState(holding?.name ?? "");
  const [currency, setCurrency] = useState(holding?.currency ?? "KRW");
  const [price, setPrice] = useState(holding?.price != null ? String(holding.price) : "");
  const [priceAsOf, setPriceAsOf] = useState(holding?.priceAsOf ?? (holding ? "" : today));

  /** 조회에 쓸 시장 — 티커 모양으로 정한다(6자리 숫자면 국내). */
  const lookupMarket = /^\d{6}$/.test(ticker.trim()) ? "KR" : "US";

  function runLookup() {
    const t = ticker.trim();
    if (!t || looking) return;
    startLookup(async () => {
      const result = await lookupTickerAction(t, lookupMarket);
      setLookup(result);
      if (!result.ok) return;

      // ⚠ 빈 칸만 채우지 않는다 — 조회는 "확인"이므로 조회한 값으로 맞춘다.
      //    다만 사람이 이미 적어 둔 이름은 덮지 않는다(별칭을 쓰는 경우가 있다).
      if (result.profile.name && !name.trim()) setName(result.profile.name);
      if (result.profile.exchange) setMarket(result.profile.exchange);
      if (result.profile.currency === "KRW" || result.profile.currency === "USD") {
        setCurrency(result.profile.currency);
      }
      if (result.profile.price != null) setPrice(String(result.profile.price));
      // ⚠ 현재가를 채웠으면 기준일도 반드시 함께 채운다(스키마가 둘을 같이 요구한다).
      if (result.profile.asOf) setPriceAsOf(result.profile.asOf);
    });
  }

  /**
   * ⚠ Enter로 제출하지 않는다.
   *
   * 텍스트 칸에서 Enter는 **조회**를 부른다 — 사용자가 기대하는 동작이 그것이었고,
   * 실제로는 폼이 제출되어 빈 종목이 등록됐다. 여러 줄을 쓰는 textarea는 건드리지 않는다.
   */
  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (target.getAttribute("name") === "ticker") runLookup();
  }

  // 조회로 확인됐거나, 수정 중이거나, 사람이 직접 입력을 택했을 때만 등록할 수 있다.
  const verified = !!holding || manual || (lookup?.ok ?? false);

  /** ⚠ 마지막 방어선 — 확인 전에는 제출 자체를 막는다(버튼 disabled만으로는 부족하다). */
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!verified) e.preventDefault();
  }

  return (
    <form action={formAction} onKeyDown={onKeyDown} onSubmit={onSubmit} className="space-y-3">
      {holding && <input type="hidden" name="id" value={holding.id} />}

      {/* ── 조회 ── ⚠ 여기서 확인해야 아래 등록 버튼이 열린다 */}
      {!holding && (
        <div className="rounded-xl border border-border/70 bg-bg p-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="w-40">
              <span className={label}>티커로 조회</span>
              <input
                name="ticker"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value);
                  // 티커를 고치면 이전 조회 결과는 더 이상 이 종목의 것이 아니다.
                  setLookup(null);
                  setManual(false);
                }}
                placeholder="NVDA · 005930"
                className={field}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={runLookup}
              disabled={looking || !ticker.trim()}
              className="rounded-xl border border-gold-600/40 px-3 py-2 text-[13px] text-gold-300 transition-colors hover:bg-gold-600/10 disabled:opacity-40"
            >
              {looking ? "조회 중…" : "조회"}
            </button>
            <span className="text-[11.5px] text-gray-600">
              {lookupMarket === "KR" ? "국내(6자리 숫자)로 봅니다" : "미국 종목으로 봅니다"}
            </span>
          </div>

          {lookup?.ok === false && (
            <p role="alert" className="mt-2 text-[12px] text-red-400">
              {lookup.error}
            </p>
          )}
          {lookup?.ok && (
            <p className="mt-2 text-[12px] text-emerald-400">
              {lookup.symbol} 확인 — {lookup.profile.name ?? "이름 없음"}
              {lookup.profile.instrumentType && (
                <span className="ml-1.5 text-gray-500">({lookup.profile.instrumentType})</span>
              )}
              {/* ⚠ 국내 시세는 지연·결측이 있다. 값과 같은 자리에서 말한다. */}
              {lookup.caveat && <span className="ml-1.5 text-amber-400">⚠ {lookup.caveat}</span>}
            </p>
          )}

          {/* ⚠ 조회가 막혀도 종목을 못 넣게 되면 안 된다. 다만 사람이 명시적으로 택하게 한다. */}
          {!verified && (
            <button
              type="button"
              onClick={() => setManual(true)}
              className="mt-2 text-[11.5px] text-gray-500 underline underline-offset-2 hover:text-gray-300"
            >
              조회 없이 직접 입력하겠습니다
            </button>
          )}
          {manual && (
            <p className="mt-2 text-[11.5px] text-amber-400">
              ⚠ 직접 입력 모드입니다. 이름·시장·통화·현재가가 맞는지 스스로 확인하세요.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-2">
          <span className={label}>종목명</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 맥쿼리인프라"
            className={field}
          />
        </label>
        {holding && (
          <label>
            <span className={label}>티커</span>
            <input
              name="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className={field}
            />
          </label>
        )}
        <label>
          <span className={label}>시장</span>
          <input
            name="market"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="KOSPI · NYSE · CASH"
            className={field}
          />
        </label>
        <label>
          <span className={label}>분류</span>
          <select
            name="functionType"
            defaultValue={holding?.functionType ?? buckets[0]?.key ?? ""}
            className={field}
          >
            {buckets.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
            {/* ⚠ 옛 분류를 쓰던 종목이면 그 키를 목록에 남긴다 —
                안 그러면 저장할 때 조용히 다른 분류로 바뀐다. */}
            {holding?.functionType && !buckets.some((b) => b.key === holding.functionType) && (
              <option value={holding.functionType}>
                {holding.functionType} (없는 분류)
              </option>
            )}
          </select>
        </label>
        <label>
          <span className={label}>목표 비중(%)</span>
          <input
            name="targetWeight"
            type="number"
            step="any"
            defaultValue={holding?.targetWeight}
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <label>
          <span className={label}>평균 매입가</span>
          <input name="avgCost" defaultValue={holding?.avgCost} className={field} />
        </label>
        <label>
          <span className={label}>수량</span>
          <input name="shares" defaultValue={holding?.shares} className={field} />
        </label>
        <label>
          <span className={label}>통화</span>
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "KRW" | "USD")}
            className={field}
          >
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          <span className={label}>현재가 (수기)</span>
          <input
            name="price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>시세 기준일</span>
          <input
            type="date"
            name="priceAsOf"
            value={priceAsOf}
            onChange={(e) => setPriceAsOf(e.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>CANSLIM (0~10)</span>
          <input name="canslim" defaultValue={holding?.canslim} className={field} />
        </label>
      </div>

      <label className="block">
        <span className={label}>편입 논리 — 왜 이 종목이 이 버킷에 있나</span>
        <textarea
          name="thesis"
          rows={3}
          defaultValue={holding?.thesis}
          placeholder="무엇을 사는 것이고, 무엇이 깨지면 파는지까지 적어 두면 나중에 그때의 판단을 재현할 수 있습니다."
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-4">
          <span className={label}>관련 글 링크 (선택)</span>
          <input
            name="blogUrl"
            defaultValue={holding?.blogUrl}
            placeholder="https://"
            className={field}
          />
        </label>
        <label>
          <span className={label}>정렬 순서</span>
          <input
            name="order"
            type="number"
            defaultValue={holding?.order}
            placeholder="비우면 맨 뒤"
            className={field}
          />
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-600">
        ⚠ 현재가는 자동으로 갱신되지 않습니다. 손으로 적은 값이라 기준일을 함께 남기고,
        공개 화면에도 그 날짜가 그대로 나갑니다.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-[12.5px] text-gray-300">
          <input
            type="checkbox"
            name="published"
            defaultChecked={holding?.published ?? true}
            className="h-4 w-4 accent-emerald-500"
          />
          공개 화면에 노출
        </label>

        <div className="flex items-center gap-3">
          {state.error && (
            <span role="alert" className="text-[12px] text-red-400">
              {state.error}
            </span>
          )}
          {state.savedAt && !state.error && (
            <span className="text-[12px] text-emerald-400">저장했습니다</span>
          )}
          {holding && (
            <Link
              href="/admin/model-portfolio"
              className="rounded-xl border border-border px-3 py-2 text-[13px] text-gray-300 transition-colors hover:bg-cardHover"
            >
              편집 취소
            </Link>
          )}
          <button
            type="submit"
            disabled={pending || !verified}
            title={verified ? undefined : "먼저 티커를 조회하세요"}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "저장 중…" : holding ? "수정 저장" : "종목 추가"}
          </button>
        </div>
      </div>
    </form>
  );
}
