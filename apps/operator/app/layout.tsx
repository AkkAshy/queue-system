import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'NDPI · Пульт оператора',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={jetbrains.variable}>
      <body className="h-screen w-screen overflow-hidden bg-ink-900 font-sans text-paper-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
