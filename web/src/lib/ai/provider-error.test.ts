import { describe, expect, it } from "vitest";
import { PROVIDER_ERROR_MAX, describeProviderError } from "./client";

/**
 * 2026-09-08. NVIDIA가 사흘째 404를 내는데 화면에는 `응답 404`만 떴다.
 * 「모르는 모델」인지 「계정에 없는 모델」인지 「경로가 틀렸는지」가 전부 같아 보였다.
 *
 * ⚠ 그렇다고 본문을 통째로 실으면 안 된다 — 제공자가 요청을 되비추면
 *    시스템 프롬프트나 키가 화면·로그로 새어 나간다. 그 경계를 이 테스트가 붙든다.
 */
describe("제공자 에러에서 보여도 되는 이유 뽑기", () => {
  describe("실제로 받아 본 응답", () => {
    it("NVIDIA의 평문 404 — 그대로 쓴다", () => {
      expect(describeProviderError("404 page not found")).toBe("404 page not found");
    });

    it("NVIDIA의 EOL 410 — detail을 쓴다", () => {
      const body = JSON.stringify({
        type: "about:blank",
        title: "Gone",
        status: 410,
        detail: "The model 'meta/llama-3.3-70b-instruct' has reached its end of life",
      });
      const out = describeProviderError(body);
      expect(out).toContain("Gone");
      expect(out).toContain("end of life");
    });

    it("NVIDIA의 403 — title과 detail을 함께 쓰되 ⚠ **구체적인 쪽을 앞에** 둔다", () => {
      const out = describeProviderError(
        JSON.stringify({ status: 403, title: "Forbidden", detail: "Authorization failed" }),
      );
      // ⚠ 길면 뒤가 잘린다. 앞자리는 「Gone」이 아니라 「무엇이 왜」가 차지해야 한다.
      expect(out).toBe("Authorization failed · Forbidden");
    });

    it("OpenAI 꼴 — error.message를 파고들어 찾는다", () => {
      const out = describeProviderError(
        JSON.stringify({ error: { message: "Rate limit reached", type: "rate_limit_error" } }),
      );
      expect(out).toBe("Rate limit reached");
    });
  });

  describe("⚠ 새면 안 되는 것", () => {
    it("키가 통째로 들어 있으면 **문장을 버린다** — 지우고 쓰지 않는다", () => {
      const key = "nvapi-abcdef0123456789";
      const out = describeProviderError(
        JSON.stringify({ detail: `Invalid key ${key} supplied` }),
        key,
      );
      expect(out).toBe("");
    });

    it("남의 키처럼 생긴 토큰도 지운다", () => {
      const out = describeProviderError(
        JSON.stringify({ detail: "token sk-liveKEY1234567890 rejected" }),
      );
      expect(out).not.toContain("sk-liveKEY1234567890");
      expect(out).toContain("[키]");
    });

    it("⚠ 요청을 되비춘 본문은 버린다 — 시스템 프롬프트가 새는 자리다", () => {
      const echoed = JSON.stringify({
        detail: 'bad request: {"messages":[{"role":"system","content":"너는 Woodsman이다"}]}',
      });
      expect(describeProviderError(echoed)).toBe("");
    });

    it("에러 필드 밖은 쳐다보지 않는다 — 되비친 요청은 후보에 오르지도 않는다", () => {
      const out = describeProviderError(
        JSON.stringify({ detail: "Bad model", prompt: "비밀 프롬프트", input: "비밀 입력" }),
      );
      expect(out).toBe("Bad model");
    });

    it("HTML 오류 페이지는 버린다", () => {
      expect(describeProviderError("<html><body>502 Bad Gateway</body></html>")).toBe("");
    });

    it("긴 평문은 버린다 — 되비침이거나 덤프다", () => {
      expect(describeProviderError("x".repeat(500))).toBe("");
    });
  });

  describe("길이와 빈 값", () => {
    it("한 줄로 자른다", () => {
      const out = describeProviderError(JSON.stringify({ detail: "가".repeat(400) }));
      expect(out.length).toBeLessThanOrEqual(PROVIDER_ERROR_MAX);
      expect(out.endsWith("…")).toBe(true);
    });

    it("줄바꿈을 눕힌다", () => {
      expect(describeProviderError(JSON.stringify({ detail: "첫 줄\n\n둘째 줄" }))).toBe(
        "첫 줄 둘째 줄",
      );
    });

    it("쓸 것이 없으면 빈 문자열 — 호출부가 상태 코드만 남긴다", () => {
      expect(describeProviderError("")).toBe("");
      expect(describeProviderError("   ")).toBe("");
      expect(describeProviderError(JSON.stringify({ status: 500 }))).toBe("");
    });
  });
});
