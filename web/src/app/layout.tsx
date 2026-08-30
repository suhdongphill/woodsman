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
  title: {
    default: "Woodsman — 계좌를 공개하는 투자 기록",
    template: "%s | Woodsman",
  },
  description:
    "성장·인컴·방어로 나눈 계좌의 납입원금 대비 평가액을 공개하고, 매매할 때마다 근거를 투자일지로 남기는 개인 투자 기록 블로그. 종목 추천이 아닌 정보 제공 목적입니다.",
  openGraph: {
    type: "website",
    siteName: "Woodsman",
    locale: "ko_KR",
    title: "Woodsman — 계좌를 공개하는 투자 기록",
    description:
      "매달 얼마를 넣었고 지금 얼마가 되었는지, 그 사이의 판단까지 그대로 공개합니다.",
  },
  icons: { icon: "/woodsman-mark.svg", apple: "/woodsman-mark.svg" },
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
