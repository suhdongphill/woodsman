/**
 * 수동 지표 입력 검증 — 순수 스키마.
 *
 * FRED·Yahoo가 주지 않는 지표(ISM·소비자신뢰·NAHB·달러인덱스·금·한국 기준금리·선행 PER)는
 * 손으로 넣는다. **값과 기준일을 함께** 받는다 — 날짜 없는 숫자는 언제 것인지 알 수 없고,
 * 이 사이트는 그런 숫자를 화면에 내지 않는다(대표 포트폴리오의 수기 시세와 같은 규칙).
 */
import { z } from "zod";
import { findIndicator } from "@/lib/macro/catalog";

export const manualPointSchema = z.object({
  seriesKey: z
    .string()
    .trim()
    .min(1, "지표를 선택하세요.")
    .refine((k) => findIndicator(k)?.source === "MANUAL", "수동 입력 대상 지표가 아닙니다."),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "기준일은 YYYY-MM-DD 형식이어야 합니다."),
  value: z
    .string()
    .trim()
    .min(1, "값을 입력하세요.")
    .transform((v) => Number(v.replace(/,/g, "")))
    .refine((v) => Number.isFinite(v), "숫자만 입력하세요."),
});

export const ingestScopeSchema = z.object({
  /** 비어 있으면 전체. 그룹 키를 주면 그 그룹만 다시 받는다. */
  group: z.string().trim().optional(),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}
