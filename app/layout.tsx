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
  metadataBase: new URL('https://terminal-arpg-alpha.jolly-vole-8384.chatgpt.site'),
  title: 'Terminal ARPG · Alpha 0.1',
  description: '配置 Build 與刷圖策略，觀看角色在戰鬥終端中自動探索、擊殺與收集戰利品。',
  openGraph: {
    title: 'Terminal ARPG · Alpha 0.1',
    description: 'BUILD. RUN. LOOT. REPEAT.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal ARPG · Alpha 0.1',
    description: 'BUILD. RUN. LOOT. REPEAT.',
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
