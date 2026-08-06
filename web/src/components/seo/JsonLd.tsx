/**
 * 구조화 데이터를 페이지에 심는다.
 *
 * 내용은 `src/lib/seo.ts`가 만든 순수 객체다. 여기서는 넣기만 한다.
 * `dangerouslySetInnerHTML`을 쓰는 이유: JSON-LD는 텍스트 노드로 들어가야 하고,
 * React가 문자열을 이스케이프하면 검색엔진이 못 읽는다. 값은 우리가 만든 객체뿐이라
 * 외부 입력이 섞이지 않는다(그래도 `<`는 막아 둔다 — 스크립트 조기 종료 방지).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
