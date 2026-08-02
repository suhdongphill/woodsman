/**
 * `.env` 파일 텍스트를 다루는 순수 함수.
 *
 * 파일을 읽고 쓰는 건 여기서 하지 않는다(`features/ai/env-writer.ts`).
 * 텍스트 변환만 떼어 두면 "주석이 날아갔다", "따옴표가 깨졌다" 같은 사고를
 * 파일 없이 테스트로 잡을 수 있다.
 *
 * ⚠ 이 파일은 값을 절대 로그로 내보내지 않는다. 호출부도 그래야 한다.
 */

/** `.env`에 안전하게 넣기 위해 따옴표로 감싼다. */
export function quoteEnvValue(value: string): string {
  const trimmed = value.trim();
  // 큰따옴표와 역슬래시만 이스케이프하면 dotenv 계열이 그대로 읽는다.
  return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 키 한 줄을 넣거나 바꾼다.
 *
 * - 이미 있으면 **그 줄만** 교체한다(위치와 주변 주석을 보존).
 * - 없으면 파일 끝에 붙인다.
 * - 주석 처리된 `# GROQ_API_KEY=` 줄은 건드리지 않고 새 줄을 추가한다.
 *   주석은 사람이 남긴 메모라 지우면 안 된다.
 */
export function upsertEnvLine(content: string, name: string, value: string): string {
  const line = `${name}=${quoteEnvValue(value)}`;
  const pattern = new RegExp(`^${name}\\s*=.*$`, "m");

  if (pattern.test(content)) return content.replace(pattern, line);

  const base = content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
  return `${base}${line}\n`;
}

/** 여러 키를 한 번에. 순서대로 적용한다. */
export function upsertEnvLines(content: string, entries: Record<string, string>): string {
  return Object.entries(entries).reduce(
    (acc, [name, value]) => upsertEnvLine(acc, name, value),
    content,
  );
}

/**
 * 화면에 보여줄 마스킹. ⚠ 앞 4자리만 남긴다.
 * 전체를 보여주면 화면 캡처·어깨너머로 새고, 아무것도 안 보여주면
 * "어느 계정 키를 넣었더라"를 확인할 방법이 없다.
 */
export function maskKey(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return "•".repeat(8);
  return `${v.slice(0, 4)}${"•".repeat(8)}${v.slice(-2)}`;
}

/**
 * 형식이 말이 되는 키인지 최소 검증.
 * 제공자마다 접두사가 달라 엄격히 볼 수 없다 — **공백·줄바꿈만 거른다.**
 * (붙여넣기 사고의 대부분이 앞뒤 공백과 줄바꿈이다.)
 */
export function isPlausibleKey(value: string): boolean {
  const v = value.trim();
  return v.length >= 16 && !/\s/.test(v);
}
