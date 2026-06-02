import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JetBrains_Mono } from 'next/font/google';
import { locales, type Locale } from '@/i18n/request';
import { Providers } from '../providers';
import { KioskGuards } from '@/components/KioskGuards';
import { IdleReset } from '@/components/IdleReset';
import '../globals.css';

// JetBrains Mono — primary typeface across the entire kiosk.
// Variable weight (200–800), excellent Cyrillic + extended Latin (covers
// Karakalpak diacritics). Used for display, body, labels, ticket numbers —
// the whole interface speaks in one voice.
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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
    <html lang={locale} className={jetbrains.variable}>
      <body className="min-h-screen bg-ink-900 font-sans text-paper-100 antialiased">
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
