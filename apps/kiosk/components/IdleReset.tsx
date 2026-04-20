'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useIdleReset } from '@/hooks/use-idle-reset';
import { useKioskStore } from '@/store/kiosk-store';

const TIMEOUT_MS = 30_000;

export function IdleReset() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const reset = useKioskStore((s) => s.reset);

  // Only active on non-home pages
  const enabled = !(pathname === `/${locale}` || pathname === `/`);

  useIdleReset({
    timeoutMs: TIMEOUT_MS,
    enabled,
    onIdle: () => {
      reset();
      router.push(`/${locale}`);
    },
  });

  return null;
}
