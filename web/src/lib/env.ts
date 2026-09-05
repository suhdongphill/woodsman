/**
 * 서버 전용 환경변수 검증.
 * - 이 모듈은 절대 클라이언트 컴포넌트에서 import 하지 않는다(빌드 시 키가 번들에 섞임).
 * - 키 '값'은 여기서만 읽고, 그 외 코드에는 "연결됨/미설정" 같은 파생 정보만 전달한다.
 */
import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL이 비어 있습니다. npm run setup 을 실행하세요."),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET은 32자 이상이어야 합니다. npm run setup 이 자동 생성합니다."),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL 형식이 올바르지 않습니다."),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD는 8자 이상이어야 합니다."),

  /** 운영 배포 주소. 비워두면 요청 Host를 쓴다(로컬 개발). */
  AUTH_URL: optionalSecret,
  /** 검색엔진에 알릴 정식 주소. 비어 있으면 robots가 전체 차단으로 동작한다. */
  SITE_URL: optionalSecret,
  /** Google AdSense 퍼블리셔 ID(ca-pub-...). 없으면 광고 스크립트를 넣지 않는다. */
  ADSENSE_CLIENT_ID: optionalSecret,

  /**
   * 자동 수집(Cron Trigger)이 자기 자신임을 밝히는 값. 32자 이상.
   * ⚠ 없으면 스케줄이 돌아도 `/api/cron`이 **거부**한다 — 설정 누락이 "누구나 통과"가 되면
   *    바깥 서버를 대신 두드리는 문이 열린다(`src/lib/cron.ts`).
   */
  CRON_SECRET: optionalSecret,

  /**
   * 한국은행 ECOS 오픈API 인증키(무료 발급). 한국 기준금리를 자동으로 받는 데 쓴다.
   * ⚠ 없으면 그 지표만 실패로 남는다 — 조용히 건너뛰지 않는다(`features/macro/ingest.ts`).
   * 발급: https://ecos.bok.or.kr/api/#/AuthKeyApply
   */
  ECOS_API_KEY: optionalSecret,

  /**
   * AI 제공자 키. 이름은 `src/lib/ai/catalog.ts`의 apiKeyEnv와 1:1로 맞춰야 한다
   * (여기에 없으면 `npm run ai:sync`가 Cloudflare로 올리지 못한다).
   */
  NVIDIA_API_KEY: optionalSecret,
  GROQ_API_KEY: optionalSecret,
  GEMINI_API_KEY: optionalSecret,
  OPENROUTER_API_KEY: optionalSecret,
  DEEPSEEK_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  OPENAI_API_KEY: optionalSecret,

  AUTH_GOOGLE_ID: optionalSecret,
  AUTH_GOOGLE_SECRET: optionalSecret,
  AUTH_KAKAO_ID: optionalSecret,
  AUTH_KAKAO_SECRET: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** process.env 또는 테스트용 평범한 객체 */
export type EnvSource = Record<string, string | undefined>;

/** 시드·서버 라우트에서 사용. 실패 시 사람이 읽을 수 있는 메시지로 종료한다. */
export function parseServerEnv(source: EnvSource = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`환경변수 설정이 올바르지 않습니다.\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** 값 노출 없이 "연결됨" 여부만 판단한다. */
export function hasEnvKey(name: string, source: EnvSource = process.env): boolean {
  const v = source[name];
  return typeof v === "string" && v.trim().length > 0;
}

export { serverEnvSchema };
