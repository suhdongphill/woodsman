import { describe, expect, it } from "vitest";
import { MASTER_MIN_LENGTH, isSealed, open, parseSealed, seal, sealFingerprint } from "./secret-box";

const MASTER = "0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER = "ffffffffffffffffffffffffffffffffffffffffffffffff";
const KEY_VALUE = "nvapi-실제로는-이런-모양의-키";

describe("인증키 봉투", () => {
  it("잠그고 푼다", async () => {
    const sealed = await seal(KEY_VALUE, "NVIDIA_API_KEY", MASTER);
    expect(await open(sealed, "NVIDIA_API_KEY", MASTER)).toBe(KEY_VALUE);
  });

  /** ⚠ 암호문 안에 평문이 보이면 암호화한 의미가 없다. 형식도 함께 본다. */
  it("⚠ 암호문에 평문이 남지 않는다", async () => {
    const sealed = await seal(KEY_VALUE, "NVIDIA_API_KEY", MASTER);
    expect(sealed).not.toContain(KEY_VALUE);
    expect(sealed).not.toContain("nvapi");
    expect(isSealed(sealed)).toBe(true);
    expect(sealed.startsWith("v1.")).toBe(true);
  });

  /** ⚠ 같은 값이 같은 암호문이 되면, 두 제공자가 같은 키를 쓰는지가 DB만 보고 드러난다. */
  it("⚠ 같은 값을 두 번 잠그면 다른 암호문이 나온다", async () => {
    const a = await seal(KEY_VALUE, "NVIDIA_API_KEY", MASTER);
    const b = await seal(KEY_VALUE, "NVIDIA_API_KEY", MASTER);
    expect(a).not.toBe(b);
    expect(await open(b, "NVIDIA_API_KEY", MASTER)).toBe(KEY_VALUE);
  });

  /** ⚠ 암호문을 다른 제공자 행으로 옮겨 심는 것을 막는다(추가 인증 데이터 = 이름). */
  it("⚠ 다른 이름으로는 열리지 않는다", async () => {
    const sealed = await seal(KEY_VALUE, "GROQ_API_KEY", MASTER);
    await expect(open(sealed, "ANTHROPIC_API_KEY", MASTER)).rejects.toThrow();
  });

  it("마스터 키가 다르면 열리지 않는다", async () => {
    const sealed = await seal(KEY_VALUE, "GROQ_API_KEY", MASTER);
    await expect(open(sealed, "GROQ_API_KEY", OTHER)).rejects.toThrow(/풀지 못했습니다/);
  });

  /** ⚠ "키가 없으니 평문으로"라는 경로를 만들지 않는다 — 저장 자체를 거부한다. */
  it("⚠ 마스터 키가 짧으면 잠그지 않는다", async () => {
    await expect(seal(KEY_VALUE, "GROQ_API_KEY", "짧다")).rejects.toThrow(
      new RegExp(`${MASTER_MIN_LENGTH}`),
    );
  });

  it("빈 값은 저장하지 않는다", async () => {
    await expect(seal("   ", "GROQ_API_KEY", MASTER)).rejects.toThrow();
  });

  /** ⚠ 평문이 그대로 DB에 들어 있는 상태를 조용히 넘기지 않는다. */
  it("⚠ 봉투가 아닌 값은 형식 단계에서 걸린다", () => {
    expect(isSealed("sk-평문키")).toBe(false);
    expect(() => parseSealed("sk-평문키")).toThrow(/봉투/);
    expect(() => parseSealed("v2.aaa.bbb")).toThrow();
  });

  it("지문은 짧고 값이 아니다", async () => {
    const sealed = await seal(KEY_VALUE, "GROQ_API_KEY", MASTER);
    const fp = await sealFingerprint(sealed);
    expect(fp).toHaveLength(8);
    expect(KEY_VALUE).not.toContain(fp);
  });
});
