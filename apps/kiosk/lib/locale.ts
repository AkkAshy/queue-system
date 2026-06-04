import type { KioskLocale } from '@queue/types';

/** BCP-47 tag for Intl APIs (date/time/number formatting). Karakalpak has no
 * CLDR data, so it falls back to a Latin-script locale; Uzbek uses uz-UZ. */
export function intlLocale(locale: KioskLocale): string {
  switch (locale) {
    case 'ru': return 'ru-RU';
    case 'uz': return 'uz-UZ';
    case 'en': return 'en-GB';
    default:   return 'en-GB'; // kaa → Latin fallback
  }
}
