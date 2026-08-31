/**
 * 구조화 데이터(JSON-LD) 생성 — 순수 함수.
 *
 * ## 왜 필요한가
 * 검색엔진은 HTML만 보고 "이 페이지가 무엇인지" 추측한다. 구조화 데이터는 그 추측을
 * 사실로 바꿔 준다. 빵부스러기(BreadcrumbList)는 검색 결과에 경로를 띄우고,
 * 데이터셋(Dataset)은 "지표 데이터를 제공하는 페이지"임을 알린다.
 *
 * ⚠ 여기 담는 내용은 **화면에 실제로 있는 것**과 같아야 한다. 화면에 없는 값을 구조화
 *    데이터에만 넣는 것은 스팸으로 취급돼 색인에서 불이익을 받는다.
 */
import { absoluteUrl } from "./site-url";

export type Crumb = { name: string; path: string };

/** 빵부스러기. 마지막 항목이 현재 페이지다. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/**
 * 지표 묶음 = 데이터셋.
 * `variableMeasured`에 지표 이름을 넣어 "무엇을 다루는 데이터인가"를 밝힌다.
 */
export function datasetJsonLd(input: {
  name: string;
  description: string;
  path: string;
  /** 마지막 갱신일 YYYY-MM-DD */
  dateModified?: string;
  variables: string[];
  /** 원 출처 이름(FRED 등) */
  sources: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "Woodsman", url: absoluteUrl("/") },
    variableMeasured: input.variables,
    ...(input.sources.length
      ? { citation: input.sources.map((s) => ({ "@type": "CreativeWork", name: s })) }
      : {}),
  };
}

/** 자주 묻는 형태의 설명 — 그룹 상세의 "이게 뭔가요"를 그대로 태운다. */
export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/**
 * 사이트 자체 = WebSite(+ 발행 주체 Organization). 홈에만 붙인다.
 *
 * ## 왜 홈에 필요한가 (2026-08-31, 재편 Step 5)
 * 지표 묶음 화면은 `Dataset`으로 "무엇을 다루는 데이터인가"를 밝히고 있었는데,
 * **홈에는 구조화 데이터가 하나도 없었다.** 그래서 검색·AI가 "이 사이트가 무엇인가"를
 * 여전히 HTML 추측으로만 알아냈다. 홈의 성격이 계좌에서 콘텐츠로 바뀐 마당에
 * 가장 먼저 정정돼야 할 자리다.
 *
 * ⚠ **없는 기능을 적지 않는다.** 사이트 검색 화면이 없으므로 `potentialAction`
 *    (SearchAction)을 넣지 않는다 — 화면에 없는 것을 구조화 데이터에만 넣으면
 *    스팸으로 취급된다(이 파일 맨 위의 규칙).
 * ⚠ **필명으로 적는다.** 공개 화면의 주체는 Woodsman이다(실명은 `/privacy` 한 곳뿐).
 * ⚠ 지표 개수 같은 **숫자를 적지 않는다.** 정적 문자열이라 늘면 조용히 거짓이 된다
 *    (수를 세어 말하는 자리는 `lib/llms-txt.ts`뿐이고, 거기서는 실제로 센다).
 */
export function websiteJsonLd(input: { name: string; description: string; sameAs?: string[] }) {
  const publisher = {
    "@type": "Organization",
    name: input.name,
    url: absoluteUrl("/"),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: absoluteUrl("/"),
    description: input.description,
    inLanguage: "ko-KR",
    isAccessibleForFree: true,
    publisher,
  };
}
