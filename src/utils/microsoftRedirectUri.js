/**
 * Microsoft MSAL redirect URI — üks väärtus kogu rakenduses
 * (CloudLogin, MicrosoftRedirectHandler, cloudTokenRefresh).
 * Kui need erinevad, tekib localStorage’is kaks erinevat MSAL konfiguratsiooni ja
 * handleRedirectPromise / vaikne token võivad ebaõnnestuda (nt pärast teist lehte).
 *
 * Kasutame alati Vite BASE_URL juurt (tavaliselt `/`), mitte konkreetset marsruuti
 * nagu `/tood` — Azure redirect peab olema SPA jaoks täpselt see URL.
 */
export function getMicrosoftRedirectUri() {
  if (typeof window === 'undefined') return '';
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return window.location.origin + path;
  } catch {
    return `${window.location.origin}/`;
  }
}
