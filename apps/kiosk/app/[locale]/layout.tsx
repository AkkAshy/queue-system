import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Rubik } from 'next/font/google';
import { locales, type Locale } from '@/i18n/request';
import { Providers } from '../providers';
import { KioskGuards } from '@/components/KioskGuards';
import { IdleReset } from '@/components/IdleReset';
import '../globals.css';

// Rubik — warm, friendly geometric sans. Covers Cyrillic + Latin-ext
// (Karakalpak diacritics). The new design system's single typeface.
const rubik = Rubik({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-rubik',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// The kiosk is fully dynamic/interactive — skip static prerender (next-intl
// server APIs opt into dynamic rendering anyway). Needed for `next build`.
export const dynamic = 'force-dynamic';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} className={rubik.variable}>
      <body className="min-h-screen bg-cream font-sans text-coal antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <KioskGuards />
            <IdleReset />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
