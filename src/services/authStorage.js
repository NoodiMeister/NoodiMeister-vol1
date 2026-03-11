/**
 * Sisselogimise ja seansihaldus – püsivus localStorage'is.
 * Kasutame localStorage'it, et kasutajat ei logitaks välja lehe värskendamisel ega rakenduse kokkujooksmisel.
 * Väljalogimine (clearAuth) tühjendab salvestuse ainult nupu "Logi välja" kaudu.
 */

export const KEY_LOGGED_IN = 'noodimeister-logged-in';
export const KEY_GOOGLE_TOKEN = 'noodimeister-google-token';
export const KEY_GOOGLE_EXPIRY = 'noodimeister-google-token-expiry';
export const KEY_MICROSOFT_TOKEN = 'noodimeister-microsoft-token';
export const KEY_MICROSOFT_EXPIRY = 'noodimeister-microsoft-token-expiry';
export const KEY_GOOGLE_SAVE_FOLDER = 'noodimeister-google-save-folder';
export const KEY_ONEDRIVE_SAVE_FOLDER = 'noodimeister-onedrive-save-folder';

function safeStorage(storage) {
  if (typeof window === 'undefined' || !storage) return null;
  try {
    return storage;
  } catch {
    return null;
  }
}

/** Tagastab salvestuse, kuhu sisselogimise andmed kirjutada. Kasutame localStorage'it, et sessioon püsiks värskenduse ja vea korral. */
export function getStorageForLogin(rememberMe) {
  try {
    if (typeof window === 'undefined') return null;
    const storage = safeStorage(window.localStorage);
    if (!storage) return null;
    return storage;
  } catch (e) {
    console.error('[authStorage] getStorageForLogin:', e?.message);
    return null;
  }
}

/** Tagastab salvestuse, kust sisselogimist lugeda. Eelistame localStorage'it, et kasutaja jääks sisse logituks pärast lehe värskendamist või viga. */
export function getStorageForRead() {
  try {
    if (typeof window === 'undefined') return null;
    if (window.localStorage?.getItem(KEY_LOGGED_IN)) return window.localStorage;
    if (window.sessionStorage?.getItem(KEY_LOGGED_IN)) return window.sessionStorage;
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

/** Microsoft token (Graph/OneDrive) – loetakse samast salvestusest kui sisselogimine. */
export function getStoredMicrosoftTokenFromAuth() {
  const storage = getStorageForRead();
  if (!storage) return null;
  const token = storage.getItem(KEY_MICROSOFT_TOKEN);
  const expiry = storage.getItem(KEY_MICROSOFT_EXPIRY);
  if (!token) return null;
  if (expiry && Date.now() > Number(expiry)) {
    clearAuth();
    return null;
  }
  return token;
}

/** Google Drive salvestuskausta ID (kui kasutaja on valinud). */
export function getGoogleSaveFolderId() {
  const storage = getStorageForRead();
  if (!storage) return null;
  return storage.getItem(KEY_GOOGLE_SAVE_FOLDER) || null;
}

export function setGoogleSaveFolderId(folderId) {
  if (typeof window === 'undefined' || !folderId) return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_GOOGLE_SAVE_FOLDER, folderId);
    });
  } catch (_) {}
}

export function clearGoogleSaveFolder() {
  if (typeof window === 'undefined') return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.removeItem(KEY_GOOGLE_SAVE_FOLDER);
    });
  } catch (_) {}
}

/** OneDrive salvestuskausta ID (kui kasutaja on valinud). */
export function getOneDriveSaveFolderId() {
  const storage = getStorageForRead();
  if (!storage) return null;
  return storage.getItem(KEY_ONEDRIVE_SAVE_FOLDER) || null;
}

export function setOneDriveSaveFolderId(folderId) {
  if (typeof window === 'undefined' || !folderId) return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_ONEDRIVE_SAVE_FOLDER, folderId);
    });
  } catch (_) {}
}

export function clearOneDriveSaveFolder() {
  if (typeof window === 'undefined') return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.removeItem(KEY_ONEDRIVE_SAVE_FOLDER);
    });
  } catch (_) {}
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
        s.removeItem(KEY_MICROSOFT_TOKEN);
        s.removeItem(KEY_MICROSOFT_EXPIRY);
        s.removeItem(KEY_GOOGLE_SAVE_FOLDER);
        s.removeItem(KEY_ONEDRIVE_SAVE_FOLDER);
      }
    });
  } catch (_) {}
}
