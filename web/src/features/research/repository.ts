/**
 * 연구 라이브러리 — DB 질의. 판단(무엇을 넣고 고칠지)은 `lib/research/import.ts`가 한다.
 * ⚠ 관리자 전용. 공개 라우트에서 부르지 않는다. 운영 GCRM 테이블(`Gcrm*`)에 쓰지 않는다.
 */
import { getD1, queryAll, queryOne, execute } from "@/lib/d1";
import {
  extractDoi,
  horizonOf,
  normalizeUrl,
  type ImportPlan,
  type ResearchFile,
  type ResearchRecord,
  type VerifyStatus,
} from "@/lib/research/import";

export type ResearchRow = ResearchRecord & {
  horizon: string;
  doi: string | null;
  verifyStatus: string;
  verifyNote: string | null;
  verifyAt: string | null;
  registeredAt: string;
  updatedAt: string;
};

type DbRow = {
  id: string;
  title: string;
  source: string;
  publishedDate: string;
  url: string;
  doi: string | null;
  topic: string | null;
  layer: string;
  horizon: string;
  fact: string | null;
  method: string | null;
  limitText: string | null;
  interpret: string | null;
  hypothesis: string | null;
  mapping: string | null;
  candidate: string | null;
  testPlan: string | null;
  counter: string | null;
  verifyStatus: string;
  verifyNote: string | null;
  verifyAt: string | null;
  registeredAt: string;
  updatedAt: string;
};

function fromDb(r: DbRow): ResearchRow {
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    date: r.publishedDate,
    url: r.url,
    topic: r.topic,
    layer: r.layer,
    fact: r.fact,
    method: r.method,
    limit: r.limitText,
    interpret: r.interpret,
    hypothesis: r.hypothesis,
    mapping: r.mapping,
    candidate: r.candidate,
    test: r.testPlan,
    counter: r.counter,
    horizon: r.horizon,
    doi: r.doi,
    verifyStatus: r.verifyStatus,
    verifyNote: r.verifyNote,
    verifyAt: r.verifyAt,
    registeredAt: r.registeredAt,
    updatedAt: r.updatedAt,
  };
}

export async function loadResearch(): Promise<ResearchRow[]> {
  const rows = await queryAll<DbRow>(`SELECT * FROM ResearchPaper ORDER BY publishedDate DESC, id`);
  return rows.map(fromDb);
}

export type ResearchBatchRow = { id: string; date: string; cadence: string | null; summary: string | null };

export async function loadResearchBatches(): Promise<ResearchBatchRow[]> {
  return queryAll<ResearchBatchRow>(`SELECT id, date, cadence, summary FROM ResearchBatch ORDER BY date DESC`);
}

export type ResearchImportRow = {
  id: string;
  at: string;
  actor: string;
  fileName: string;
  inserted: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  conflictJson: string | null;
};

export async function loadResearchImports(limit = 10): Promise<ResearchImportRow[]> {
  return queryAll<ResearchImportRow>(
    `SELECT id, at, actor, fileName, inserted, updated, unchanged, conflicts, conflictJson FROM ResearchImport ORDER BY at DESC LIMIT ?`,
    [limit],
  );
}

const PAPER_COLUMNS = `title = ?, source = ?, publishedDate = ?, url = ?, urlNorm = ?, doi = ?, topic = ?, layer = ?, horizon = ?,
  fact = ?, method = ?, limitText = ?, interpret = ?, hypothesis = ?, mapping = ?, candidate = ?, testPlan = ?, counter = ?`;

function paperValues(r: ResearchRecord): unknown[] {
  return [
    r.title,
    r.source,
    r.date,
    r.url,
    normalizeUrl(r.url),
    extractDoi(r.url),
    r.topic,
    r.layer,
    horizonOf(r.layer),
    r.fact,
    r.method,
    r.limit,
    r.interpret,
    r.hypothesis,
    r.mapping,
    r.candidate,
    r.test,
    r.counter,
  ];
}

/**
 * 계획을 한 번에 쓴다(D1 batch = 한 트랜잭션). ⚠ 일부만 들어가는 일이 없다.
 * ⚠ update는 원문 칸만 고친다 — **검증 상태(verify*)와 등록일은 건드리지 않는다**(파일을 다시 가져와도 사람이 올린 상태가 남는다).
 */
export async function applyResearchImport(input: {
  plan: ImportPlan;
  file: ResearchFile;
  fileName: string;
  actor: string;
}): Promise<string> {
  const { plan, file } = input;
  const db = await getD1();
  const now = new Date().toISOString();
  const importId = `ri_${now}`;
  const stmts = [
    ...plan.insert.map((r) =>
      db
        .prepare(
          `INSERT INTO ResearchPaper (id, title, source, publishedDate, url, urlNorm, doi, topic, layer, horizon,
            fact, method, limitText, interpret, hypothesis, mapping, candidate, testPlan, counter,
            verifyStatus, registeredAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CANDIDATE', ?, ?)`,
        )
        .bind(r.id, ...paperValues(r), now, now),
    ),
    ...plan.update.map(({ record }) =>
      db.prepare(`UPDATE ResearchPaper SET ${PAPER_COLUMNS}, updatedAt = ? WHERE id = ?`).bind(...paperValues(record), now, record.id),
    ),
    ...file.batches.map((b) =>
      db
        .prepare(
          `INSERT INTO ResearchBatch (id, date, cadence, summary, importedAt) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET date = excluded.date, cadence = excluded.cadence, summary = excluded.summary`,
        )
        .bind(b.id, b.date, b.cadence, b.summary, now),
    ),
    db
      .prepare(
        `INSERT INTO ResearchImport (id, at, actor, fileName, schemaVersion, baseline, notes, inserted, updated, unchanged, conflicts, conflictJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        importId,
        now,
        input.actor,
        input.fileName,
        file.schemaVersion,
        file.baseline == null ? null : JSON.stringify(file.baseline),
        file.notes == null ? null : JSON.stringify(file.notes),
        plan.insert.length,
        plan.update.length,
        plan.unchanged.length,
        plan.conflicts.length,
        plan.conflicts.length ? JSON.stringify(plan.conflicts) : null,
      ),
  ];
  try {
    await db.batch(stmts);
  } catch (error) {
    console.error("[research] 가져오기 쓰기 실패 — 아무것도 들어가지 않았다(batch)", error);
    throw error;
  }
  return importId;
}

/** 검증 상태 기록. ⚠ 메모 없이 바꾸지 않는다(부르는 쪽이 검사). */
export async function setResearchVerify(id: string, status: VerifyStatus, note: string): Promise<boolean> {
  const exists = await queryOne<{ id: string }>(`SELECT id FROM ResearchPaper WHERE id = ?`, [id]);
  if (!exists) return false;
  const now = new Date().toISOString();
  await execute(`UPDATE ResearchPaper SET verifyStatus = ?, verifyNote = ?, verifyAt = ?, updatedAt = ? WHERE id = ?`, [
    status,
    note,
    now,
    now,
    id,
  ]);
  return true;
}
