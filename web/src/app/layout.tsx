import type { Metadata } from "next";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { Noto_Sans_KR } from "next/font/google";
import { AdSense } from "@/components/analytics/AdSense";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  // OG·canonical이 절대 URL이어야 해서 기준 주소를 못 박는다(SITE_URL).
  metadataBase: new URL(siteUrl()),
  /**
   * ⚠ 2026-08-30: **검색이 읽는 문장을 화면과 맞췄다.**
   *
   * 화면은 "흐름 먼저, 계좌는 그 답"으로 바뀌었는데 여기는 계좌 이야기가 남아 있었다.
   * 구글이 보여 주는 건 화면이 아니라 이 문장이라, 그대로 두면 **금리·유동성을 찾는 사람에게
   * 안 걸린다.** 화면만 고치고 메타를 두는 사고는 2026-08-25에 이미 한 번 겪었다.
   *
   * ⚠ 지표 개수 같은 **숫자를 여기 적지 않는다.** 정적 문자열이라 지표가 늘면 조용히 거짓이 된다
   *    (수를 세어 말하는 자리는 `lib/llms-txt.ts`뿐이고, 거기서는 실제로 센다).
   */
  title: {
    default: "Woodsman — 거시 지표로 읽는 경제 흐름과 투자 기록",
    template: "%s | Woodsman",
  },
  description:
    "금리·물가·유동성·고용 같은 거시 지표를 기준일·출처와 함께 공개하고, 침체 신호를 종합해 지금 경제가 어느 쪽으로 부는지 읽습니다. 그 흐름에 맞춘 포트폴리오와 판단 근거까지 그대로 남깁니다. 종목 추천이 아닌 정보 제공 목적입니다.",
  openGraph: {
    type: "website",
    siteName: "Woodsman",
    locale: "ko_KR",
    title: "Woodsman — 거시 지표로 읽는 경제 흐름과 투자 기록",
    description:
      "파도가 아니라 바람과 조류를 봅니다. 금리·물가·유동성이 어느 쪽으로 부는지 먼저 읽고, 그 흐름에 맞춘 판단을 그대로 남깁니다.",
  },
  /**
   * ⚠ 파비콘은 `src/app/icon.svg` **파일 규약**으로 나간다(App Router가 알아서 붙인다).
   *    전에는 여기 `icons:`로 지정했는데 **`app/favicon.ico`가 그것을 이겨서** 옛 아이콘이
   *    계속 나갔다 — 코드는 새 아이콘을 가리키는데 브라우저 탭만 옛것이라 알아채기 어려웠다.
   *    그래서 `favicon.ico`를 지우고 규약 하나로 모았다.
   * ⚠ 모양을 바꾸면 `src/app/icon.svg`와 `public/woodsman-mark.svg`(애플 터치용)를 같이 고친다.
   */
  icons: { apple: "/woodsman-mark.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={notoSansKr.variable} suppressHydrationWarning>
      <head>
        {/*
          ⚠ 첫 페인트 **전에** 저장된 테마를 붙인다. 없으면 다크를 고른 사람이
             흰 화면을 한 번 맞는다(FOUC). 판단은 lib/theme.ts에 있고 여기서는 실행만 한다.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-ink antialiased">
        {children}
        <AdSense />
      </body>
    </html>
  );
}
