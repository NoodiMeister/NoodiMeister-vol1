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
export const KEY_GOOGLE_SAVE_FOLDERS = 'noodimeister-google-save-folders';
export const KEY_ONEDRIVE_SAVE_FOLDER = 'noodimeister-onedrive-save-folder';
export const KEY_ONEDRIVE_SAVE_FOLDERS = 'noodimeister-onedrive-save-folders';

/** Kasutaja e-posti põhine võti (iga kasutaja oma kaustade nimekiri – turvalisus). */
function getGoogleSaveFoldersStorageKey(email) {
  if (!email || typeof email !== 'string') return null;
  return `noodimeister-google-save-folders-${encodeURIComponent(email)}`;
}
function getOneDriveSaveFoldersStorageKey(email) {
  if (!email || typeof email !== 'string') return null;
  return `noodimeister-onedrive-save-folders-${encodeURIComponent(email)}`;
}

/** Praegu sisselogitud kasutaja e-post (või null). */
export function getCurrentUserEmail() {
  const user = getLoggedInUser();
  return user?.email ?? null;
}

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

/** Loeb legacy kausta ID kas localStorage või sessionStorage'ist (kumbki, kus väärtus on). */
function getLegacyGoogleFolderIdFromAnyStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const fromLocal = window.localStorage?.getItem(KEY_GOOGLE_SAVE_FOLDER);
    if (fromLocal) return fromLocal;
    const fromSession = window.sessionStorage?.getItem(KEY_GOOGLE_SAVE_FOLDER);
    if (fromSession) return fromSession;
  } catch (_) {}
  return null;
}

/** Google Drive salvestuskaustade nimekiri (id + name) praeguse kasutaja jaoks. Igale kasutajale oma nimekiri (turvalisus). */
export function getGoogleSaveFolders() {
  const email = getCurrentUserEmail();
  if (typeof window === 'undefined') return [];
  if (!email) return [];
  try {
    const userKey = getGoogleSaveFoldersStorageKey(email);
    const raw = window.localStorage?.getItem(userKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    const legacyRaw = window.localStorage?.getItem(KEY_GOOGLE_SAVE_FOLDERS) || window.sessionStorage?.getItem(KEY_GOOGLE_SAVE_FOLDERS);
    if (legacyRaw) {
      const list = JSON.parse(legacyRaw);
      if (Array.isArray(list) && list.length > 0) {
        setGoogleSaveFoldersForUser(email, list);
        return list;
      }
    }
    const legacyId = window.localStorage?.getItem(KEY_GOOGLE_SAVE_FOLDER) || getLegacyGoogleFolderIdFromAnyStorage();
    if (legacyId) {
      setGoogleSaveFolderId(legacyId, '');
      return [{ id: legacyId, name: '' }];
    }
  } catch (_) {}
  return [];
}

function setGoogleSaveFoldersForUser(email, list) {
  if (!email || !Array.isArray(list) || typeof window === 'undefined') return;
  const key = getGoogleSaveFoldersStorageKey(email);
  if (key) window.localStorage?.setItem(key, JSON.stringify(list));
}

/** Google Drive vaikimisi salvestuskausta ID (esimene nimekirjas). */
export function getGoogleSaveFolderId() {
  const folders = getGoogleSaveFolders();
  return folders[0]?.id ?? null;
}

export function setGoogleSaveFolderId(folderId, name = '') {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const list = [{ id: folderId, name: name || '' }];
  try {
    if (email) {
      const key = getGoogleSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_GOOGLE_SAVE_FOLDER, folderId);
        s.setItem(KEY_GOOGLE_SAVE_FOLDERS, JSON.stringify(list));
      }
    });
  } catch (_) {}
}

/** Lisa Google Drive salvestuskaust nimekirja (uued failid salvestatakse esimesse). Kasutajati. */
export function addGoogleSaveFolder(folderId, name = '') {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const existing = getGoogleSaveFolders();
  const filtered = existing.filter((f) => f.id !== folderId);
  const list = [{ id: folderId, name: name || '' }, ...filtered];
  try {
    if (email) {
      const key = getGoogleSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_GOOGLE_SAVE_FOLDER, list[0].id);
        s.setItem(KEY_GOOGLE_SAVE_FOLDERS, JSON.stringify(list));
      }
    });
  } catch (_) {}
}

/** Uuenda Google Drive kausta nime nimekirjas. */
export function updateGoogleSaveFolderName(folderId, newName) {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const list = getGoogleSaveFolders().map((f) =>
    f.id === folderId ? { ...f, name: newName || f.name } : f
  );
  try {
    if (email) {
      const key = getGoogleSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_GOOGLE_SAVE_FOLDERS, JSON.stringify(list));
    });
  } catch (_) {}
}

/** Eemalda Google Drive kaust nimekirjast (ei kustuta pilvest). */
export function removeGoogleSaveFolder(folderId) {
  if (typeof window === 'undefined') return;
  const email = getCurrentUserEmail();
  const list = getGoogleSaveFolders().filter((f) => f.id !== folderId);
  try {
    if (email) {
      const key = getGoogleSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_GOOGLE_SAVE_FOLDERS, JSON.stringify(list));
        if (list.length > 0) s.setItem(KEY_GOOGLE_SAVE_FOLDER, list[0].id);
        else s.removeItem(KEY_GOOGLE_SAVE_FOLDER);
      }
    });
  } catch (_) {}
}

export function clearGoogleSaveFolder() {
  if (typeof window === 'undefined') return;
  const email = getCurrentUserEmail();
  try {
    if (email) {
      const key = getGoogleSaveFoldersStorageKey(email);
      if (key) window.localStorage?.removeItem(key);
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.removeItem(KEY_GOOGLE_SAVE_FOLDER);
        s.removeItem(KEY_GOOGLE_SAVE_FOLDERS);
      }
    });
  } catch (_) {}
}

