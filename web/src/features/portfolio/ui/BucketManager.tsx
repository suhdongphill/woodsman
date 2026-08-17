"use client";

/**
 * 대분류 버킷 관리 (`/admin/model-portfolio`).
 *
 * ## ⚠ 여기서 지키는 것
 * - **목표 구성비의 합이 100 미만인 것을 막지 않는다.** 남는 몫은 현금·미배정이고,
 *   화면이 그 몫을 **그대로 적는다.** 100을 강제하면 현금 보유를 버킷에 억지로 섞게 된다.
 * - **버킷 목표와 종목 배정분을 나란히 보여준다.** "성장 60% 목표 중 종목으로 45% 배정,
 *   15%는 아직 안 정함"이 한눈에 보여야 한다.
 * - **기본 버킷은 지울 수 없다.** 키를 AI 프롬프트 용어와 기존 보고서가 참조한다.
 *   버튼을 없애는 대신 **왜 못 지우는지를 화면이 말한다** — 안 보이는 규칙은 규칙이 아니다.
 * - 삭제는 확인 창을 띄우지 않는다(브라우저 dialog는 쓰지 않는다). 대신 종목이 든 버킷은
 *   서버가 거부하고 사유를 돌려준다.
 */
import { useActionState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { TrashIcon } from "@/components/icons";
import {
  BUCKET_TARGET_MAX,
  bucketTargetSum,
  cashTargetPct,
  type BucketBreakdown,
  type PortfolioBucket,
} from "@/lib/bucket-target";
import {
  createBucketAction,
  deleteBucketAction,
  saveBucketTargetsAction,
  updateBucketAction,
} from "../buckets-actions";
import { emptyBucketFormState, type BucketFormState } from "../buckets-form-state";

function Message({ state }: { state: BucketFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-2 text-[12px] text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.notice) return <p className="mt-2 text-[12px] text-emerald-400">{state.notice}</p>;
  return null;
}

const input =
  "w-full rounded-lg border border-border bg-[#12141c] px-2.5 py-1.5 text-[12.5px] text-gray-200 outline-none focus:border-gold-600/50";

export function BucketManager({
  buckets,
  breakdown,
  warning,
}: {
  buckets: PortfolioBucket[];
  /** 버킷 목표 대비 종목 배정분 */
  breakdown: BucketBreakdown[];
  /** 종목 합계가 버킷 목표를 넘었을 때의 한 문장 */
  warning: string | null;
}) {
  const [targetState, targetAction, savingTargets] = useActionState(
    saveBucketTargetsAction,
    emptyBucketFormState,
  );
  const [createState, createAction, creating] = useActionState(
    createBucketAction,
    emptyBucketFormState,
  );
  const [editState, editAction, editing] = useActionState(
    updateBucketAction,
    emptyBucketFormState,
  );
  const [deleteState, deleteAction] = useActionState(deleteBucketAction, emptyBucketFormState);

  const sum = bucketTargetSum(buckets);
  const cash = cashTargetPct(buckets);

  return (
    <div className="space-y-5">
      {/* ── 목표 구성비 ── */}
      <Card>
        <CardTitle>목표 구성비</CardTitle>
        <p className="mb-4 text-[11.5px] leading-relaxed text-gray-600">
          분류별로 얼마를 둘지 정합니다. ⚠ 합이 100%보다 작아도 됩니다 — 남는 몫은{" "}
          <strong className="text-gray-400">현금·미배정</strong>으로 공개 화면에 그대로 표시됩니다.
          100%를 넘으면 저장되지 않습니다.
        </p>

        <form action={targetAction} className="space-y-3">
          {breakdown.map((row) => (
            <div
              key={row.bucket.key}
              className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3"
            >
              <span className="flex min-w-[7rem] items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.bucket.color }}
                />
                <span className="text-[12.5px] text-gray-200">{row.bucket.name}</span>
              </span>

              <label className="flex items-center gap-1.5">
                <input
                  type="number"
                  name={`target.${row.bucket.key}`}
                  defaultValue={row.bucket.targetPct}
                  min={0}
                  max={BUCKET_TARGET_MAX}
                  step="0.1"
                  className="w-20 rounded-lg border border-border bg-[#12141c] px-2 py-1.5 text-right text-[12.5px] tabular-nums text-gray-200 outline-none focus:border-gold-600/50"
                  aria-label={`${row.bucket.name} 목표 비중 %`}
                />
                <span className="text-[12px] text-gray-500">%</span>
              </label>

              {/* ⚠ 배정분과 미배정분을 함께 — 버킷이 상위, 종목이 하위다 */}
              <span className="text-[11.5px] tabular-nums text-gray-600">
                종목 배정 {row.assignedPct}%
                {row.unassignedPct > 0 && (
                  <span className="ml-1.5 text-gold-500">· 미배정 {row.unassignedPct}%</span>
                )}
                {row.overAssignedPct > 0 && (
                  <span className="ml-1.5 text-red-400">· 초과 {row.overAssignedPct}%p</span>
                )}
                <span className="ml-1.5 text-gray-700">({row.holdings}종목)</span>
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[12.5px] tabular-nums text-gray-400">
              합계 <span className={sum > BUCKET_TARGET_MAX ? "text-red-400" : "text-white"}>{sum}%</span>
              <span className="ml-3 text-gray-600">
                현금·미배정 <span className="text-gray-400">{cash}%</span>
              </span>
            </p>
            <button
              type="submit"
              disabled={savingTargets}
              className="rounded-xl border border-gold-600/40 px-3 py-2 text-[12.5px] text-gold-300 transition-colors hover:bg-gold-600/10 disabled:opacity-40"
            >
              {savingTargets ? "저장 중…" : "목표 구성비 저장"}
            </button>
          </div>
        </form>

        <Message state={targetState} />

        {/* ⚠ 넘친 것만 말한다. 모자란 것은 채우는 중일 수 있어 경고하지 않는다 */}
        {warning && <p className="mt-2 text-[12px] text-red-400">⚠ {warning}</p>}
      </Card>

      {/* ── 버킷 자체 ── */}
      <Card>
        <CardTitle>분류 관리</CardTitle>
        <p className="mb-4 text-[11.5px] leading-relaxed text-gray-600">
          운영 전략이 바뀌면 분류를 더하거나 지울 수 있습니다. ⚠ <strong className="text-gray-400">키</strong>는
          보유 종목과 기존 보고서가 참조하므로 만든 뒤 바꿀 수 없습니다 — 이름은 바꿀 수 있습니다.
        </p>

        <ul className="space-y-3">
          {breakdown.map((row) => (
            <li key={row.bucket.key} className="rounded-xl border border-border/70 p-3">
              <form action={editAction} className="flex flex-wrap items-end gap-2.5">
                <input type="hidden" name="key" value={row.bucket.key} />

                <label className="min-w-[8rem] flex-1">
                  <span className="mb-1 block text-[11px] text-muted">이름</span>
                  <input name="name" defaultValue={row.bucket.name} className={input} required />
                </label>

                <label className="min-w-[12rem] flex-[2]">
                  <span className="mb-1 block text-[11px] text-muted">설명(공개 화면)</span>
                  <input
                    name="description"
                    defaultValue={row.bucket.description ?? ""}
                    className={input}
                    placeholder="이 분류가 맡은 역할"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-[11px] text-muted">색</span>
                  <input
                    type="color"
                    name="color"
                    defaultValue={row.bucket.color}
                    className="h-[34px] w-14 cursor-pointer rounded-lg border border-border bg-[#12141c]"
                    aria-label={`${row.bucket.name} 색`}
                  />
                </label>

                <label className="w-20">
                  <span className="mb-1 block text-[11px] text-muted">순서</span>
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={row.bucket.sortOrder}
                    className={input}
                  />
                </label>

                <button
                  type="submit"
                  disabled={editing}
                  className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white disabled:opacity-40"
                >
                  저장
                </button>
              </form>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code className="rounded bg-cardHover px-1.5 py-0.5 text-[10.5px] text-gray-500">
                  {row.bucket.key}
                </code>

                {row.bucket.builtIn ? (
                  // ⚠ 버튼을 감추지 않고 왜 못 지우는지 적는다 — 안 보이는 규칙은 규칙이 아니다.
                  <span className="text-[11px] text-gray-600">
                    기본 분류라 지울 수 없습니다. 쓰지 않으려면 목표 비중을 0%로 두세요.
                  </span>
                ) : row.holdings > 0 ? (
                  <span className="text-[11px] text-gray-600">
                    보유 종목 {row.holdings}건이 있어 지울 수 없습니다. 먼저 옮기세요.
                  </span>
                ) : (
                  <form action={deleteAction}>
                    <input type="hidden" name="key" value={row.bucket.key} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11.5px] text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      분류 삭제
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Message state={editState} />
        <Message state={deleteState} />

        {/* ── 추가 ── */}
        <form action={createAction} className="mt-5 border-t border-border pt-4">
          <p className="mb-3 text-[12px] text-gray-400">분류 추가</p>
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="w-32">
              <span className="mb-1 block text-[11px] text-muted">키 (영문 대문자)</span>
              <input
                name="key"
                className={input}
                placeholder="ALT"
                required
                pattern="[A-Za-z][A-Za-z0-9_]{1,23}"
                title="영문으로 시작하는 2~24자(영문·숫자·밑줄)"
              />
            </label>

            <label className="w-32">
              <span className="mb-1 block text-[11px] text-muted">이름</span>
              <input name="name" className={input} placeholder="대체투자" required />
            </label>

            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-[11px] text-muted">설명(선택)</span>
              <input name="description" className={input} placeholder="이 분류가 맡은 역할" />
            </label>

            <label>
              <span className="mb-1 block text-[11px] text-muted">색</span>
              <input
                type="color"
                name="color"
                defaultValue="#8b5cf6"
                className="h-[34px] w-14 cursor-pointer rounded-lg border border-border bg-[#12141c]"
                aria-label="새 분류 색"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="rounded-xl border border-gold-600/40 px-3 py-2 text-[12.5px] text-gold-300 transition-colors hover:bg-gold-600/10 disabled:opacity-40"
            >
              {creating ? "만드는 중…" : "분류 추가"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-600">
            ⚠ 키는 만든 뒤 바꿀 수 없습니다. 목표 비중 0%로 만들어지니 위에서 정하세요.
          </p>
        </form>

        <Message state={createState} />
      </Card>
    </div>
  );
}
