// 「조류(tide)를」이 「조류 / (tide)를」로 갈리지 않게 — 운영 390px에서 실측((81))
import { keepGlossTogether } from "@/lib/format";

/**
 * 첫 화면 — 문구 + 오늘의 바람 한 줄.
 *
 * ## ⚠ 2026-10-31: 버튼 둘(「지금 시장 읽기」·「블로그에서 이어 읽기」)과 숫자 셋(기록 개월·투자일지·리밸런싱)을 뺐다
 * 운영자 결정(「이 부분도 제거」 · 「운영원칙은 개선을 위해 재정립하면 된다」). 메뉴에 같은 길이 있고,
 * 숫자 셋은 기록이 얇은 지금 「0건」으로 사이트를 비어 보이게 했다.
 * ⚠ 1순위(티스토리 유입)의 첫 화면 버튼이 사라졌다 — 그 길은 이제 블로그 블록 · 인사이트 CTA · 글 끝 CTA가 맡는다.
 *   배포 뒤 「티스토리로 넘어간 클릭」으로 잰다(CHANGELOG 가설). 아래 옛 주석은 판단 기록으로 남긴다.
 *
 * ## ⚠ 2026-08-30(Step 2): 계좌 카드를 내렸다
 * 여기 오른쪽에 **계좌 평가액 카드**가 있었다. 그런데 검색으로 들어온 사람은 남의 계좌
 * 숫자를 찾아온 게 아니고, 이 사이트의 1순위 목적은 **블로그로 넘기는 것**이다.
 * 계좌는 지우지 않고 **콘텐츠 뒤로 옮겼다**(`AccountStrip`) — 입구는 콘텐츠가 맡고,
 * 계좌는 그 흐름에 대한 **나의 답**으로 따라붙는다.
 *
 * ⚠ **숫자 셋(기록 개월·투자일지·리밸런싱)은 남긴다.** 이건 계좌 잔고가 아니라
 *    **기록이 얼마나 두꺼운가**이고, 처음 온 사람에게 이 사이트가 무엇인지 말해 준다.
 *    셋 다 0이어도 그대로 둔다 — 0은 "아직 없다"는 사실이고, 사실은 감추지 않는다.
 *
 * ## ⚠ 2026-08-30(Step 3): 첫 줄이 **오늘의 바람**이 됐다
 * "일기예보를 보고 우산을 챙기듯" 읽는 자리라면, 들어오자마자 **오늘의 하늘**이 보여야 한다.
 * 그 한 줄은 `lib/home-lede.ts`가 만들고, ⚠ **만들 수 없으면 null이다** — 없는 상태를
 * 그럴듯한 문장으로 덮지 않는다.
 *
 * ⚠ 「블로그에서 이어 읽기」는 **반드시 `/go/…` 경유**다. 주소를 직접 걸면 나가는 클릭이
 *    안 세지고, 그러면 이 사이트의 1순위 지표가 빈다(2026-08-25 결정).
 */
export function HeroSection({
  heroTitle,
  heroSubtitle,
  lede,
}: {
  heroTitle: string;
  heroSubtitle: string;
  /** 오늘의 바람 한 줄. ⚠ 값이 없으면 null이고, 그때는 줄 자체를 그리지 않는다 */
  lede: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(700px 320px at 12% -10%, rgba(201,166,87,.16), transparent 60%), radial-gradient(600px 300px at 88% 0%, rgba(54,160,106,.14), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <div className="fade-up max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-[11px] text-gold-400">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-glow" />
            CULTIVATING WEALTH LIKE A FOREST
          </span>
          {/* 줄 길이를 고르게(text-wrap: balance) — 마지막 줄에 한두 단어만 남는 것을 막는다((81)) */}
          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink leading-[1.25] tracking-tight [text-wrap:balance]">
            {keepGlossTogether(heroTitle)}
          </h1>

          {/* 오늘의 바람 — 값이 없으면 이 줄은 아예 없다(지어내지 않는다). */}
          {lede && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 px-3.5 py-2 text-[12.5px] text-gray-300 backdrop-blur">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {typeof lede === "string" ? keepGlossTogether(lede) : lede}
            </p>
          )}
          <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">{keepGlossTogether(heroSubtitle)}</p>
        </div>
      </div>
    </section>
  );
}
