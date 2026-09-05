/**
 * 인증키 봉투 — 저장할 때 잠그고 읽을 때 푼다.
 *
 * ## 왜 필요해졌나 (2026-09-05)
 * 지금까지 API 키는 **로컬 `.env`에만** 넣고 `npm run ai:sync`로 배포본에 올렸다.
 * 그러려면 내 PC 앞에 있어야 하고, 실제로 그래서 **AI 키가 하나도 등록되지 않은 채**
 * 기능이 놀고 있었다. 그래서 관리자 화면에서 바로 넣도록 바꾸되,
 * ⚠ **평문으로는 절대 저장하지 않는다.**
 *
 * ## 무엇을 막고 무엇을 못 막나 (정직하게)
 * - 막는다: **D1 덤프 하나로 키가 털리는 것.** 백업·마이그레이션 파일·조회 화면에는
 *   암호문만 남는다. 마스터 키는 DB 밖(Worker 시크릿)에 있다.
 * - 못 막는다: **실행 중인 서버를 장악한 공격자.** 서버가 풀 수 있으면 서버를 쥔 자도 푼다.
 *   그래서 복호화한 값은 **제공자를 부르는 그 자리에서만** 쓰고 화면·로그·폼으로 내보내지 않는다.
 *
 * ## 규칙
 * - ⚠ **마스터 키가 없거나 짧으면 저장 자체를 거부한다.** "키가 없으니 평문으로"는
 *   이 파일에 없다 — 그 폴백이 있으면 언젠가 반드시 그 경로로 떨어진다.
 * - ⚠ **이름을 함께 잠근다**(AES-GCM의 추가 인증 데이터). `GROQ_API_KEY` 자리의 암호문을
 *   `ANTHROPIC_API_KEY` 행에 복사해 넣어도 열리지 않는다.
 * - ⚠ **같은 값을 두 번 잠그면 다른 암호문이 나온다**(매번 새 IV). 같으면 어느 두 제공자가
 *   같은 키를 쓰는지가 DB만 보고도 드러난다.
 * - ⚠ 실패는 **던진다.** 못 푼 것을 빈 문자열로 돌려주면 "키 없음"과 구분이 사라진다.
 */

/** 봉투 형식의 판. 형식을 바꿔야 할 때 이 값을 올리고 옛 판을 함께 읽는다. */
export const SEAL_VERSION = "v1";

/** 마스터 키 재료의 최소 길이. 짧은 값을 허용하면 "설정했다"는 안심만 준다. */
export const MASTER_MIN_LENGTH = 32;

/** HKDF 소금 — 이 용도의 키를 다른 용도(세션 서명 등)와 갈라 놓는다. */
const HKDF_SALT = "woodsman.api-credential";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 마스터 재료(문자열) → AES-GCM 256 키.
 * ⚠ 원문을 그대로 키로 쓰지 않고 HKDF로 늘린다 — 재료가 다른 용도로도 쓰이는 값일 수 있다.
 */
async function deriveKey(material: string): Promise<CryptoKey> {
  const trimmed = material.trim();
  if (trimmed.length < MASTER_MIN_LENGTH) {
    throw new Error(`마스터 키가 ${MASTER_MIN_LENGTH}자 이상이어야 합니다`);
  }

  const base = await crypto.subtle.importKey("raw", encoder.encode(trimmed), "HKDF", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(HKDF_SALT),
      info: encoder.encode(SEAL_VERSION),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** `v1.<iv>.<암호문>` 꼴인가 — 값을 풀어 보지 않고 형식만 본다. */
export function isSealed(value: string): boolean {
  return /^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(value.trim());
}

/** 봉투를 쪼갠다. ⚠ 형식이 아니면 던진다 — 평문이 섞여 들어온 것을 조용히 넘기지 않는다. */
export function parseSealed(value: string): {
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
} {
  const parts = value.trim().split(".");
  if (parts.length !== 3 || parts[0] !== SEAL_VERSION) {
    throw new Error("저장된 값의 형식이 봉투가 아닙니다");
  }
  return { iv: fromBase64(parts[1]), data: fromBase64(parts[2]) };
}

/**
 * 잠근다.
 * @param name 이 값이 놓일 자리의 이름(예: `GROQ_API_KEY`). ⚠ 함께 잠긴다.
 */
export async function seal(plain: string, name: string, material: string): Promise<string> {
  const value = plain.trim();
  if (value.length === 0) throw new Error("빈 값은 저장하지 않습니다");

  const key = await deriveKey(material);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(name) },
    key,
    encoder.encode(value),
  );

  return `${SEAL_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

/**
 * 푼다. ⚠ 마스터 키가 다르거나 이름이 다르면 **던진다**(GCM 인증 실패).
 */
export async function open(sealed: string, name: string, material: string): Promise<string> {
  const { iv, data } = parseSealed(sealed);
  const key = await deriveKey(material);

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(name) },
      key,
      data,
    );
  } catch {
    // ⚠ 원인을 값으로 알려주지 않는다. 다만 "못 풀었다"는 사실은 분명히 던진다.
    throw new Error(`${name}을(를) 풀지 못했습니다 — 마스터 키가 바뀌었을 수 있습니다`);
  }

  return decoder.decode(plain);
}

/**
 * 화면에 보여줄 지문(fingerprint).
 *
 * ⚠ 키 자체는 절대 화면에 내보내지 않는다. 그런데 "내가 넣은 그 키가 맞나"를 확인할 방법이
 *   없으면 사람은 결국 키를 다시 붙여넣게 된다. 그래서 **암호문의 해시 앞 8자**만 보여준다 —
 *   같은 값을 다시 넣었는지는 알 수 없지만(IV가 매번 다르다), **행이 바뀌었는지**는 보인다.
 */
export async function sealFingerprint(sealed: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(sealed));
  return toBase64(new Uint8Array(digest)).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}
