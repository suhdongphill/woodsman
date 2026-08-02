"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Input";
import { loginAction } from "../actions";
import { emptyAuthFormState } from "../form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="emerald" full size="md" disabled={pending}>
      {pending ? "확인 중…" : "로그인"}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, emptyAuthFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
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
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />
      <SubmitButton />
    </form>
  );
}
