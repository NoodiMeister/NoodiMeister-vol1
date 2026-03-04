/**
 * Ühtne veaformaadistus sisselogimise/registreerimise puhul (suvaline brauser või teenus).
 * Tagastab struktureeritud payloadi ja Cursorisse kopeeritava teksti.
 */

/**
 * Vorminda viga ühtseks objektiks (kood + kirjeldus). Toetab Error, Google OAuth, fetch body jms.
 * @param {string} source - Allika nimi (nt "Google OAuth", "Google userinfo", "e-mail/parool", "brauser")
 * @param {*} err - Viga (Error, objektil { error, error_description, message, code, type, status })
 * @returns {{ source: string, code: string|number|null, description: string|null, fullMessage: string }}
 */
export function formatAuthError(source, err) {
  const fullMessage = (() => {
    if (err == null) return `${source}: tundmatu viga`;
    if (typeof err === 'string') return `${source}: ${err}`;
    if (err instanceof Error) {
      const code = err.code ?? err.status;
      const desc = err.message;
      const parts = [source];
      if (code) parts.push(`kood: ${String(code)}`);
      if (desc) parts.push(desc);
      return parts.join(' · ');
    }
    if (typeof err === 'object') {
      const code = err.error ?? err.code ?? err.type ?? err.status;
      const desc = err.error_description ?? err.message ?? err.description;
      const parts = [source];
      if (code) parts.push(`kood: ${typeof code === 'object' ? JSON.stringify(code) : String(code)}`);
      if (desc) parts.push(String(desc));
      return parts.join(' · ');
    }
    return `${source}: tundmatu viga`;
  })();

  let code = null;
  let description = null;
  if (err != null && typeof err === 'object' && !(err instanceof Error)) {
    code = err.error ?? err.code ?? err.type ?? err.status ?? null;
    if (typeof code === 'object') code = JSON.stringify(code);
    description = err.error_description ?? err.message ?? err.description ?? null;
  } else if (err instanceof Error) {
    code = err.code ?? err.status ?? null;
    description = err.message || null;
  }

  return { source, code, description, fullMessage };
}

const CURSOR_HINT = '\n---\nSaada see plokk Cursorisse (kleebi vestlusesse), et AI saaks viga kiiremini näha ja parandada.';

/**
 * Genereeri lõik, mida kasutaja saab kopeerida ja Cursorisse kleepida.
 * @param {{ source: string, code?: string|number|null, description?: string|null, fullMessage: string }} payload
 * @returns {string}
 */
export function getCopyableErrorText(payload) {
  if (!payload || !payload.fullMessage) return payload ? String(payload.fullMessage) : 'Viga (puuduv andmed)';
  const lines = [
    '[NoodiMeister] Sisselogimise / registreerimise viga',
    `Allikas: ${payload.source || '—'}`,
    ...(payload.code != null && payload.code !== '' ? [`Kood: ${payload.code}`] : []),
    ...(payload.description ? [`Kirjeldus: ${payload.description}`] : []),
    `Tekst: ${payload.fullMessage}`
  ];
  return lines.join('\n') + CURSOR_HINT;
}

/**
 * Arendusrežiimis saadab auth-vea dev-serverile, mis salvestab selle logs/last-auth-error.json.
 * Administraator / Cursor saab viga sealt lugeda ilma kopeerimata.
 * @param {{ source: string, code?: string|number|null, description?: string|null, fullMessage: string }} payload
 */
export function reportAuthErrorToDev(payload) {
  if (!payload?.fullMessage) return;
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  const record = {
    source: payload.source,
    code: payload.code,
    description: payload.description,
    fullMessage: payload.fullMessage,
    copyableText: getCopyableErrorText(payload),
  };
  fetch('/__dev-report-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch(() => {});
}
