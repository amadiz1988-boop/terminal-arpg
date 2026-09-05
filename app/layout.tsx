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
  title: 'Terminal ARPG · Alpha 0.4',
  description: '選定獵取目標，讓角色跨 Tier 自動刷圖、取得保底獎勵並持續成長。',
  openGraph: {
    title: 'Terminal ARPG · Alpha 0.4',
    description: '目標獵取、自動升階、永不卡死。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal ARPG · Alpha 0.4',
    description: '目標獵取、自動升階、永不卡死。',
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
