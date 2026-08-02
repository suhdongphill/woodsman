/**
 * 투자일지 · 계좌 스냅샷 입력 검증 — 순수 스키마.
 *
 * 폼에서 오는 값은 전부 문자열이다. 여기서 한 번에 타입과 범위를 정리하고,
 * 통과한 것만 repository로 넘긴다. 화면과 액션이 같은 규칙을 쓰게 하려고 분리했다.
 */
import { z } from "zod";

const day = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

/** 빈 문자열을 undefined로 — 폼의 빈 칸이 0이나 ""로 저장되지 않게. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "0 이상의 숫자여야 합니다.")
  .optional();

const requiredNumber = z
  .string()
  .trim()
  .min(1, "필수 항목입니다.")
  .transform((v) => Number(v.replace(/,/g, "")))
  .refine((v) => Number.isFinite(v) && v >= 0, "0 이상의 숫자여야 합니다.");

export const journalSchema = z.object({
  date: day,
  action: z.enum(["BUY", "SELL", "REBALANCE", "NOTE"]),
  title: z.string().trim().min(2, "제목을 입력하세요.").max(120, "제목이 너무 깁니다."),
  body: z.string().trim().min(2, "내용을 입력하세요.").max(4000, "내용이 너무 깁니다."),
  ticker: optionalText,
  name: optionalText,
  shares: optionalNumber,
  price: optionalNumber,
  currency: z.enum(["KRW", "USD"]).optional(),
  postSlug: optionalText,
  published: z.boolean(),
});

export const snapshotSchema = z.object({
  date: day,
  principal: requiredNumber,
  value: requiredNumber,
  income: requiredNumber,
  memo: optionalText,
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}
