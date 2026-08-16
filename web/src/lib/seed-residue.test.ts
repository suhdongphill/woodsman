import { describe, expect, it } from "vitest";
import {
  findSeedResidue,
  holdingsMissingNotice,
  isSeedHolding,
  isSeedJournal,
  isSeedPost,
  isSeedSnapshot,
  residueNotice,
} from "./seed-residue";
import {
  seedAccountSnapshots,
  seedComments,
  seedJournalEntries,
  seedModelHoldings,
  seedPosts,
} from "./seed-data";

/** 시드 첫 줄을 DB에서 읽어 온 모양으로. */
const seedSnapshot = () => {
  const s = seedAccountSnapshots[0];
  return { date: s.date, principal: s.principal, value: s.value, income: s.income ?? 0 };
};

describe("isSeedSnapshot — ⚠ 완전 일치로만 본다", () => {
  it("시드 값 그대로면 잡는다", () => {
    expect(isSeedSnapshot(seedSnapshot())).toBe(true);
  });

  it("⚠ 한 칸이라도 손댔으면 사람의 기록이다 — 잡지 않는다", () => {
    expect(isSeedSnapshot({ ...seedSnapshot(), value: seedSnapshot().value + 1 })).toBe(false);
    expect(isSeedSnapshot({ ...seedSnapshot(), principal: 1 })).toBe(false);
    expect(isSeedSnapshot({ ...seedSnapshot(), income: 999 })).toBe(false);
    expect(isSeedSnapshot({ ...seedSnapshot(), date: "2020-01-31" })).toBe(false);
  });

  it("2026-08-16에 운영에서 실제로 발견된 줄을 잡는다", () => {
    // 사고 당시 /portfolio가 보여주던 마지막 점이다.
    expect(
      isSeedSnapshot({
        date: "2026-07-31",
        principal: 68_000_000,
        value: 76_540_000,
        income: 1_410_000,
      }),
    ).toBe(true);
  });
});

describe("isSeedJournal · isSeedHolding", () => {
  it("시드 일지를 잡는다", () => {
    const j = seedJournalEntries[0];
    expect(isSeedJournal({ date: j.date, title: j.title })).toBe(true);
    expect(isSeedJournal({ date: j.date, title: `${j.title} (내가 고친 제목)` })).toBe(false);
  });

  it("시드 종목을 잡는다", () => {
    const h = seedModelHoldings[0];
    expect(isSeedHolding({ name: h.name, ticker: h.ticker, targetWeight: h.targetWeight })).toBe(
      true,
    );
    // 목표 비중을 바꿨으면 운영자가 만진 것이다
    expect(
      isSeedHolding({ name: h.name, ticker: h.ticker, targetWeight: h.targetWeight + 1 }),
    ).toBe(false);
  });
});

describe("findSeedResidue", () => {
  it("⚠ 남은 게 없으면 빈 배열 — 늘 켜져 있는 경고는 아무도 안 읽는다", () => {
    expect(findSeedResidue({ snapshots: [], journal: [], holdings: [] })).toEqual([]);
  });

  it("사람이 직접 쓴 기록만 있으면 잡지 않는다", () => {
    const found = findSeedResidue({
      snapshots: [{ date: "2026-09-30", principal: 1_000, value: 1_100, income: 0 }],
      journal: [{ date: "2026-09-01", title: "내가 쓴 일지" }],
      holdings: [{ name: "내 종목", ticker: "ABC", targetWeight: 5 }],
    });
    expect(found).toEqual([]);
  });

  it("2026-08-16 운영 상태를 재현한다 — 스냅숏 7 · 일지 6 · 종목 0", () => {
    const found = findSeedResidue({
      snapshots: seedAccountSnapshots.map((s) => ({
        date: s.date,
        principal: s.principal,
        value: s.value,
        income: s.income ?? 0,
      })),
      journal: seedJournalEntries.map((j) => ({ date: j.date, title: j.title })),
      holdings: [],
    });

    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ kind: "snapshot", matched: 7, total: 7, where: "/admin/journal" });
    expect(found[1]).toMatchObject({ kind: "journal", matched: 6, total: 6 });
    // ⚠ 종목은 이미 지웠으므로 잡히면 안 된다
    expect(found.some((f) => f.kind === "holding")).toBe(false);
  });

  it("일부만 남아도 '몇 건 중 몇 건'을 센다", () => {
    const found = findSeedResidue({
      snapshots: [
        seedSnapshot(),
        { date: "2026-09-30", principal: 1, value: 2, income: 0 },
      ],
      journal: [],
      holdings: [],
    });
    expect(found[0]).toMatchObject({ matched: 1, total: 2 });
  });
});

describe("residueNotice", () => {
  it("남은 게 없으면 빈 문자열", () => {
    expect(residueNotice([])).toBe("");
  });

  it("⚠ '무엇이 공개되고 있나'를 말한다", () => {
    const notice = residueNotice(
      findSeedResidue({
        snapshots: seedAccountSnapshots.map((s) => ({
          date: s.date,
          principal: s.principal,
          value: s.value,
          income: s.income ?? 0,
        })),
        journal: [],
        holdings: [],
      }),
    );
    expect(notice).toContain("7건");
    expect(notice).toContain("공개 화면");
  });
});

describe("holdingsMissingNotice — 종목은 없는데 곡선만 있는 모순", () => {
  it("2026-08-16 상태를 잡는다", () => {
    expect(holdingsMissingNotice({ publishedHoldings: 0, snapshots: 7 })).toContain("7건");
  });

  it("종목이 있으면 모순이 아니다", () => {
    expect(holdingsMissingNotice({ publishedHoldings: 3, snapshots: 7 })).toBe("");
  });

  it("스냅숏도 없으면 할 말이 없다", () => {
    expect(holdingsMissingNotice({ publishedHoldings: 0, snapshots: 0 })).toBe("");
  });
});

describe("글·댓글도 같은 규칙으로 잡는다", () => {
  it("시드 글과 시드 댓글을 잡는다", () => {
    const found = findSeedResidue({
      snapshots: [],
      journal: [],
      holdings: [],
      posts: seedPosts.map((p) => ({ slug: p.slug, title: p.title })),
      comments: seedComments.map((c) => ({ authorName: c.authorName, body: c.body })),
    });

    expect(found.find((f) => f.kind === "post")?.matched).toBe(seedPosts.length);
    expect(found.find((f) => f.kind === "comment")?.matched).toBe(seedComments.length);
  });

  it("제목을 고친 글은 사람의 글이다", () => {
    const p = seedPosts[0];
    expect(isSeedPost({ slug: p.slug, title: `${p.title} (개정)` })).toBe(false);
  });

  it("posts·comments를 안 넘기면 그 항목은 판정하지 않는다 — 없는 것을 깨끗하다고 하지 않는다", () => {
    const found = findSeedResidue({ snapshots: [], journal: [], holdings: [] });
    expect(found.some((f) => f.kind === "post" || f.kind === "comment")).toBe(false);
  });
});