function getLegacyOneDriveFolderIdFromAnyStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const fromLocal = window.localStorage?.getItem(KEY_ONEDRIVE_SAVE_FOLDER);
    if (fromLocal) return fromLocal;
    const fromSession = window.sessionStorage?.getItem(KEY_ONEDRIVE_SAVE_FOLDER);
    if (fromSession) return fromSession;
  } catch (_) {}
  return null;
}

/** OneDrive salvestuskaustade nimekiri (id + name) praeguse kasutaja jaoks. Igale kasutajale oma nimekiri (turvalisus). */
export function getOneDriveSaveFolders() {
  const email = getCurrentUserEmail();
  if (typeof window === 'undefined') return [];
  if (!email) return [];
  try {
    const userKey = getOneDriveSaveFoldersStorageKey(email);
    const raw = window.localStorage?.getItem(userKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    const legacyRaw = window.localStorage?.getItem(KEY_ONEDRIVE_SAVE_FOLDERS) || window.sessionStorage?.getItem(KEY_ONEDRIVE_SAVE_FOLDERS);
    if (legacyRaw) {
      const list = JSON.parse(legacyRaw);
      if (Array.isArray(list) && list.length > 0) {
        setOneDriveSaveFoldersForUser(email, list);
        return list;
      }
    }
    const legacyId = window.localStorage?.getItem(KEY_ONEDRIVE_SAVE_FOLDER) || getLegacyOneDriveFolderIdFromAnyStorage();
    if (legacyId) {
      setOneDriveSaveFolderId(legacyId, '');
      return [{ id: legacyId, name: '' }];
    }
  } catch (_) {}
  return [];
}

function setOneDriveSaveFoldersForUser(email, list) {
  if (!email || !Array.isArray(list) || typeof window === 'undefined') return;
  const key = getOneDriveSaveFoldersStorageKey(email);
  if (key) window.localStorage?.setItem(key, JSON.stringify(list));
}

/** OneDrive vaikimisi salvestuskausta ID (esimene nimekirjas). */
export function getOneDriveSaveFolderId() {
  const folders = getOneDriveSaveFolders();
  return folders[0]?.id ?? null;
}

export function setOneDriveSaveFolderId(folderId, name = '') {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const list = [{ id: folderId, name: name || '' }];
  try {
    if (email) {
      const key = getOneDriveSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_ONEDRIVE_SAVE_FOLDER, folderId);
        s.setItem(KEY_ONEDRIVE_SAVE_FOLDERS, JSON.stringify(list));
      }
    });
  } catch (_) {}
}

/** Lisa OneDrive salvestuskaust nimekirja. Kasutajati. */
export function addOneDriveSaveFolder(folderId, name = '') {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const existing = getOneDriveSaveFolders();
  const filtered = existing.filter((f) => f.id !== folderId);
  const list = [{ id: folderId, name: name || '' }, ...filtered];
  try {
    if (email) {
      const key = getOneDriveSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_ONEDRIVE_SAVE_FOLDER, list[0].id);
        s.setItem(KEY_ONEDRIVE_SAVE_FOLDERS, JSON.stringify(list));
      }
    });
  } catch (_) {}
}

/** Uuenda OneDrive kausta nime nimekirjas. */
export function updateOneDriveSaveFolderName(folderId, newName) {
  if (typeof window === 'undefined' || !folderId) return;
  const email = getCurrentUserEmail();
  const list = getOneDriveSaveFolders().map((f) =>
    f.id === folderId ? { ...f, name: newName || f.name } : f
  );
  try {
    if (email) {
      const key = getOneDriveSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_ONEDRIVE_SAVE_FOLDERS, JSON.stringify(list));
    });
  } catch (_) {}
}

/** Eemalda OneDrive kaust nimekirjast. */
export function removeOneDriveSaveFolder(folderId) {
  if (typeof window === 'undefined') return;
  const email = getCurrentUserEmail();
  const list = getOneDriveSaveFolders().filter((f) => f.id !== folderId);
  try {
    if (email) {
      const key = getOneDriveSaveFoldersStorageKey(email);
      if (key) window.localStorage?.setItem(key, JSON.stringify(list));
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.setItem(KEY_ONEDRIVE_SAVE_FOLDERS, JSON.stringify(list));
        if (list.length > 0) s.setItem(KEY_ONEDRIVE_SAVE_FOLDER, list[0].id);
        else s.removeItem(KEY_ONEDRIVE_SAVE_FOLDER);
      }
    });
  } catch (_) {}
}

export function clearOneDriveSaveFolder() {
  if (typeof window === 'undefined') return;
  const email = getCurrentUserEmail();
  try {
    if (email) {
      const key = getOneDriveSaveFoldersStorageKey(email);
      if (key) window.localStorage?.removeItem(key);
    }
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.removeItem(KEY_ONEDRIVE_SAVE_FOLDER);
        s.removeItem(KEY_ONEDRIVE_SAVE_FOLDERS);
      }
    });
  } catch (_) {}
}

/** Clear MSAL (Microsoft) cache from localStorage so the next Microsoft sign-in shows the login screen. */
function clearMsalCache() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('msal.')) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch (_) {}
}

/** Tühjenda sisselogimine ja token (väljalogimine). Kaustade nimekirjad on kasutajati (e-posti järgi); teise kasutaja sisselogimisel kuvatakse ainult tema kaustad. */
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
      }
    });
    clearMsalCache();
  } catch (_) {}
}
