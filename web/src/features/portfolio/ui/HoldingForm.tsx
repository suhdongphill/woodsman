"use client";

/**
 * 대표 포트폴리오 종목 작성·수정 폼.
 *
 * 목록에서 "수정"을 누르면 `?edit=<id>`로 돌아와 그 종목을 채워 넣는다.
 * 새 종목은 빈 폼이다.
 *
 * ⚠ 현재가 칸 옆에 **기준일**이 붙어 있다. 스키마가 둘을 함께 요구한다 —
 *    날짜 없는 숫자는 자동으로 갱신되는 시세처럼 읽히기 때문이다.
 */
import { useActionState } from "react";
import Link from "next/link";
import { saveHoldingAction } from "../actions";
import { emptyPortfolioFormState } from "../form-state";
import type { ModelHolding } from "@/lib/types";

const FUNCTIONS = [
  { value: "GROWTH", label: "성장" },
  { value: "INCOME", label: "인컴" },
  { value: "DEFENSE", label: "방어" },
] as const;

const field =
  "w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function HoldingForm({ holding, today }: { holding?: ModelHolding; today: string }) {
  const [state, formAction, pending] = useActionState(saveHoldingAction, emptyPortfolioFormState);

  return (
    <form action={formAction} className="space-y-3">
      {holding && <input type="hidden" name="id" value={holding.id} />}

      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-2">
          <span className={label}>종목명</span>
          <input
            name="name"
            defaultValue={holding?.name}
            placeholder="예: 맥쿼리인프라"
            className={field}
          />
        </label>
        <label>
          <span className={label}>티커</span>
          <input name="ticker" defaultValue={holding?.ticker} className={field} />
        </label>
        <label>
          <span className={label}>시장</span>
          <input
            name="market"
            defaultValue={holding?.market}
            placeholder="KOSPI · NYSE · CASH"
            className={field}
          />
        </label>
        <label>
          <span className={label}>기능 분류</span>
          <select
            name="functionType"
            defaultValue={holding?.functionType ?? "GROWTH"}
            className={field}
          >
            {FUNCTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
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
          <select name="currency" defaultValue={holding?.currency ?? "KRW"} className={field}>
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          <span className={label}>현재가 (수기)</span>
          <input name="price" defaultValue={holding?.price} className={field} />
        </label>
        <label>
          <span className={label}>시세 기준일</span>
          <input
            type="date"
            name="priceAsOf"
            defaultValue={holding?.priceAsOf ?? (holding ? "" : today)}
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
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "저장 중…" : holding ? "수정 저장" : "종목 추가"}
          </button>
        </div>
      </div>
    </form>
  );
}
