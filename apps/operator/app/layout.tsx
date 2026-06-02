import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const rubik = Rubik({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-rubik',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'NDPI · Пульт оператора',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={rubik.variable}>
      <body className="h-screen w-screen overflow-hidden bg-cream font-sans text-coal antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
