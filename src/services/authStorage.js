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
export const KEY_GOOGLE_SCOPES = 'noodimeister-google-scopes';
export const KEY_MICROSOFT_SCOPES = 'noodimeister-microsoft-scopes';
export const KEY_GOOGLE_SAVE_FOLDER = 'noodimeister-google-save-folder';
export const KEY_GOOGLE_SAVE_FOLDERS = 'noodimeister-google-save-folders';
export const KEY_ONEDRIVE_SAVE_FOLDER = 'noodimeister-onedrive-save-folder';
export const KEY_ONEDRIVE_SAVE_FOLDERS = 'noodimeister-onedrive-save-folders';
export const KEY_SHORTCUT_PREFS = 'noodimeister-shortcut-prefs';
export const KEY_USERS = 'noodimeister-users';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeProvider(provider) {
  const value = String(provider || 'local').trim().toLowerCase();
  return value === 'google' || value === 'microsoft' ? value : 'local';
}

/** Kasutaja e-posti põhine võti (iga kasutaja oma kaustade nimekiri – turvalisus). */
function getGoogleSaveFoldersStorageKey(email) {
  if (!email || typeof email !== 'string') return null;
  return `noodimeister-google-save-folders-${encodeURIComponent(email)}`;
}
function getOneDriveSaveFoldersStorageKey(email) {
  if (!email || typeof email !== 'string') return null;
  return `noodimeister-onedrive-save-folders-${encodeURIComponent(email)}`;
}

/** Kiirklahvide seaded – kasutajapõhine (e-posti järgi). */
function getShortcutPrefsStorageKey(email) {
  if (!email || typeof email !== 'string') return null;
  return `noodimeister-shortcut-prefs-${encodeURIComponent(email)}`;
}

/** Praegu sisselogitud kasutaja e-post (või null). */
export function getCurrentUserEmail() {
  const user = getLoggedInUser();
  return user?.email ?? null;
}

/**
 * Tagastab praeguse kasutaja kiirklahvide seaded (localStorage).
 * Vorm:
 * {
 *   "toolbox.rhythm": { code: "Digit1", shift: true, alt: false, mod: false },
 *   ...
 * }
 */
export function getShortcutPrefs() {
  const email = getCurrentUserEmail();
  if (typeof window === 'undefined') return {};
  if (!email) return {};
  try {
    const key = getShortcutPrefsStorageKey(email);
    const raw = key ? window.localStorage?.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    const legacyRaw = window.localStorage?.getItem(KEY_SHORTCUT_PREFS) || window.sessionStorage?.getItem(KEY_SHORTCUT_PREFS);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (legacyParsed && typeof legacyParsed === 'object') {
        setShortcutPrefsForCurrentUser(legacyParsed);
        return legacyParsed;
      }
    }
  } catch (_) {}
  return {};
}

export function setShortcutPrefsForCurrentUser(prefs) {
  const email = getCurrentUserEmail();
  if (typeof window === 'undefined') return;
  if (!email) return;
  try {
    const key = getShortcutPrefsStorageKey(email);
    const value = (prefs && typeof prefs === 'object') ? prefs : {};
    if (key) window.localStorage?.setItem(key, JSON.stringify(value));
    // Legacy copy (non-breaking fallback)
    window.localStorage?.setItem(KEY_SHORTCUT_PREFS, JSON.stringify(value));
  } catch (_) {}
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

export function getStoredUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(KEY_USERS);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      ...entry,
      email: normalizeEmail(entry?.email),
      provider: normalizeProvider(entry?.provider),
      authMethods: Array.isArray(entry?.authMethods)
        ? entry.authMethods.map(normalizeProvider).filter(Boolean)
        : [normalizeProvider(entry?.provider)],
    }));
  } catch (_) {
    return [];
  }
}

function writeStoredUsers(users) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(KEY_USERS, JSON.stringify(Array.isArray(users) ? users : []));
  } catch (_) {}
}

export function upsertUserAccount(user, options = {}) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;
  const provider = normalizeProvider(options.provider || user?.provider || 'local');
  const users = getStoredUsers();
  const index = users.findIndex((entry) => normalizeEmail(entry?.email) === email && normalizeProvider(entry?.provider) === provider);
  const existing = index >= 0 ? users[index] : null;
  const authMethods = Array.isArray(existing?.authMethods) ? [...existing.authMethods] : [];
  if (!authMethods.includes(provider)) authMethods.push(provider);

  const merged = {
    ...existing,
    ...user,
    email,
    name: String(user?.name || existing?.name || email.split('@')[0] || '').trim(),
    provider,
    authMethods,
    password: user?.password ?? existing?.password,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) users[index] = merged;
  else users.push(merged);
  writeStoredUsers(users);
  return merged;
}

