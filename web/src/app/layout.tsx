import type { Metadata } from "next";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { Noto_Sans_KR } from "next/font/google";
import { AdSense } from "@/components/analytics/AdSense";
import { siteUrl } from "@/lib/site-url";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/site-identity";
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
   * ⚠ 2026-08-31(Step 5): 문장 자체는 **`lib/site-identity.ts` 한 곳**으로 옮겼다.
   *    같은 문장이 여기와 `llms-txt.ts`와 홈 JSON-LD에 따로 박혀 있으면 하나만 고쳐진다.
   */
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: SITE_TITLE,
    description: SITE_OG_DESCRIPTION,
  },
  /**
   * ⚠ 파비콘은 `src/app/icon.svg`에 두되 **여기서 명시적으로 가리킨다.**
   *    `metadata.icons`를 하나라도 지정하면 **파일 규약이 통째로 덮여** 자동 `<link rel="icon">`이
   *    사라진다 — 2026-08-30에 실제로 그랬다(파일은 200으로 있는데 태그만 없었다).
   *    전에는 여기 `icons:`로 지정했는데 **`app/favicon.ico`가 그것을 이겨서** 옛 아이콘이
   *    계속 나갔다 — 코드는 새 아이콘을 가리키는데 브라우저 탭만 옛것이라 알아채기 어려웠다.
   *    그래서 `favicon.ico`를 지우고 규약 하나로 모았다.
   * ⚠ 모양을 바꾸면 `src/app/icon.svg`와 `public/woodsman-mark.svg`(애플 터치용)를 같이 고친다.
   */
  icons: { icon: "/icon.svg", apple: "/woodsman-mark.svg" },
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
