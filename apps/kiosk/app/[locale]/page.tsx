import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('welcome');
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-kiosk-lg font-bold">{t('title')}</h1>
    </main>
  );
}
