"use server";

/**
 * 지식 검색 액션 — AI에 넘어갈 컨텍스트를 **사람이 먼저 눈으로 보게** 한다.
 *
 * ## 왜 화면에 붙였나
 * RAG는 조용히 틀린다. 엉뚱한 기록을 골라도 답변은 그럴듯하게 나오기 때문에, 무엇이 뽑혔는지
 * 보지 않으면 알 수 없다. 그래서 질문을 넣으면 **뽑힌 기록과 실제 프롬프트 조각**을 그대로
 * 보여준다. 모델을 부르기 전에 여기서 확인한다.
 *
 * ⚠ 검색만 한다. 여기서 모델을 호출하지 않는다(호출은 P6에서 붙인다).
 */
import { requireAdmin } from "@/lib/session";
import { renderKnowledgeContext, searchDocs } from "@/lib/ai/retrieval";
import type { KnowledgeSearchState } from "./knowledge-state";
import { loadKnowledgeDocs } from "./knowledge";

export async function searchKnowledgeAction(
  _prev: KnowledgeSearchState,
  formData: FormData,
): Promise<KnowledgeSearchState> {
  await requireAdmin("/admin/ai");

  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { error: "무엇을 찾을지 입력하세요." };

  try {
    const docs = await loadKnowledgeDocs();
    const hits = searchDocs(docs, query, { limit: 8 });

    return {
      query,
      hits,
      prompt: renderKnowledgeContext(hits),
      total: docs.length,
    };
  } catch (error) {
    console.error("[ai] 지식 검색 실패", error);
    return { error: "검색하지 못했습니다. 잠시 후 다시 시도하세요." };
  }
}
