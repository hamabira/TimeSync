import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "AkiMatch | 空き時間が重なるところを見つける日程調整アプリ",
  description: "みんなの空き時間、重なるところだけすぐ見える。予定がバラバラな学生グループ向けの日程調整アプリです。",
  icons: {
    icon: "/brand/icon.png",
    apple: "/brand/apple-icon.png",
  },
  openGraph: {
    title: "AkiMatch | 空き時間が重なるところを見つける日程調整アプリ",
    description: "みんなの空き時間、重なるところだけすぐ見える。予定がバラバラな学生グループ向けの日程調整アプリです。",
    type: "website",
    images: [
      {
        url: "/brand/opengraph-image.png",
        alt: "AkiMatch の共有プレビュー画像",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AkiMatch | 空き時間が重なるところを見つける日程調整アプリ",
    description: "みんなの空き時間、重なるところだけすぐ見える。予定がバラバラな学生グループ向けの日程調整アプリです。",
    images: [
      {
        url: "/brand/twitter-image.png",
        alt: "AkiMatch の共有プレビュー画像",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-900"
        style={{
          fontFamily:
            'Inter, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif',
        }}
      >
        <header className="sticky top-0 z-50 w-full border-b-2 border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AkiMatch</span>
            </div>
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="py-6 border-t-2 border-slate-200 bg-white">
          <div className="container mx-auto px-4 text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AkiMatch. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
