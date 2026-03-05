/**
 * Sisselogimise salvestus: vaikimisi sessionStorage (tabi sulgemisel väljalogimine),
 * kui kasutaja valib "Jää sisse logituks" → localStorage.
 * Koolide stsenaarium: ühise arvuti puhul jäetakse linnuke vaikimisi välja.
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

/** Tagastab salvestuse, kuhu sisselogimise andmed kirjutada (rememberMe = linnuke "Jää sisse logituks"). */
export function getStorageForLogin(rememberMe) {
  if (typeof window === 'undefined') {
    console.error('[authStorage] getStorageForLogin: window on undefined');
    return null;
  }
  const storage = rememberMe ? safeStorage(window.localStorage) : safeStorage(window.sessionStorage);
  if (!storage) {
    console.error('[authStorage] getStorageForLogin: storage puudub', { rememberMe, hasLocalStorage: !!window.localStorage, hasSessionStorage: !!window.sessionStorage });
  }
  return storage;
}

/** Tagastab salvestuse, kust praegu sisselogimist lugeda (sessionStorage eelneb, siis localStorage). */
export function getStorageForRead() {
  if (typeof window === 'undefined') {
    console.error('[authStorage] getStorageForRead: window on undefined');
    return null;
  }
  try {
    if (window.sessionStorage?.getItem(KEY_LOGGED_IN)) return window.sessionStorage;
    if (window.localStorage?.getItem(KEY_LOGGED_IN)) return window.localStorage;
  } catch (e) {
    console.error('[authStorage] getStorageForRead viga:', e?.message, { sessionStorage: typeof window?.sessionStorage, localStorage: typeof window?.localStorage });
  }
  return null;
}

export function isLoggedIn() {
  const storage = getStorageForRead();
  if (!storage) return false;
  try {
    const raw = storage.getItem(KEY_LOGGED_IN);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) {
      console.error('[authStorage] isLoggedIn: parsed.email puudub', { hasParsed: !!parsed, keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [] });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[authStorage] isLoggedIn: lugemis-/parse viga', e?.message);
    return false;
  }
}

export function getLoggedInUser() {
  const storage = getStorageForRead();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_LOGGED_IN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[authStorage] getLoggedInUser: parse viga', e?.message);
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
