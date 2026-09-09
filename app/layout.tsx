import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://terminal-arpg-alpha.amadiz1988.chatgpt.site'),
  title: '鬼島傳說 · RO 自動冒險 R0.2',
  description: '以 rAthena Renewal 資料與 OpenKore 自動化邏輯驅動的純掛機 RO 核心預覽。',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: '鬼島傳說 · RO 自動冒險 R0.2',
    description: '真實 prt_fild08 尋路、逐擊戰鬥、掉落與雙 EXP。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '鬼島傳說 · RO 自動冒險 R0.2',
    description: '真實 prt_fild08 尋路、逐擊戰鬥、掉落與雙 EXP。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
