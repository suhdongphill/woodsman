import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, datasetJsonLd, faqJsonLd } from "./seo";

describe("구조화 데이터", () => {
  it("빵부스러기는 순서를 1부터 매기고 절대 URL을 쓴다", () => {
    const jsonLd = breadcrumbJsonLd([
      { name: "홈", path: "/" },
      { name: "거시 지표", path: "/macro" },
    ]);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement[0].position).toBe(1);
    expect(jsonLd.itemListElement[1].position).toBe(2);
    for (const item of jsonLd.itemListElement) {
      // 상대 경로를 넣으면 검색엔진이 무시한다.
      expect(item.item).toMatch(/^https?:\/\//);
    }
  });

  it("데이터셋은 무료 공개와 다루는 지표를 밝힌다", () => {
    const jsonLd = datasetJsonLd({
      name: "금리 지표",
      description: "돈을 빌리는 값",
      path: "/macro/rates",
      dateModified: "2026-08-06",
      variables: ["미국 기준금리", "미 국채 10년"],
      sources: ["FRED"],
    });
    expect(jsonLd["@type"]).toBe("Dataset");
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.variableMeasured).toContain("미 국채 10년");
    expect(jsonLd.dateModified).toBe("2026-08-06");
  });

  it("갱신일이 없으면 dateModified를 아예 넣지 않는다 — 빈 날짜를 만들지 않는다", () => {
    const jsonLd = datasetJsonLd({
      name: "x",
      description: "y",
      path: "/macro/rates",
      variables: [],
      sources: [],
    });
    expect("dateModified" in jsonLd).toBe(false);
    expect("citation" in jsonLd).toBe(false);
  });

  it("FAQ는 질문과 답을 짝지어 담는다", () => {
    const jsonLd = faqJsonLd([{ question: "금리가 뭔가요?", answer: "돈의 값입니다." }]);
    expect(jsonLd.mainEntity[0].name).toBe("금리가 뭔가요?");
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toBe("돈의 값입니다.");
  });
});
