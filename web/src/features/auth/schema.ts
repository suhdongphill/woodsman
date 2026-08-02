/**
 * 인증 입력 검증 (zod).
 * 서버 액션과 Credentials.authorize()가 같은 스키마를 공유한다.
 */
import { z } from "zod";

/** 이메일은 대소문자를 구분하지 않는다 — 저장·조회 모두 소문자로 정규화한다. */
export const emailField = z
  .string()
  .trim()
  .min(1, "이메일을 입력하세요.")
  .email("이메일 형식이 올바르지 않습니다.")
  .transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email: emailField,
  // 로그인은 길이를 따지지 않는다(정책이 바뀌어도 기존 계정이 막히지 않도록).
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상이어야 합니다.")
    .max(20, "닉네임은 20자 이하여야 합니다."),
  email: emailField,
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72, "비밀번호가 너무 깁니다."),
  // bcrypt는 72바이트를 넘는 입력을 조용히 잘라내므로 위에서 미리 막는다.
  agree: z
    .boolean()
    .refine((v) => v === true, { message: "투자 판단 책임 고지에 동의해야 가입할 수 있습니다." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** zod 오류를 화면에 쓸 첫 메시지 하나로 줄인다. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}
