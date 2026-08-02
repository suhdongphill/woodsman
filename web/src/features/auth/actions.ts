"use server";

/**
 * 로그인 · 회원가입 · 로그아웃 서버 액션.
 *
 * 원칙
 *  - role은 절대 폼에서 받지 않는다. 가입은 항상 USER로 고정하고, ADMIN은 시드만 만든다.
 *  - 로그인 실패 사유를 세분화하지 않는다(계정 존재 여부 노출 방지).
 *  - 복귀 경로(next)는 같은 사이트 절대경로만 허용한다(오픈 리다이렉트 방지).
 */
import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { safeNextPath } from "@/lib/access";
import { emptyAuthFormState, type AuthFormState } from "./form-state";
import { firstIssueMessage, loginSchema, registerSchema } from "./schema";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const redirectTo = safeNextPath(text(formData, "next"));

  try {
    await signIn("credentials", { ...parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    // 성공 시 Next.js가 던지는 NEXT_REDIRECT는 여기로 흘려보내야 이동이 완료된다.
    throw error;
  }

  return emptyAuthFormState;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    agree: checked(formData, "agree"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password, 12);

  try {
    await db.user.create({ data: { name, email, passwordHash, role: "USER" } });
  } catch {
    // email @unique 위반(동시 가입 포함) — 사유를 구체적으로 나누지 않는다.
    return { error: "이미 가입된 이메일이거나 가입 처리에 실패했습니다." };
  }

  const redirectTo = safeNextPath(text(formData, "next"));

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "가입은 완료됐습니다. 로그인 화면에서 다시 시도해 주세요." };
    }
    throw error;
  }

  return emptyAuthFormState;
}

export async function socialLoginAction(formData: FormData): Promise<void> {
  const provider = text(formData, "provider");
  const redirectTo = safeNextPath(text(formData, "next"));
  await signIn(provider, { redirectTo });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
