import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

// 引入 Nunito —— 圆润无衬线字体，配可爱猫猫风格
// 通过 variable 暴露 CSS 变量 --font-nunito，globals.css 里 @theme 会使用
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "🐱 猫猫大法官 · Feline Court",
  description: "AI 调解法官——用可爱的方式解决情侣小争吵",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* LanguageProvider 位于最外层，供整棵组件树共享中英翻译与切换 */}
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
