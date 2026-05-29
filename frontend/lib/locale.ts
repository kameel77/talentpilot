export type Locale = 'pl' | 'en';

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'pl';
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return (match?.[1] as Locale) ?? 'pl';
}

export function setLocale(lang: Locale): void {
  document.cookie = `locale=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}
