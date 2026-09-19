/**
 * GCRM v2 — 설정 지문 `config_hash` (명세 §2-17 · §C-6).
 *
 * ## 무엇을 해시하는가 — ⚠ 파일이 아니라 **값**이다
 * 명세는 「설정 파일 6개를 정렬된 순서로 직렬화해 SHA-256」이라고 적었다.
 * 우리는 설정이 YAML 파일이 아니라 TS 데이터 모듈이고, Worker는 자기 소스를 읽지 못한다.
 * 그래서 **6벌의 설정 객체를 키 정렬 JSON으로 직렬화해** 해시한다.
 *
 * 이쪽이 더 정확하다:
 * - 주석·들여쓰기·줄바꿈을 고쳐도 지문이 **바뀌지 않는다**
 * - 값이 한 글자라도 바뀌면 **반드시 바뀐다**
 *
 * 재현성의 목적이 「그날의 계산을 되살리는 것」이므로, 계산에 들어가는 값만 지문에 들어가는 것이 맞다.
 * ⚠ 다만 완료 기준의 문장이 좁아진다 — 「설정 한 글자」가 아니라 **「설정값 한 글자」**다.
 *
 * ## ⚠ 함수·undefined는 직렬화되지 않는다
 * 설정에 함수를 넣으면 지문에서 **조용히 사라진다.** 그래서 `canonicalize()`가 함수를 만나면 던진다.
 * 설정 파일에는 데이터만 둔다(계산은 다른 파일이 한다).
 */

/** 키를 정렬해 결정적인 JSON을 만든다. ⚠ 배열의 순서는 **뜻이 있으므로 정렬하지 않는다.** */
export function canonicalize(value: unknown, path = "$"): unknown {
  if (value === null) return null;
  if (typeof value === "function") {
    throw new Error(`config_hash: 설정에 함수가 있다(${path}). 설정 파일에는 데이터만 둔다.`);
  }
  if (typeof value === "undefined") {
    throw new Error(`config_hash: 설정에 undefined가 있다(${path}). 빠뜨린 값인지 확인하라.`);
  }
  if (Array.isArray(value)) return value.map((v, i) => canonicalize(v, `${path}[${i}]`));
  if (value instanceof Map) {
    throw new Error(`config_hash: 설정에 Map이 있다(${path}). 직렬화 순서가 보장되지 않는다.`);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      // ⚠ 선택 필드(undefined)는 **없는 것으로 친다.** 있다가 지워도 지문이 같아야 하기 때문이다.
      if (typeof v === "undefined") continue;
      out[key] = canonicalize(v, `${path}.${key}`);
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** 명세 §2-17 — SHA-256 **앞 12자**. Worker·Node 양쪽에서 같은 Web Crypto를 쓴다. */
export const CONFIG_HASH_LENGTH = 12;

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 설정 6벌의 지문. */
export async function configHash(bundle: unknown): Promise<string> {
  return (await sha256Hex(canonicalJson(bundle))).slice(0, CONFIG_HASH_LENGTH);
}
