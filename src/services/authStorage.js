/**
 * Sisselogimise ja seansihaldus:
 * - "Jäta mind meelde" valimata (vaikimisi): sessionStorage → brauseri akna/tabi sulgemisel logitakse välja.
 * - "Jäta mind meelde" valitud: localStorage → kasutaja jääb sisse logituks ka pärast brauseri sulgemist.
 * Vaikimisi on märkeruut valimata (ühiskasutatavate arvutite turvalisus, nt kooliklass).
 * Väljalogimine (clearAuth) kasutab ainult nupp "Logi välja"; uue faili loomine ei tühjenda salvestust.
 */

const KEY_LOGGED_IN = 'noodimeister-logged-in';
const KEY_GOOGLE_TOKEN = 'noodimeister-google-token';
const KEY_GOOGLE_EXPIRY = 'noodimeister-google-token-expiry';

function safeStorage(storage) {
  if (typeof window === 'undefined' || !storage) return null;
  try {
    return storage;
  } catch {
    return null;
  }
}

/** Tagastab salvestuse, kuhu sisselogimise andmed kirjutada (rememberMe = linnuke "Jäta mind meelde"). Vercel: ei viska kunagi. */
export function getStorageForLogin(rememberMe) {
  try {
    if (typeof window === 'undefined') return null;
    const storage = rememberMe ? safeStorage(window.localStorage) : safeStorage(window.sessionStorage);
    if (!storage) return null;
    return storage;
  } catch (e) {
    console.error('[authStorage] getStorageForLogin:', e?.message);
    return null;
  }
}

/** Tagastab salvestuse, kust praegu sisselogimist lugeda (sessionStorage eelneb, siis localStorage). Vercel: ei viska kunagi. */
export function getStorageForRead() {
  try {
    if (typeof window === 'undefined') return null;
    if (window.sessionStorage?.getItem(KEY_LOGGED_IN)) return window.sessionStorage;
    if (window.localStorage?.getItem(KEY_LOGGED_IN)) return window.localStorage;
  } catch (e) {
    console.error('[authStorage] getStorageForRead:', e?.message);
  }
  return null;
}

export function isLoggedIn() {
  try {
    const storage = getStorageForRead();
    if (!storage) return false;
    const raw = storage.getItem(KEY_LOGGED_IN);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.email);
  } catch (e) {
    console.error('[authStorage] isLoggedIn:', e?.message);
    return false;
  }
}

export function getLoggedInUser() {
  try {
    const storage = getStorageForRead();
    if (!storage) return null;
    const raw = storage.getItem(KEY_LOGGED_IN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[authStorage] getLoggedInUser:', e?.message);
    return null;
  }
}

/** Google token (Drive) – loetakse samast salvestusest kui sisselogimine. */
export function getStoredTokenFromAuth() {
  const storage = getStorageForRead();
  if (!storage) return null;
  const token = storage.getItem(KEY_GOOGLE_TOKEN);
  const expiry = storage.getItem(KEY_GOOGLE_EXPIRY);
  if (!token) return null;
  if (expiry && Date.now() > Number(expiry)) {
    clearAuth();
    return null;
  }
  return token;
}

/** Tühjenda sisselogimine ja token mõlemast salvestusest (väljalogimine). */
export function clearAuth() {
  if (typeof window === 'undefined') return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.removeItem(KEY_LOGGED_IN);
        s.removeItem(KEY_GOOGLE_TOKEN);
        s.removeItem(KEY_GOOGLE_EXPIRY);
      }
    });
  } catch (_) {}
}
