/**
 * 이 워커가 **어느 커밋으로 빌드됐는가.**
 *
 * ⚠ 2026-09-24까지 워커가 저장한 run은 `gitSha`가 전부 `null`이었다. CLI(`scripts/gcrm.mjs`)는
 *   찍는데 워커는 안 남겨, 설정을 바꾸는 순간 **그 전 run은 영영 재현할 수 없었다** —
 *   `config_hash`는 「달라졌다」만 말하고 「무엇이었는지」는 말하지 않는다.
 *
 * 값은 빌드 때 `next.config.ts`의 `env.GIT_SHA`로 박힌다(런타임에는 git이 없다).
 * CI는 `GITHUB_SHA`, 로컬은 `git rev-parse --short HEAD`. CLI와 같은 짧은 7자리로 맞춘다.
 *
 * ⚠ 모양이 커밋이 아니면 `null`이다 — 지어내지 않는다. 「없음」은 `verify`가
 *   「재현할 수 없다」고 **말하게** 되고, 틀린 sha는 **엉뚱한 커밋을 가리킨다.**
 */
const SHA = /^[0-9a-f]{7,40}$/;

export function buildGitSha(raw: string | undefined = process.env.GIT_SHA): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v || !SHA.test(v)) return null;
  return v.slice(0, 7);
}
