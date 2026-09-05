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
  title: 'Terminal ARPG · Alpha 0.5',
  description: '選擇刷圖產業，連續推進異界並從批次戰利品中打造自己的 Build。',
  openGraph: {
    title: 'Terminal ARPG · Alpha 0.5',
    description: '刷圖產業、三選一戰利品與 Build 成長。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal ARPG · Alpha 0.5',
    description: '刷圖產業、三選一戰利品與 Build 成長。',
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
