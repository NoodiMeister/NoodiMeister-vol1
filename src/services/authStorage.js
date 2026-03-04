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
  if (typeof window === 'undefined') return null;
  return rememberMe ? safeStorage(window.localStorage) : safeStorage(window.sessionStorage);
}

/** Tagastab salvestuse, kust praegu sisselogimist lugeda (sessionStorage eelneb, siis localStorage). */
export function getStorageForRead() {
  if (typeof window === 'undefined') return null;
  try {
    if (window.sessionStorage?.getItem(KEY_LOGGED_IN)) return window.sessionStorage;
    if (window.localStorage?.getItem(KEY_LOGGED_IN)) return window.localStorage;
  } catch (_) {}
  return null;
}

export function isLoggedIn() {
  const storage = getStorageForRead();
  if (!storage) return false;
  try {
    const raw = storage.getItem(KEY_LOGGED_IN);
    return !!raw && !!JSON.parse(raw)?.email;
  } catch {
    return false;
  }
}

export function getLoggedInUser() {
  const storage = getStorageForRead();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_LOGGED_IN);
    return raw ? JSON.parse(raw) : null;
  } catch {
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
