/**
 * 연구 라이브러리 — 가져오기 파일을 읽고 「무엇을 넣고 · 고치고 · 건너뛰고 · 사람에게 물을지」를 정한다. 순수 함수.
 *
 * ## 왜 있나 (2026-11-14 · v3)
 * 운영자가 GCRM Research Lab(외부 대시보드)에서 정리한 연구 11편을 JSON으로 내보내 `docs/`에 넣었다.
 * 이것을 포털 관리자 화면의 **연구 라이브러리**로 옮긴다. 목적은 GCRM 개선 후보를 **검증 기록과 함께** 관리하는 것이다.
 *
 * ## ⚠ 지키는 것
 * - **모두 검증 후보로 시작한다.** 가져오기는 검증 상태를 올리지 않는다 — 재현·백테스트 완료는 사람이 기록으로 올린다.
 * - **같은 파일을 두 번 가져와도 중복이 생기지 않는다.** 같은 `id`는 고치거나 건너뛰고, 다른 `id`인데 URL·DOI·제목이 같으면
 *   중복이나 개정판일 수 있어 **넣지 않고 사람에게 묻는다**(`conflicts`). 조용히 합치지 않는다.
 * - 원문의 칸(`id`·`title`·…·`counter`)과 `layer` 원래 값을 **그대로 보존**한다. 화면용 시간축(`horizon`)은 따로 둔다.
 * - ⚠ 이 모듈은 운영 GCRM 점수·가중치·임계값에 **쓰는 경로가 없다**. 연구는 「후보」이지 산식의 근거가 아니다.
 * - 연구의 `layer`는 Research Lab의 이름(Current·Wind·Wave)이다. 포털에서는 `Current`를 쓰지 않고 「조류(tide)」라 부른다
 *   (`docs/GCRM_설계점검_v2.md` A-1). 그래서 원래 값은 `layer`에 두고 `horizon`(tide·wind·wave)으로 옮겨 쓴다.
 */

export type ResearchHorizon = "tide" | "wind" | "wave";

/** 원문 칸 그대로. 선택 칸은 비었으면 null. */
export type ResearchRecord = {
  id: string;
  title: string;
  source: string;
  /** 연구 발행일(YYYY-MM-DD) — ⚠ 포털 등록일과 다르다 */
  date: string;
  url: string;
  topic: string | null;
  /** Research Lab 원래 값(Current · Wind · Wave) */
  layer: string;
  fact: string | null;
  method: string | null;
  limit: string | null;
  interpret: string | null;
  hypothesis: string | null;
  mapping: string | null;
  candidate: string | null;
  test: string | null;
  counter: string | null;
};

export type ResearchBatch = { id: string; date: string; cadence: string | null; summary: string | null };

export type ResearchFile = {
  schemaVersion: number;
  /** 파일에 적힌 기준(예: Current 50 · Wind 35 · Wave 15). ⚠ 보존만 한다 — 운영 산식에 쓰지 않는다 */
  baseline: unknown;
  papers: ResearchRecord[];
  /** ⚠ 비공개 검토 메모. 보존만 하고 공개 화면에 그리지 않는다 */
  notes: unknown;
  batches: ResearchBatch[];
};

/** DB에 이미 있는 연구 — 비교에 필요한 것만 */
export type ExistingResearch = ResearchRecord;

export type ImportPlan = {
  insert: ResearchRecord[];
  update: { record: ResearchRecord; changed: (keyof ResearchRecord)[] }[];
  unchanged: string[];
  /** 넣지 않았다 — 사람이 정한다(중복인가, 개정판인가) */
  conflicts: { id: string; withId: string; reason: "same-url" | "same-doi" | "same-title" | "duplicate-id-in-file" }[];
};

export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;

const LAYER_TO_HORIZON: Record<string, ResearchHorizon> = {
  current: "tide",
  tide: "tide",
  wind: "wind",
  wave: "wave",
};

