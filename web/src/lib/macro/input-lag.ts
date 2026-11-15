/**
 * 모형 입력의 지연 — 순수 모듈(2026-11-15).
 *
 * 왜: 홈 「금리 방향」 카드의 준칙 처방(인상·동결·인하 확률)은 8개 지표를 입력으로 쓴다. 가장 오래된 입력이
 * 2026-08-01(ISM 제조업 · 수동 입력 · 9/5 뒤로 갱신 없음)인데, 그 사실이 회색 작은 글씨로만 보였다.
 * 운영자 요청: 「입력 지연」 배지 + 어떤 입력이 늦었는지 펼쳐 보이기 · 침체 신호 카드의 기한초과 표시와 맞추기.
 *
 * ⚠ 기준은 **지표마다의 신선도 판정**(`freshness.ts` — 발표 주기 + 지표별 `staleDays`)이다. 「가장 오래된 입력 60일」 같은
 *   한 줄 규칙은 쓰지 않는다 — 월간 지표는 관측일이 그달 1일이라 근원 PCE 9월분(정상)도 11/15에 75일이 되어 매달 거짓 경보가 된다
 *   (2026-11-15 운영자 결정 「지표별 신선도 판정」).
 * ⚠ 값을 채우지 않는다. 늦은 입력은 늦었다고, 없는 입력은 없다고 적는다.
 */
import { freshnessBadge, type MacroFreshness } from "./freshness";

export type ModelInput = {
  key: string;
  name: string;
  /** 「FRED」·「MANUAL」 등 — 수동 입력이면 화면이 「관리자에서 갱신」을 말한다 */
  source: string;
  asOf?: string;
  freshness: MacroFreshness;
};

export type LaggingInput = ModelInput & {
  /** 「기한초과 31일」·「수동·기한초과 31일」·「수집 끊김 15일」·「값 없음」 */
  reason: string;
};

/** 늦었거나 없는 입력만. 정상이면 빈 배열 — 화면은 아무것도 띄우지 않는다(정상일 때 조용하다). */
export function laggingInputs(inputs: readonly ModelInput[]): LaggingInput[] {
  const out: LaggingInput[] = [];
  for (const i of inputs) {
    if (i.freshness.missing) {
      out.push({ ...i, reason: "값 없음" });
      continue;
    }
    const badge = freshnessBadge(i.freshness);
    if (badge) out.push({ ...i, reason: badge });
  }
  return out;
}

/** 카드 배지 한 줄 — 없으면 null */
export function inputLagLabel(lagging: readonly LaggingInput[]): string | null {
  return lagging.length ? `입력 지연 ${lagging.length}` : null;
}
