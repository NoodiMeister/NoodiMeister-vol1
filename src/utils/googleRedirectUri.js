/**
 * Google OAuth implicit flow redirect URI — üks kanooniline URL iga deploy päritolu kohta.
 * Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs peab sisaldama
 * täpselt seda stringi (nt https://www.noodimeister.ee/login), mitte ainult domeeni.
 *
 * Eelnevalt kasutasime `pathname` + `search` — iga teine tee või query põhjustas
 * Error 400: redirect_uri_mismatch, kui konsooli oli lisatud vaid üks “päritolu” rida.
 */
export function getGoogleRedirectUri() {
  if (typeof window === 'undefined') return '';
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    const baseTrimmed = base.replace(/\/$/, '') || '';
    const path = `${baseTrimmed}/login`;
    return window.location.origin + path;
  } catch {
    return `${window.location.origin}/login`;
  }
}