/** Research Lab의 layer → 포털 시간축. 모르는 값이면 null(가져오기 오류). */
export function horizonOf(layer: string): ResearchHorizon | null {
  return LAYER_TO_HORIZON[layer.trim().toLowerCase()] ?? null;
}

export const HORIZON_LABEL: Record<ResearchHorizon, string> = {
  tide: "조류(1~12개월)",
  wind: "바람(1~13주)",
  wave: "파도(1~5일)",
};

/**
 * URL 정규화 — 같은 문서를 다른 모양으로 적은 것을 같다고 본다.
 * https로 · 호스트 소문자 · `www.` 제거 · 조각(#)·추적 쿼리(utm_*) 제거 · 끝 `/` 제거. 해석할 수 없으면 null.
 */
export function normalizeUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const params = [...u.searchParams.entries()].filter(([k]) => !/^utm_/i.test(k));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  return `https://${host}${path}${query}`;
}

/** 본문·URL에서 DOI(10.xxxx/…)를 찾는다. 없으면 null. 소문자로 맞춘다. */
export function extractDoi(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const m = t?.match(/\b10\.\d{4,9}\/[^\s"<>?#]+/i);
    if (m) return m[0].replace(/[.,;)]+$/, "").toLowerCase();
  }
  return null;
}

/** 제목 비교용 — 소문자 · 글자와 숫자만. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
}

const REQUIRED = ["id", "title", "source", "date", "url", "layer"] as const;
const OPTIONAL = ["topic", "fact", "method", "limit", "interpret", "hypothesis", "mapping", "candidate", "test", "counter"] as const;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * 파일을 읽어 검사한다. ⚠ 하나라도 틀리면 **아무것도 넣지 않는다**(일부만 들어간 라이브러리는 어디까지 들어갔는지 모른다).
 */
export function parseResearchFile(raw: string): { ok: true; file: ResearchFile } | { ok: false; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`JSON을 읽지 못했습니다: ${(error as Error).message}`] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, errors: ["최상위가 객체가 아닙니다."] };
  const d = data as Record<string, unknown>;
  const errors: string[] = [];

  const schemaVersion = d.schema_version;
  if (typeof schemaVersion !== "number" || !(SUPPORTED_SCHEMA_VERSIONS as readonly number[]).includes(schemaVersion)) {
    errors.push(`schema_version ${String(schemaVersion)}은 지원하지 않습니다(지원: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}).`);
  }
  if (!Array.isArray(d.papers)) errors.push("papers가 배열이 아닙니다.");

  const papers: ResearchRecord[] = [];
  for (const [i, p] of (Array.isArray(d.papers) ? d.papers : []).entries()) {
    if (!p || typeof p !== "object") {
      errors.push(`papers[${i}]가 객체가 아닙니다.`);
      continue;
    }
    const r = p as Record<string, unknown>;
    const label = `papers[${i}]${str(r.id) ? `(${str(r.id)})` : ""}`;
    const missing = REQUIRED.filter((k) => !str(r[k]));
    if (missing.length) {
      errors.push(`${label}: 필수 칸이 비었습니다 — ${missing.join(", ")}`);
      continue;
    }
    const date = str(r.date)!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
      errors.push(`${label}: date가 YYYY-MM-DD가 아닙니다 — ${date}`);
      continue;
    }
    if (!normalizeUrl(str(r.url)!)) {
      errors.push(`${label}: url이 http(s) 주소가 아닙니다.`);
      continue;
    }
    if (!horizonOf(str(r.layer)!)) {
      errors.push(`${label}: layer ${str(r.layer)}를 모릅니다(Current · Wind · Wave).`);
      continue;
    }
    const record = Object.fromEntries([
      ...REQUIRED.map((k) => [k, str(r[k])!]),
      ...OPTIONAL.map((k) => [k, str(r[k])]),
    ]) as ResearchRecord;
    papers.push(record);
  }

  const batches: ResearchBatch[] = [];
  for (const b of Array.isArray(d.batches) ? d.batches : []) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    const id = str(r.id);
    const date = str(r.date);
    if (!id || !date) {
      errors.push("batches: id·date가 없는 항목이 있습니다.");
      continue;
    }
    batches.push({ id, date, cadence: str(r.cadence), summary: str(r.summary) });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    file: { schemaVersion: schemaVersion as number, baseline: d.baseline ?? null, papers, notes: d.notes ?? null, batches },
  };
}

