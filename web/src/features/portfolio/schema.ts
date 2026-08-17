/**
 * 대표 포트폴리오 입력 검증 — 순수 스키마.
 *
 * 폼에서 오는 값은 전부 문자열이다. 여기서 타입과 범위를 한 번에 정리하고,
 * 통과한 것만 repository로 넘긴다.
 *
 * ## 여기서 정한 두 가지 규칙
 * 1. ⚠ **현재가를 적으면 기준일도 반드시 적는다.** 날짜 없는 숫자는 자동 시세처럼 읽힌다
 *    (`lib/manual-price.ts`). 폼이 오늘 날짜를 기본으로 채워 주므로 부담은 없다.
 * 2. **목표 비중 합계는 여기서 막지 않는다.** 종목을 하나씩 넣는 중엔 합계가 100%가
 *    아닌 게 정상이라, 막으면 중간 저장을 못 한다. 합계 경고는 화면이 맡는다
 *    (`lib/allocation.ts`의 `targetSumWarning`).
 */
import { z } from "zod";

const day = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

/** 빈 문자열을 undefined로 — 폼의 빈 칸이 ""로 저장되지 않게. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalDay = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "날짜는 YYYY-MM-DD 형식이어야 합니다.")
  .optional();

/** 숫자 칸. 콤마를 넣어도 받는다(원화 단가를 손으로 칠 때 자연스럽다). */
function optionalNumber(max: number, message: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v.replace(/,/g, ""))))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v >= 0 && v <= max),
      message,
    )
    .optional();
}

export const holdingSchema = z
  .object({
    name: z.string().trim().min(1, "종목명을 입력하세요.").max(80, "종목명이 너무 깁니다."),
    ticker: optionalText,
    market: optionalText,
    /**
     * 버킷 키(`PortfolioBucket.key`).
     * ⚠ 전에는 `z.enum(["GROWTH","INCOME","DEFENSE"])`였다. 관리자가 분류를 추가할 수
     *    있게 되면서 **여기서 목록을 고정하면 새 분류가 저장 거부된다.**
     *    "그 키가 실제로 있는가"는 DB를 봐야 알 수 있으므로 액션이 확인한다.
     */
    functionType: z
      .string()
      .trim()
      .min(1, "분류를 고르세요.")
      .max(24, "분류 키가 너무 깁니다."),
    targetWeight: optionalNumber(100, "목표 비중은 0~100 사이여야 합니다."),
    avgCost: optionalNumber(Number.MAX_SAFE_INTEGER, "0 이상의 숫자여야 합니다."),
    shares: optionalNumber(Number.MAX_SAFE_INTEGER, "0 이상의 숫자여야 합니다."),
    currency: z.enum(["KRW", "USD"]),
    price: optionalNumber(Number.MAX_SAFE_INTEGER, "0 이상의 숫자여야 합니다."),
    priceAsOf: optionalDay,
    thesis: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .refine((v) => v === undefined || v.length <= 2000, "편입 논리가 너무 깁니다.")
      .optional(),
    canslim: optionalNumber(10, "CANSLIM 점수는 0~10 사이여야 합니다."),
    blogUrl: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .refine((v) => v === undefined || /^https?:\/\//.test(v), "링크는 http(s)로 시작해야 합니다.")
      .optional(),
    order: optionalNumber(9999, "정렬 순서는 0~9999 사이여야 합니다."),
    published: z.boolean(),
  })
  .refine((v) => v.price === undefined || v.priceAsOf !== undefined, {
    // ⚠ 기준일 없는 현재가는 자동으로 갱신되는 시세처럼 읽힌다.
    message: "현재가를 적었으면 '시세 기준일'도 함께 적어야 합니다.",
    path: ["priceAsOf"],
  });

export const rebalanceSchema = z.object({
  date: day,
  memo: z
    .string()
    .trim()
    .min(2, "무엇을 어떻게 바꿨는지 적으세요.")
    .max(500, "메모가 너무 깁니다."),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}
