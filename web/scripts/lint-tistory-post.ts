/**
 * 티스토리 글 편집 품질 검사 — **읽기 전용**(GET만 · 로그인·쓰기 없음). 2026-09-27 (82) 운영자 사양.
 *
 * 규칙은 `src/lib/blog/post-lint.ts`(테스트 있음), 대비 공식은 `src/lib/color-contrast.ts`(WCAG 2.1). 여기서는 입력과 출력만 한다.
 *
 * 실행:
 *   npm run lint:post -- <티스토리 글 URL | 저장한 HTML 파일> [--typos 암화화폐,암호화쳬] [--json 결과.json]
 *   예) npm run lint:post -- "https://suhdp.tistory.com/entry/..."
 *
 * 출력: 콘솔 표(규칙 · 수준 · 내용) + JSON(`--json` 경로가 있으면 파일, 없으면 화면 끝에).
 * 종료코드: 0 = 경고 없음 · 1 = 경고(warn) 있음 · 2 = 읽기 실패.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DEFAULT_TYPOS, lintTistoryPost } from "../src/lib/blog/post-lint";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function load(input: string): Promise<string> {
  if (/^https?:\/\//.test(input)) {
    // ⚠ GET만. 쿠키·인증 없이 공개 페이지를 읽는다.
    const res = await fetch(input, { method: "GET", headers: { "user-agent": "Mozilla/5.0 (compatible; WoodsmanBot/1.0; +https://portfolio-solutions.net)" } });
    if (!res.ok) throw new Error(`응답 ${res.status}`);
    return res.text();
  }
  if (!existsSync(input)) throw new Error(`파일이 없다: ${input}`);
  return readFileSync(input, "utf8");
}

async function main(): Promise<number> {
  const input = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && !["--typos", "--json"].includes(all[i - 1] ?? ""));
  if (!input) {
    console.error("사용: npm run lint:post -- <URL | HTML 파일> [--typos a,b] [--json out.json]");
    return 2;
  }
  let html: string;
  try {
    html = await load(input);
  } catch (e) {
    console.error(`✗ 읽지 못했다 — ${(e as Error).message}`);
    return 2;
  }
  const typos = arg("--typos")?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_TYPOS;
  const result = lintTistoryPost(html, { typos });

  console.log(`\n■ ${result.title ?? "(제목 없음)"}`);
  console.log(`  이미지 ${result.stats.images} · alt 없음 ${result.stats.imagesWithoutAlt} · 캡션 없음 ${result.stats.imagesWithoutCaption} · 링크 카드 ${result.stats.ogCards} · 색 검사 ${result.stats.colorsChecked}`);
  if (result.findings.length === 0) console.log("  ✓ 걸린 것 없음");
  else console.table(result.findings.map((f) => ({ 규칙: f.rule, 수준: f.level === "warn" ? "⚠ 경고" : "정보", 내용: f.message })));

  const json = JSON.stringify({ input, checkedAt: new Date().toISOString(), typos, ...result }, null, 2);
  const out = arg("--json");
  if (out) {
    writeFileSync(out, json);
    console.log(`JSON → ${out}`);
  } else {
    console.log(json);
  }
  return result.findings.some((f) => f.level === "warn") ? 1 : 0;
}

main().then((code) => process.exit(code));
