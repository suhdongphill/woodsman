"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Input";
import { registerAction } from "../actions";
import { emptyAuthFormState } from "../form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" full size="md" disabled={pending}>
      {pending ? "가입 중…" : "가입하기"}
    </Button>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(registerAction, emptyAuthFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <TextField id="name" label="닉네임" type="text" placeholder="woodsman" required />
      <TextField
        id="email"
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <TextField
        id="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        placeholder="8자 이상"
        minLength={8}
        required
      />
      <label className="flex items-start gap-2.5 text-[12px] text-muted">
        <input
          type="checkbox"
          name="agree"
          required
          className="mt-0.5 w-4 h-4 rounded border-border bg-[#12141c] accent-[#36a06a]"
        />
        <span>
          투자 정보 제공 목적임에 동의하며, 모든 투자 판단의 책임은 본인에게 있음을 확인합니다.
        </span>
      </label>
      <SubmitButton />
    </form>
  );
}