export function setLoggedInUser(user, rememberMe = false) {
  const storage = getStorageForLogin(rememberMe);
  if (!storage) return null;
  const provider = normalizeProvider(user?.provider);
  const merged = upsertUserAccount(user, { provider });
  if (!merged?.email) return null;
  const sessionUser = {
    email: merged.email,
    name: merged.name,
    provider,
    authMethods: Array.isArray(merged.authMethods) ? merged.authMethods : [],
  };
  try {
    storage.setItem(KEY_LOGGED_IN, JSON.stringify(sessionUser));
  } catch (_) {
    return null;
  }
  return sessionUser;
}

export function clearGoogleAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.removeItem(KEY_GOOGLE_TOKEN);
        s.removeItem(KEY_GOOGLE_EXPIRY);
        s.removeItem(KEY_GOOGLE_SCOPES);
      }
    });
  } catch (_) {}
}

export function clearMicrosoftAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) {
        s.removeItem(KEY_MICROSOFT_TOKEN);
        s.removeItem(KEY_MICROSOFT_EXPIRY);
        s.removeItem(KEY_MICROSOFT_SCOPES);
      }
    });
    clearMsalCache();
  } catch (_) {}
}

/** Google token (Drive) – loetakse samast salvestusest kui sisselogimine. */
export function getStoredTokenFromAuth() {
  const storage = getStorageForRead();
  if (!storage) return null;
  if (getLoggedInUser()?.provider !== 'google') return null;
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
  if (getLoggedInUser()?.provider !== 'microsoft') return null;
  const token = storage.getItem(KEY_MICROSOFT_TOKEN);
  const expiry = storage.getItem(KEY_MICROSOFT_EXPIRY);
  if (!token) return null;
  if (expiry && Date.now() > Number(expiry)) {
    clearAuth();
    return null;
  }
  return token;
}

function normalizeScopeList(input) {
  if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(/\s+/).map((v) => v.trim()).filter(Boolean);
  return [];
}

export function setGoogleGrantedScopes(scopes) {
  if (typeof window === 'undefined') return;
  const list = normalizeScopeList(scopes);
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_GOOGLE_SCOPES, JSON.stringify(list));
    });
  } catch (_) {}
}

export function setMicrosoftGrantedScopes(scopes) {
  if (typeof window === 'undefined') return;
  const list = normalizeScopeList(scopes);
  try {
    [window.sessionStorage, window.localStorage].forEach((s) => {
      if (s) s.setItem(KEY_MICROSOFT_SCOPES, JSON.stringify(list));
    });
  } catch (_) {}
}

function getGrantedScopesByKey(key) {
  const storage = getStorageForRead();
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.map((v) => String(v || '').trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

export function getGoogleGrantedScopes() {
  return getGrantedScopesByKey(KEY_GOOGLE_SCOPES);
}

export function getMicrosoftGrantedScopes() {
  return getGrantedScopesByKey(KEY_MICROSOFT_SCOPES);
}

export function hasGoogleReadPermission() {
  const token = getStoredTokenFromAuth();
  if (!token) return false;
  const scopes = getGoogleGrantedScopes();
  if (scopes.length === 0) return true;
  return scopes.includes('https://www.googleapis.com/auth/drive.readonly')
    || scopes.includes('https://www.googleapis.com/auth/drive')
    || scopes.includes('https://www.googleapis.com/auth/drive.file');
}

export function hasMicrosoftReadPermission() {
  const token = getStoredMicrosoftTokenFromAuth();
  if (!token) return false;
  const scopes = getMicrosoftGrantedScopes();
  if (scopes.length === 0) return true;
  return scopes.includes('Files.Read')
    || scopes.includes('Files.ReadWrite')
    || scopes.includes('Files.ReadWrite.All')
    || scopes.includes('Files.ReadWrite.AppFolder');
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

/** Määra praeguse kasutaja Google Drive kaustade nimekiri (nt pilvest sünkroonimisel). */
export function setGoogleSaveFoldersForCurrentUser(list) {
  const email = getCurrentUserEmail();
  if (!email) return;
  const arr = Array.isArray(list) ? list : [];
  setGoogleSaveFoldersForUser(email, arr);
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

/** Määra praeguse kasutaja OneDrive kaustade nimekiri (nt pilvest sünkroonimisel). */
export function setOneDriveSaveFoldersForCurrentUser(list) {
  const email = getCurrentUserEmail();
  if (!email) return;
  const arr = Array.isArray(list) ? list : [];
  setOneDriveSaveFoldersForUser(email, arr);
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

/**
 * MSAL hoiab sessionStorage'is nt interaction oleku; katkenud redirect võib jätta
 * "interaction_in_progress" ja loginRedirect ei suuna Microsofti lehele (ilma selge veata).
 */
export function clearMsalSessionStorageKeys() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const keys = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('msal.')) keys.push(key);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
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
        s.removeItem(KEY_GOOGLE_SCOPES);
        s.removeItem(KEY_MICROSOFT_TOKEN);
        s.removeItem(KEY_MICROSOFT_EXPIRY);
        s.removeItem(KEY_MICROSOFT_SCOPES);
      }
    });
    clearMsalCache();
  } catch (_) {}
}
