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
  title: 'Terminal ARPG · Alpha 0.12',
  description: '選擇 RO 風格職業，從零收集技能寶石、通貨與六格裝備，透過自動遠征養成 Build。',
  openGraph: {
    title: 'Terminal ARPG · Alpha 0.12',
    description: 'RO 職業、技能寶石、彩色洞連線與自動遠征。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal ARPG · Alpha 0.12',
    description: 'RO 職業、技能寶石、彩色洞連線與自動遠征。',
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
