/**
 * GCRM v2 — 재현성 검증 (명세 §2-17 · §2-19 `regime verify`).
 *
 * > 「저장된 run_id의 config_hash로 설정을 되돌려 재계산하고, 저장값과 한 자리까지 대조해
 * >  불일치를 보고한다. 이게 통과하지 못하면 "재현 가능"이라고 말할 수 없다.」
 *
 * ## ⚠ 해시로는 설정을 되돌릴 수 없다 — 명세의 문장을 그대로 실행할 수 없다
 * `config_hash`는 **단방향**이다. 해시에서 설정을 복원하는 것은 불가능하다.
 * 그래서 실제로 할 수 있는 것은 둘이다.
 *
 * 1. **지금 설정의 해시가 저장된 해시와 같은지 확인한다.** 같으면 지금 코드로 재계산해 대조하는 것이
 *    곧 「그때 설정으로 재계산」이다.
 * 2. 다르면 **되돌릴 수 없다고 말하고**, 저장된 `git_sha`를 알려 준다 —
 *    그 커밋을 체크아웃해야 그때 설정이 돌아온다.
 *
 * ⚠ 2를 「경고」로 넘기고 그냥 대조하면 **다른 설정끼리 비교해 놓고 불일치라고 보고**하게 된다.
 * 그건 검증이 아니라 잡음이다. 그래서 **검증 자체를 하지 않고 멈춘다.**
 *
 * ## ⚠ 「한 자리까지」의 뜻
 * 저장은 소수 6자리로 자른다(`repository.ts`의 `D()`). 대조도 같은 자리에서 한다 —
 * 부동소수 끝자리 차이를 불일치라고 보고하면 매번 빨간불이 켜지고, 그러면 아무도 안 본다.
 */
import type { PipelineResult } from "./pipeline";

/** 저장 정밀도. ⚠ `repository.ts`의 `D()`와 같아야 한다 — 테스트가 대조한다. */
export const STORE_DECIMALS = 6;

export type Mismatch = {
  /** 어디가 다른가. 예: `axis.tide.score` */
  where: string;
  stored: number | string | null;
  recomputed: number | string | null;
  /** 차이(숫자일 때) */
  delta?: number;
};

export type VerifyResult =
  | {
      status: "OK" | "MISMATCH";
      runId: string;
      asOf: string;
      configHash: string;
      /** 대조한 항목 수 */
      checked: number;
      mismatches: Mismatch[];
    }
  | {
      /** ⚠ 설정이 달라 **검증을 시작하지 못했다.** 불일치와 구분한다 */
      status: "CONFIG_CHANGED";
      runId: string;
      asOf: string;
      storedHash: string;
      currentHash: string;
      gitSha: string | null;
      detail: string;
    };

const round = (v: number | null | undefined) =>
  v === undefined || v === null ? null : Number(v.toFixed(STORE_DECIMALS));

function push(out: Mismatch[], where: string, stored: number | string | null, recomputed: number | string | null) {
  if (stored === recomputed) return;
  const delta =
    typeof stored === "number" && typeof recomputed === "number" ? recomputed - stored : undefined;
  out.push({ where, stored, recomputed, ...(delta === undefined ? {} : { delta }) });
}

export type StoredForVerify = {
  runId: string;
  asOf: string;
  configHash: string;
  gitSha: string | null;
  axes: { axis: string; score: number | null; direction: string | null; coverage: number | null; status: string }[];
  pillars: { pillar: string; axis: string; scoreRaw: number | null; scoreOri: number | null; coverage: number; status: string }[];
  regime: {
    overall: number | null;
    rte: number | null;
    alignment: number | null;
    alignmentState: string | null;
    acuteWatch: number;
  } | undefined;
};

/**
 * 저장값과 재계산값을 대조한다.
 *
 * @param currentHash 지금 설정의 지문
 */
export function compareRun(
  stored: StoredForVerify,
  recomputed: PipelineResult,
  currentHash: string,
): VerifyResult {
  if (stored.configHash !== currentHash) {
    return {
      status: "CONFIG_CHANGED",
      runId: stored.runId,
      asOf: stored.asOf,
      storedHash: stored.configHash,
      currentHash,
      gitSha: stored.gitSha,
      detail:
        "설정이 그때와 다르다. config_hash는 단방향이라 되돌릴 수 없다 — " +
        (stored.gitSha
          ? `git ${stored.gitSha}를 체크아웃한 뒤 다시 검증한다.`
          : "그때의 git_sha가 저장돼 있지 않아 복원할 방법이 없다. 이 run은 재현할 수 없다."),
    };
  }

  const m: Mismatch[] = [];
  let checked = 0;

  for (const s of stored.axes) {
    const axis = s.axis as "tide" | "wind" | "wave";
    const r = recomputed.axes[axis];
    if (!r) {
      push(m, `axis.${axis}`, "저장됨", "재계산에 없음");
      continue;
    }
    push(m, `axis.${axis}.score`, round(s.score), round(r.score));
    push(m, `axis.${axis}.coverage`, round(s.coverage), round(r.coverage));
    push(m, `axis.${axis}.status`, s.status, r.status);
    push(m, `axis.${axis}.direction`, s.direction, recomputed.directions[axis] ?? null);
    checked += 4;
  }

  for (const s of stored.pillars) {
    const r = recomputed.pillars.find((x) => x.pillar === s.pillar && x.axis === s.axis);
    if (!r) {
      push(m, `pillar.${s.pillar}.${s.axis}`, "저장됨", "재계산에 없음");
      continue;
    }
    push(m, `pillar.${s.pillar}.${s.axis}.scoreRaw`, round(s.scoreRaw), round(r.scoreRaw));
    push(m, `pillar.${s.pillar}.${s.axis}.scoreOri`, round(s.scoreOri), round(r.scoreOri));
    push(m, `pillar.${s.pillar}.${s.axis}.coverage`, round(s.coverage), round(r.coverage));
    push(m, `pillar.${s.pillar}.${s.axis}.status`, s.status, r.status);
    checked += 4;
  }

  if (stored.regime) {
    push(m, "regime.overall", round(stored.regime.overall), round(recomputed.overall));
    push(m, "regime.rte", round(stored.regime.rte), round(recomputed.rte));
    push(m, "regime.alignment", round(stored.regime.alignment), round(recomputed.alignment?.alignment));
    push(m, "regime.alignmentState", stored.regime.alignmentState, recomputed.alignmentState.state);
    push(m, "regime.acuteWatch", stored.regime.acuteWatch, recomputed.acute.watch ? 1 : 0);
    checked += 5;
  } else {
    push(m, "regime", "없음", "재계산됨");
  }

  return {
    status: m.length === 0 ? "OK" : "MISMATCH",
    runId: stored.runId,
    asOf: stored.asOf,
    configHash: currentHash,
    checked,
    mismatches: m,
  };
}

/** 사람이 읽는 한 줄. */
export function verdictLine(v: VerifyResult): string {
  if (v.status === "CONFIG_CHANGED") {
    return `⚠ 검증하지 못했다 — ${v.detail} (저장 ${v.storedHash} · 지금 ${v.currentHash})`;
  }
  if (v.status === "OK") {
    return `✅ 재현됐다 — ${v.checked}개 항목이 소수 ${STORE_DECIMALS}자리까지 일치한다 (${v.runId})`;
  }
  return `✖ 불일치 ${v.mismatches.length}건 / 대조 ${v.checked}건 — 「재현 가능」이라고 말할 수 없다 (${v.runId})`;
}