const COMPARED: (keyof ResearchRecord)[] = [...REQUIRED, ...OPTIONAL];

/**
 * 가져오기 계획. 같은 입력이면 같은 결과다(DB에 쓰기 전에 화면에 보일 수 있다).
 * - 같은 `id`가 있으면: 칸이 같으면 `unchanged`, 다르면 `update`(바뀐 칸 목록과 함께).
 * - 새 `id`인데 기존 또는 같은 파일의 다른 연구와 URL·DOI·제목이 같으면 `conflicts` — 넣지 않는다.
 */
export function planImport(incoming: ResearchRecord[], existing: ExistingResearch[]): ImportPlan {
  const plan: ImportPlan = { insert: [], update: [], unchanged: [], conflicts: [] };
  const byId = new Map(existing.map((e) => [e.id, e]));
  // 비교 대상 — 이미 있는 것 + 이번에 넣기로 한 것(같은 파일 안 중복도 잡는다)
  const known: ResearchRecord[] = [...existing];
  const seenIds = new Set<string>();

  for (const rec of incoming) {
    if (seenIds.has(rec.id)) {
      plan.conflicts.push({ id: rec.id, withId: rec.id, reason: "duplicate-id-in-file" });
      continue;
    }
    seenIds.add(rec.id);

    const same = byId.get(rec.id);
    if (same) {
      const changed = COMPARED.filter((k) => (same[k] ?? null) !== (rec[k] ?? null));
      if (changed.length) plan.update.push({ record: rec, changed });
      else plan.unchanged.push(rec.id);
      continue;
    }

    const url = normalizeUrl(rec.url);
    const doi = extractDoi(rec.url);
    const title = normalizeTitle(rec.title);
    const hit = known.find((k) => k.id !== rec.id && normalizeUrl(k.url) === url);
    const doiHit = doi ? known.find((k) => k.id !== rec.id && extractDoi(k.url) === doi) : undefined;
    const titleHit = known.find((k) => k.id !== rec.id && normalizeTitle(k.title) === title);
    if (hit) plan.conflicts.push({ id: rec.id, withId: hit.id, reason: "same-url" });
    else if (doiHit) plan.conflicts.push({ id: rec.id, withId: doiHit.id, reason: "same-doi" });
    else if (titleHit) plan.conflicts.push({ id: rec.id, withId: titleHit.id, reason: "same-title" });
    else {
      plan.insert.push(rec);
      known.push(rec);
    }
  }
  return plan;
}

/** 검증 상태 — ⚠ 가져오기는 항상 CANDIDATE. 올리는 것은 사람이 메모와 함께 한다. */
export const VERIFY_STATUSES = [
  "CANDIDATE",
  "SOURCE_CHECKED",
  "WAITING_DATA",
  "REPRODUCED",
  "BACKTESTED",
  "REJECTED",
  "ADOPTION_REVIEW",
] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

export const VERIFY_LABEL: Record<VerifyStatus, string> = {
  CANDIDATE: "검증 후보",
  SOURCE_CHECKED: "원문 확인",
  WAITING_DATA: "검증 대기(자료 부족)",
  REPRODUCED: "원문 재현",
  BACKTESTED: "백테스트 완료",
  REJECTED: "기각",
  ADOPTION_REVIEW: "운영 반영 심사",
};

export function isVerifyStatus(v: unknown): v is VerifyStatus {
  return typeof v === "string" && (VERIFY_STATUSES as readonly string[]).includes(v);
}
