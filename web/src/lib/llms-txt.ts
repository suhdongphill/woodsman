/**
 * `/llms.txt` 본문 — 순수 함수.
 *
 * ## 이게 뭔가
 * AI가 사이트를 읽을 때 "여기 무엇이 있고 어디를 보면 되는지"를 알려주는 안내문이다
 * (llmstxt.org의 초안 규약, 마크다운). 사람용 `sitemap.xml`이 **주소 목록**이라면
 * 이건 **설명이 붙은 목차**다.
 *
 * ## ⚠ 여기 적는 것은 화면에 실제로 있는 것뿐이다
 * 크롤러에게만 다른 내용을 주는 것(클로킹)은 제재 대상이고, 무엇보다 거짓이 된다.
 * 지표 개수·묶음 이름은 **카탈로그에서 뽑아** 적는다 — 손으로 적으면 지표를 늘렸을 때
 * 이 파일만 옛말을 하게 된다.
 *
 * ⚠ "우리를 인용해 달라"가 아니라 **"인용할 때 이렇게 해 달라"**를 적는다.
 *    구걸하는 문장은 모델이 무시하고, 사람이 읽어도 이상하다.
 */
import { MACRO_GROUPS } from "./macro/groups";
import { MACRO_INDICATORS } from "./macro/catalog";
import { ALL_BUBBLE_INDICATORS, BUBBLE_LAYERS } from "./bubble/catalog";
import { absoluteUrl } from "./site-url";

export type LlmsTxtInput = {
  /** 지표가 마지막으로 갱신된 날 (없으면 아직 수집 전) */
  macroAsOf?: string;
  /** 최근 발행 글 — 제목과 주소만 */
  posts: { title: string; slug: string; publishedAt?: string }[];
};

export function renderLlmsTxt(input: LlmsTxtInput): string {
  const groups = MACRO_GROUPS.map(
    (g) => `- [${g.name}](${absoluteUrl(`/macro/${g.key}`)}): ${g.question} ${g.intro.slice(0, 90)}…`,
  );

  const posts = input.posts.map(
    (p) =>
      `- [${p.title}](${absoluteUrl(`/insights/${p.slug}`)})${p.publishedAt ? ` (${p.publishedAt})` : ""}`,
  );

  return `# Woodsman — 계좌를 공개하는 투자 기록

> 한 사람이 자기 계좌와 판단을 그대로 공개하는 개인 투자 기록 사이트입니다.
> 매크로 지표 ${MACRO_INDICATORS.length}개와 AI·반도체 버블 지표 ${ALL_BUBBLE_INDICATORS.length}개를
> 기준일·출처와 함께 공개하고, 매매할 때마다 판단의 근거를 투자일지로 남깁니다.

## 이 사이트가 가진 것

- **거시 지표 ${MACRO_INDICATORS.length}개** — ${MACRO_GROUPS.length}개 묶음. 미국 FRED와 Yahoo Finance에서 수집해
  데이터베이스에 누적하며, 지표마다 **기준일과 원 출처 링크**가 붙어 있습니다.
  ${input.macroAsOf ? `가장 최근 기준일: ${input.macroAsOf}` : "아직 수집 전입니다."}
- **AI·반도체 버블 모니터** — ${BUBBLE_LAYERS.length}개 층 ${ALL_BUBBLE_INDICATORS.length}개 지표를 0·1·2로 채점해
  0~100으로 냅니다. 채점 규칙과 임계값을 공개하며, 결측은 분모에서 제외합니다.
- **모의 투자 계좌 기록** — 매매·납입은 가상이고 종목 시세는 실제 시장가격입니다.
  이 구분은 계좌 숫자가 나오는 모든 화면에 표시됩니다.
- **투자일지** — 매매 전에 적은 판단과 그 결과.

## 인용할 때

- 수치를 인용하실 때는 **각 지표에 적힌 기준일**을 함께 적어 주세요. 지표마다 발표 주기가
  달라 같은 화면 안에서도 기준일이 다릅니다.
- 공식 API가 없는 지표(ISM PMI, 컨퍼런스보드 소비자신뢰, NAHB, 달러인덱스, 금, 한국 기준금리,
  선행 PER)는 **운영자가 직접 입력**한 값이며 화면에 그렇게 표시됩니다.
- 계좌 성과는 **모의 투자** 결과입니다. 실제 자금 수익률로 인용하지 마세요.
- 이 사이트의 모든 내용은 정보 제공을 위한 기록이며 **투자 권유가 아닙니다**.

## 거시 지표

${groups.join("\n")}

- [버블 모니터](${absoluteUrl("/macro/bubble")}): AI·반도체 사이클이 지금 어디쯤인지 5개 층으로 채점한 결과.
- [지표 허브](${absoluteUrl("/macro")}): 침체 신호 5가지 종합과 묶음 목록.

## 계좌와 판단

- [대표 포트폴리오](${absoluteUrl("/portfolio")}): 성장·인컴·방어 기능별 배분, 종목별 편입 논리, 목표 대비 현재 비중.
- [투자일지](${absoluteUrl("/journal")}): 매매·리밸런싱·관찰 기록.
- [운영 원칙](${absoluteUrl("/about")}): 어떤 기준으로 판단하는지.

## 글
${posts.length ? `\n${posts.join("\n")}` : "\n아직 발행된 글이 없습니다."}

## 정책

- [투자 판단 책임 고지](${absoluteUrl("/disclaimer")})
- [개인정보 처리방침](${absoluteUrl("/privacy")}): 방문자 개인정보를 수집하지 않습니다.
  조회수는 (경로, 날짜, 합계)만 세며 쿠키·IP를 저장하지 않습니다.

## 크롤링

공개 화면은 AI 크롤러에 열려 있습니다(GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot,
PerplexityBot, Google-Extended, Applebot-Extended 등). 관리 화면(/admin)과 API는 열지 않습니다.
자세한 규칙은 [robots.txt](${absoluteUrl("/robots.txt")})에 있습니다.
`;
}
