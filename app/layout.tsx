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
  title: 'Terminal ARPG · Alpha 0.2',
  description: '設定地圖 Tier 與持續條件，自動刷圖、消耗地圖、替換裝備並切換技能。',
  openGraph: {
    title: 'Terminal ARPG · Alpha 0.2',
    description: '刷圖、掉寶、換裝、換技能，持續成長。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal ARPG · Alpha 0.2',
    description: '刷圖、掉寶、換裝、換技能，持續成長。',
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
