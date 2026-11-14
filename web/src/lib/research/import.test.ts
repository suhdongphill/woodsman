import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractDoi,
  horizonOf,
  normalizeTitle,
  normalizeUrl,
  parseResearchFile,
  planImport,
  type ResearchRecord,
} from "./import";

const rec = (over: Partial<ResearchRecord> = {}): ResearchRecord => ({
  id: "R-001",
  title: "Chasing El Dorado",
  source: "BIS · WP 1380",
  date: "2026-10-06",
  url: "https://www.bis.org/publications/wp1380",
  topic: "교차시장 신호",
  layer: "Wind",
  fact: "사실",
  method: null,
  limit: "한계",
  interpret: null,
  hypothesis: null,
  mapping: null,
  candidate: "후보",
  test: null,
  counter: "반론",
  ...over,
});

const file = (papers: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema_version: 1, baseline: { Current: 50 }, papers, notes: {}, batches: [], ...extra });

describe("parseResearchFile", () => {
  it("운영자가 넣은 실제 파일(docs/GCRM_Research_2026-11-14.json)을 읽는다 — 11편 · 배치 3", () => {
    const raw = readFileSync(join(__dirname, "../../../../docs/GCRM_Research_2026-11-14.json"), "utf8");
    const parsed = parseResearchFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.papers).toHaveLength(11);
    expect(parsed.file.batches).toHaveLength(3);
    expect(new Set(parsed.file.papers.map((p) => horizonOf(p.layer)))).toEqual(new Set(["tide", "wind", "wave"]));
    // ⚠ 같은 파일을 처음 가져오면 전부 넣고, 두 번째에는 전부 그대로 — 중복 0
    const first = planImport(parsed.file.papers, []);
    expect(first.insert).toHaveLength(11);
    expect(first.conflicts).toEqual([]);
    const second = planImport(parsed.file.papers, parsed.file.papers);
    expect(second.insert).toHaveLength(0);
    expect(second.update).toHaveLength(0);
    expect(second.unchanged).toHaveLength(11);
  });

  it("⚠ 하나라도 틀리면 아무것도 넘기지 않는다 — 필수 칸 · 날짜 · URL 스킴 · 모르는 layer", () => {
    const bad = parseResearchFile(
      file([
        rec({ title: "" }),
        rec({ id: "R-2", date: "2026/10/06" }),
        rec({ id: "R-3", url: "javascript:alert(1)" }),
        rec({ id: "R-4", layer: "Storm" }),
        rec({ id: "R-5" }),
      ]),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors).toHaveLength(4);
  });

  it("지원하지 않는 schema_version · 깨진 JSON은 거절", () => {
    expect(parseResearchFile(file([rec()], { schema_version: 2 })).ok).toBe(false);
    expect(parseResearchFile("{ not json").ok).toBe(false);
    expect(parseResearchFile("[]").ok).toBe(false);
  });

  it("빈 선택 칸은 null — 빈 문자열을 값처럼 저장하지 않는다", () => {
    const parsed = parseResearchFile(file([{ ...rec(), method: "  ", topic: undefined }]));
    expect(parsed.ok && parsed.file.papers[0].method).toBeNull();
    expect(parsed.ok && parsed.file.papers[0].topic).toBeNull();
  });
});

describe("planImport — 중복 가져오기", () => {
  it("같은 id에 칸이 바뀌면 update(바뀐 칸과 함께)", () => {
    const plan = planImport([rec({ limit: "새 한계" })], [rec()]);
    expect(plan.update).toEqual([{ record: rec({ limit: "새 한계" }), changed: ["limit"] }]);
  });

  it("⚠ 다른 id인데 URL이 같으면(모양만 다름) 넣지 않고 묻는다", () => {
    const plan = planImport(
      [rec({ id: "R-NEW", url: "http://bis.org/publications/wp1380/?utm_source=x#top" })],
      [rec()],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.conflicts).toEqual([{ id: "R-NEW", withId: "R-001", reason: "same-url" }]);
  });

  it("DOI가 같으면 · 제목이 같으면(대소문자·문장부호 무시) 묻는다", () => {
    const a = rec({ id: "A", url: "https://doi.org/10.1234/abc.5", title: "One" });
    expect(planImport([rec({ id: "B", url: "https://example.org/10.1234/ABC.5", title: "Two" })], [a]).conflicts[0].reason).toBe(
      "same-doi",
    );
    expect(planImport([rec({ id: "C", url: "https://x.org/c", title: "chasing el-dorado!" })], [rec()]).conflicts[0].reason).toBe(
      "same-title",
    );
  });

  it("같은 파일 안의 중복 id · 같은 파일 안에서 URL이 겹치는 것도 잡는다", () => {
    const plan = planImport([rec(), rec(), rec({ id: "R-002" })], []);
    expect(plan.insert.map((r) => r.id)).toEqual(["R-001"]);
    expect(plan.conflicts.map((c) => c.reason)).toEqual(["duplicate-id-in-file", "same-url"]);
  });
});

describe("정규화", () => {
  it("URL — https · www 제거 · 끝 / · utm · 조각 제거 · 다른 스킴은 null", () => {
    expect(normalizeUrl("http://WWW.BIS.org/a/b/?utm_medium=e&x=1#f")).toBe("https://bis.org/a/b?x=1");
    expect(normalizeUrl("ftp://bis.org/a")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
  it("DOI · 제목 · layer", () => {
    expect(extractDoi("see https://doi.org/10.1016/J.JFE.2026.01.002.")).toBe("10.1016/j.jfe.2026.01.002");
    expect(extractDoi(null, "no doi")).toBeNull();
    expect(normalizeTitle("Risk Appetite & Monetary Transmission")).toBe("riskappetitemonetarytransmission");
    expect(horizonOf("Current")).toBe("tide");
    expect(horizonOf(" wave ")).toBe("wave");
    expect(horizonOf("Tsunami")).toBeNull();
  });
});
