import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { apiMode } from "@/lib/api";
import "./globals.css";

// 숫자·영문은 Inter Tight, 한글은 Noto Sans KR, 코드는 JetBrains Mono (ADR-018)
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Retrievo",
  description: "꺼낼수록 지식이 쌓이는 인출 효과 기반 학습 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

/*
 * 백엔드 미리 깨우기. 백엔드(Cloud Run)는 요청이 없으면 0대로 내려가서, 다시 켜질 때 첫 요청이 10초쯤 걸린다.
 * 화면의 JS가 내려받아져 실행되기를 기다리지 않고, HTML이 도착하자마자 가벼운 요청을 하나 보내 켜지기 시작하게 한다.
 * 응답은 쓰지 않는다. 로그인 화면처럼 API를 부르지 않는 화면에서도 깨워 둔다. 목 API로 개발할 때는 보내지 않는다.
 */
const WAKE_BACKEND = `fetch("/api/me",{credentials:"same-origin",headers:{Accept:"application/json"}}).catch(function(){})`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${interTight.variable} ${notoSansKr.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        {/* next/script의 beforeInteractive는 인라인 코드를 Next 런타임이 받아진 뒤에 실행해서, 그냥 script를 쓴다 */}
        {apiMode === "http" && <script id="wake-backend" dangerouslySetInnerHTML={{ __html: WAKE_BACKEND }} />}
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
