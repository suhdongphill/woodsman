/**
 * 파도(오늘의 기사) 피드 해석 — 픽스처는 **2026-09-14에 받은 실제 응답 파일 그대로**다(`fixtures/*.xml`).
 * 연준 RSS 셋(연설·금융정책 보도자료·의회 증언)과 BLS CPI(Atom).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cleanText, mergeNews, parseBlsCpiAtom, parseFedRss } from "./feeds";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}.xml`, import.meta.url)), "utf8");

describe("연준 RSS", () => {
  it("⚠ 파일 맨 앞 BOM · CDATA 링크·날짜를 풀고 15건을 모두 읽는다", () => {
    const xml = fixture("fed_speeches");
    expect(xml.charCodeAt(0)).toBe(0xfeff);
    const r = parseFedRss(xml, "FED_SPEECH");
    expect(r.skipped).toBe(0);
    expect(r.items).toHaveLength(15);
    expect(r.items[0]).toMatchObject({
      source: "FED_SPEECH",
      category: "연준",
      title: "Waller, The Economic Outlook and Some Comments on My Policy Communication",
      url: "https://www.federalreserve.gov/newsevents/speech/waller20260903a.htm",
      publishedAt: "2026-09-03T12:30:00.000Z",
      speaker: "Waller",
    });
  });

  it("발언자는 제목의 쉼표 앞에서만 뽑는다 — 보도자료에는 발언자를 붙이지 않는다", () => {
    const monetary = parseFedRss(fixture("fed_monetary"), "FED_MONETARY");
    expect(monetary.items.every((i) => i.speaker === undefined)).toBe(true);
    expect(monetary.items.map((i) => i.title)).toContain("Federal Reserve issues FOMC statement");
    const testimony = parseFedRss(fixture("fed_testimony"), "FED_TESTIMONY");
    expect(testimony.items[0].speaker).toBe("Warsh");
  });

  it("⚠ 엔티티를 푼다 — 제목에 &#39;가 그대로 보이지 않게", () => {
    const monetary = parseFedRss(fixture("fed_monetary"), "FED_MONETARY");
    expect(monetary.items[0].title).toBe("Minutes of the Board's discount rate meetings on July 20 and July 29, 2026");
    expect(cleanText("A &amp; B &#39;C&#39;")).toBe("A & B 'C'");
  });

  it("⚠ 제목·링크·날짜 중 하나라도 없거나 연준 주소가 아니면 버리고 센다", () => {
    const broken = `<rss><channel>
      <item><title>No link</title><pubDate>Thu, 3 Sep 2026 12:30:00 GMT</pubDate></item>
      <item><title>Elsewhere</title><link>https://example.com/x</link><pubDate>Thu, 3 Sep 2026 12:30:00 GMT</pubDate></item>
      <item><title>Bad date</title><link>https://www.federalreserve.gov/x.htm</link><pubDate>not a date</pubDate></item>
    </channel></rss>`;
    expect(parseFedRss(broken, "FED_SPEECH")).toEqual({ items: [], skipped: 3 });
  });
});

describe("BLS CPI (Atom)", () => {
  it("⭐ 발표 요지를 한 줄 요약으로 — 기관이 준 문장 그대로", () => {
    const r = parseBlsCpiAtom(fixture("bls_cpi"));
    expect(r.skipped).toBe(0);
    expect(r.items).toHaveLength(12);
    expect(r.items[0]).toMatchObject({
      source: "BLS_CPI",
      category: "물가",
      title: "CPI for all items increases 0.4% in August; gasoline rises",
      url: "https://www.bls.gov/news.release/archives/cpi_09112026.htm",
      publishedAt: "2026-09-11T11:50:40.968Z",
    });
    expect(r.items[0].summary).toContain("rose 3.4 percent over the last 12 months");
  });
});

describe("홈 파도 순서", () => {
  it("최신순 · 같은 링크는 한 번 · 개수 제한", () => {
    const lists = [
      parseFedRss(fixture("fed_speeches"), "FED_SPEECH").items,
      parseFedRss(fixture("fed_monetary"), "FED_MONETARY").items,
      parseFedRss(fixture("fed_testimony"), "FED_TESTIMONY").items,
      parseBlsCpiAtom(fixture("bls_cpi")).items,
    ];
    const merged = mergeNews([...lists, lists[0]], 6);
    expect(merged).toHaveLength(6);
    expect(merged[0].title).toBe("CPI for all items increases 0.4% in August; gasoline rises");
    expect(new Set(merged.map((n) => n.url)).size).toBe(6);
    for (let i = 1; i < merged.length; i++) expect(merged[i - 1].publishedAt >= merged[i].publishedAt).toBe(true);
  });
});
