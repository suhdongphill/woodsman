"use client";

/**
 * 키 등록 폼 — 입력하면 **암호화해서 DB에 저장**한다(2026-09-05에 바뀌었다).
 *
 * 전에는 로컬 `.env`에만 쓸 수 있어서 내 PC 앞에 있어야 했고, 그래서 실제로는
 * 키가 하나도 등록되지 않은 채였다. 이제 배포된 화면에서도 등록된다.
 *
 * ⚠ 저장된 키를 **다시 보여주지 않는다.** 입력칸은 저장 후 비우고, 서버도 값을 돌려주지 않는다.
 * ⚠ 화면에 나오는 것은 「어디에 저장됐는지 · 언제 · 지문」까지다.
 */
import { useActionState, useEffect, useRef } from "react";
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import { saveAiKeyAction } from "../actions";
import { emptyKeyFormState } from "../key-form-state";

/**
 * AI 제공자가 아니지만 성격이 같은 열쇠들.
 * ⚠ `note`는 **누가 이 키를 쓰는지**다. 안 적으면 "등록했는데 왜 안 먹지"가 생긴다.
 */
const EXTRA_ITEMS = [
  {
    name: "ECOS_API_KEY",
    label: "한국은행 ECOS",
    free: true,
    note: "사이트가 씁니다 — 거시 수집의 한국 기준금리. 넣으면 다음 수집부터 바로 들어옵니다.",
  },
  {
    name: "FRED_API_KEY",
    label: "FRED (세인트루이스 연준)",
    free: true,
    note: "⚠ 사이트는 쓰지 않습니다(관측치는 키 없이 받습니다). pms rates verify의 단위·계절조정 대조에만 필요하고, 그 CLI는 이 보관함을 읽지 못하므로 저장소 .env에도 같은 값을 넣어야 합니다.",
  },
];

const TEXT = {
  target: "어디 키",
  key: "API 키",
  keyPlaceholder: "발급받은 키를 붙여넣으세요",
  submit: "암호화해서 저장",
  saving: "저장 중…",
};

export function KeyRegisterForm({ stored }: { stored: string[] }) {
  const [state, formAction, pending] = useActionState(saveAiKeyAction, emptyKeyFormState);
  const inputRef = useRef<HTMLInputElement>(null);

  // 저장에 성공하면 입력칸을 비운다 — 화면에 키가 남아 있지 않게.
  useEffect(() => {
    if (state.savedName && inputRef.current) inputRef.current.value = "";
  }, [state.savedName]);

  const items = [
    ...AI_PROVIDERS.map((p) => ({ name: p.apiKeyEnv, label: p.label, free: p.free })),
    ...EXTRA_ITEMS,
  ];

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[190px] flex-1">
          <span className="mb-1 block text-[11px] text-muted">{TEXT.target}</span>
          <select
            name="apiKeyEnv"
            defaultValue={items[0].name}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink"
          >
            {items.map((item) => (
              <option key={item.name} value={item.name}>
                {item.label} {item.free ? "(무료)" : "(유료)"}
                {stored.includes(item.name) ? " · 저장됨" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[240px] flex-[2]">
          <span className="mb-1 block text-[11px] text-muted">{TEXT.key}</span>
          <input
            ref={inputRef}
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={TEXT.keyPlaceholder}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-[13px] text-ink"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? TEXT.saving : TEXT.submit}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {state.error}
        </p>
      )}
      {/* ⚠ 어느 키를 어디서 쓰는지 화면이 말한다 — 보관과 사용은 다른 일이다. */}
      <ul className="space-y-1">
        {EXTRA_ITEMS.map((item) => (
          <li key={item.name} className="text-[11.5px] leading-relaxed text-ink-3">
            <code className="text-gray-400">{item.name}</code> — {item.note}
          </li>
        ))}
      </ul>

      {state.savedName && (
        <p className="text-[12px] text-emerald-400">
          <code>{state.savedName}</code> 를 암호화해 저장했습니다. 다음 호출부터 이 값을 씁니다.
        </p>
      )}
    </form>
  );
}
