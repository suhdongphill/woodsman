"use client";

/**
 * 자료 가져오기 버튼.
 *
 * ## 왜 결과를 이렇게 자세히 보여주나
 * 이 버튼은 외부 사이트 수십 곳에 요청을 보낸다. 일부는 실패한다(발표 지연, 시리즈 폐기,
 * 상대 서버 차단). **성공만 보여주면 실패한 지표는 옛 값을 그대로 달고 화면에 남는다.**
 * 그래서 실패한 지표와 사유를 그 자리에서 목록으로 보여준다.
 *
 * 누르고 나서 20~30초가 걸릴 수 있어, 진행 중임을 버튼과 안내 문구 양쪽에 표시한다
 * (반응이 없으면 사용자는 두 번 누른다).
 */
import { useActionState } from "react";
import { ingestMacroAction } from "../actions";
import { emptyMacroFormState } from "../form-state";
import { MACRO_GROUPS } from "@/lib/macro/groups";

export function IngestPanel() {
  const [state, formAction, pending] = useActionState(ingestMacroAction, emptyMacroFormState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2.5 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "가져오는 중… (최대 30초)" : "전체 자료 가져오기"}
          </button>
        </form>

        {pending && (
          <span role="status" className="text-[12px] text-gray-400">
            FRED·Yahoo에 순서대로 요청하고 있습니다. 창을 닫지 마세요.
          </span>
        )}
        {!pending && state.summary && (
          <span className="text-[12px] text-emerald-400">{state.summary}</span>
        )}
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
      </div>

      {/* 묶음별 재시도 — 한 그룹만 실패했을 때 전체를 다시 돌리지 않게 */}
      <div className="flex flex-wrap gap-2">
        {MACRO_GROUPS.map((g) => (
          <form key={g.key} action={formAction}>
            <input type="hidden" name="group" value={g.key} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink disabled:opacity-50"
            >
              {g.emoji} {g.name}만
            </button>
          </form>
        ))}
      </div>

      {/* ⚠ 실패를 숨기지 않는다 */}
      {state.failures && state.failures.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4">
          <p className="text-[12.5px] font-semibold text-red-300">
            받지 못한 지표 {state.failures.length}개 — 이 지표들은 이전 값이 그대로 남아 있습니다
          </p>
          <ul className="mt-2 space-y-1">
            {state.failures.map((f) => (
              <li key={f.key} className="text-[11.5px] text-red-200/80">
                <code className="text-red-300">{f.key}</code> · {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
