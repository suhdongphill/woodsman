/**
 * GCRM 조류 해설 — DB 질의와 입력 조립. 판단(무엇이 사실이고 무엇이 통과인지)은 `lib/gcrm/commentary.ts`.
 * ⚠ `GcrmNarrative`는 추가만 한다. 승인·반려는 상태 칸만 바꾼다(본문은 고치지 않는다).
 * ⚠ 운영 GCRM 표(`GcrmRun`·축·기둥 점수)는 **읽기만** 한다.
 */
import { queryAll, queryOne, execute } from "@/lib/d1";
import { GCRM_PILLARS } from "@/lib/gcrm/config/pillars";
import { GCRM_CHIPS, HOME_AXIS } from "@/lib/gcrm/home-frame";
import { compareValue, type CommentaryBody, type CommentaryInput } from "@/lib/gcrm/commentary";
import { loadResearch } from "@/features/research/repository";
import { gcrmCurrent } from "./service";
import { loadRunResult, type StoredRun } from "./repository";

async function runBefore(asOf: string): Promise<StoredRun | undefined> {
  return (
    (await queryOne<StoredRun>(`SELECT * FROM GcrmRun WHERE asOf < ? ORDER BY asOf DESC, createdAt DESC LIMIT 1`, [asOf])) ??
    undefined
  );
}

async function runOnOrBefore(asOf: string): Promise<StoredRun | undefined> {
  return (
    (await queryOne<StoredRun>(`SELECT * FROM GcrmRun WHERE asOf <= ? ORDER BY asOf DESC, createdAt DESC LIMIT 1`, [asOf])) ??
    undefined
  );
}

async function tideScores(run: StoredRun | undefined): Promise<Map<string, number | null>> {
  if (!run) return new Map();
  const stored = await loadRunResult(run.runId);
  return new Map(stored.pillars.filter((p) => p.axis === HOME_AXIS).map((p) => [p.pillar, p.scoreRaw]));
}

/**
 * 최신 run 하나로 입력을 만든다. 비교는 **직전 계산**과 **4주 전(그날 또는 그 전 가장 가까운 계산)**.
 * ⚠ 모델 버전이 다르면 비교하지 않는다(`compareValue`). 못 읽으면 undefined(+로그).
 */
export async function loadCommentaryInput(): Promise<CommentaryInput | undefined> {
  const now = await gcrmCurrent();
  if (!now.ok) return undefined;
  const fourWeeks = new Date(Date.parse(`${now.asOf}T00:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10);
  const [prevRun, w4Run, research] = await Promise.all([runBefore(now.asOf), runOnOrBefore(fourWeeks), loadResearch()]);
  const [prevScores, w4Scores] = await Promise.all([tideScores(prevRun), tideScores(w4Run)]);
  const nameKo = new Map(GCRM_PILLARS.map((p) => [p.code, p.nameKo]));

  const pillars = GCRM_CHIPS.map(({ pillar }) => {
    const row = now.pillars.find((p) => p.pillar === pillar && p.axis === HOME_AXIS);
    const score = row?.scoreRaw != null && Number.isFinite(row.scoreRaw) ? row.scoreRaw : null;
    return {
      pillar,
      nameKo: nameKo.get(pillar) ?? pillar,
      axis: HOME_AXIS,
      score,
      coverage: row?.coverage ?? null,
      status: row?.status ?? "MISSING",
      prevDay: compareValue(
        prevRun && { asOf: prevRun.asOf, modelVersion: prevRun.modelVersion, score: prevScores.get(pillar) ?? null },
        now.modelVersion,
      ),
      w4: compareValue(
        w4Run && { asOf: w4Run.asOf, modelVersion: w4Run.modelVersion, score: w4Scores.get(pillar) ?? null },
        now.modelVersion,
      ),
    };
  });

  const state = now.regime?.alignmentState ?? null;
  return {
    asOf: now.asOf,
    computedAt: now.computedAt,
    runId: now.runId,
    modelVersion: now.modelVersion,
    regimeLabel: now.regime?.alignmentStateKo ?? null,
    regimeConfirmed: state != null && state !== "UNDETERMINED",
    pillars,
    research: research
      .filter((r) => r.verifyStatus !== "REJECTED")
      .map((r) => ({ id: r.id, title: r.title, horizon: r.horizon, candidate: r.candidate, limit: r.limit })),
  };
}

export type NarrativeRow = {
  id: string;
  asOf: string;
  runId: string;
  modelVersion: string;
  promptVersion: string;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "FAILED";
  body: CommentaryBody | null;
  facts: CommentaryInput;
  researchIds: string[];
  editor: string;
  problems: string[];
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

type DbNarrative = Omit<NarrativeRow, "body" | "facts" | "researchIds" | "problems"> & {
  body: string | null;
  facts: string;
  researchIds: string | null;
  problems: string | null;
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("[gcrm-commentary] 저장된 JSON을 읽지 못했다", error);
    return fallback;
  }
}

function fromDb(r: DbNarrative): NarrativeRow {
  return {
    ...r,
    body: parse<CommentaryBody | null>(r.body, null),
    facts: parse<CommentaryInput>(r.facts, {} as CommentaryInput),
    researchIds: parse<string[]>(r.researchIds, []),
    problems: parse<string[]>(r.problems, []),
  };
}

export async function loadNarratives(limit = 30): Promise<NarrativeRow[]> {
  const rows = await queryAll<DbNarrative>(`SELECT * FROM GcrmNarrative ORDER BY createdAt DESC LIMIT ?`, [limit]);
  return rows.map(fromDb);
}

/** 같은 run·프롬프트 판에 살아 있는(실패가 아닌) 초안이 있나 — 중복 생성 방지. */
export async function liveNarrativeFor(runId: string, promptVersion: string): Promise<NarrativeRow | undefined> {
  const row = await queryOne<DbNarrative>(
    `SELECT * FROM GcrmNarrative WHERE runId = ? AND promptVersion = ? AND status != 'FAILED' ORDER BY createdAt DESC LIMIT 1`,
    [runId, promptVersion],
  );
  return row ? fromDb(row) : undefined;
}

export async function saveNarrative(n: {
  input: CommentaryInput;
  promptVersion: string;
  status: "DRAFT" | "FAILED";
  body?: CommentaryBody;
  editor: string;
  problems?: string[];
}): Promise<string> {
  const now = new Date().toISOString();
  const id = `gn_${n.input.asOf}_${now}`;
  await execute(
    `INSERT INTO GcrmNarrative (id, asOf, runId, modelVersion, promptVersion, status, body, facts, researchIds, editor, problems, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      n.input.asOf,
      n.input.runId,
      n.input.modelVersion,
      n.promptVersion,
      n.status,
      n.body ? JSON.stringify(n.body) : null,
      JSON.stringify(n.input),
      n.body ? JSON.stringify(n.body.researchIds) : null,
      n.editor,
      n.problems?.length ? JSON.stringify(n.problems) : null,
      now,
    ],
  );
  return id;
}

/** 승인·반려 — ⚠ DRAFT만 바꿀 수 있다. 본문은 그대로다. */
export async function decideNarrative(id: string, status: "APPROVED" | "REJECTED", by: string): Promise<boolean> {
  const row = await queryOne<{ status: string }>(`SELECT status FROM GcrmNarrative WHERE id = ?`, [id]);
  if (row?.status !== "DRAFT") return false;
  await execute(`UPDATE GcrmNarrative SET status = ?, decidedAt = ?, decidedBy = ? WHERE id = ? AND status = 'DRAFT'`, [
    status,
    new Date().toISOString(),
    by,
    id,
  ]);
  return true;
}
