/**
 * Google Drive salvestus ja laadimine.
 * Nõuab kasutajalt sisselogimist Google'iga ja Drive'i luba (OAuth scope).
 */

const SCRIPT_URL = 'https://apis.google.com/js/api.js';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';

// Google Picker typically expects an API key (developer key). If missing or blocked, we fall back
// to a simple list+prompt chooser so "Load from cloud" still works.
const GOOGLE_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_API_KEY) || '';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.gapi && window.google?.picker) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      const check = () => (window.google?.picker ? resolve() : setTimeout(check, 50));
      check();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.gapi?.load) {
        window.gapi.load('picker', () => resolve());
      } else {
        resolve();
      }
    };
    script.onerror = () => reject(new Error('Google API script failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * Kasutaja valib kausta (Picker). Tagastab kausta ID või null.
 * @param {string} accessToken
 * @returns {Promise<string|null>}
 */
export function pickFolder(accessToken) {
  return loadScript().then(() => {
    return new Promise((resolve) => {
      if (!window.google?.picker) {
        resolve(null);
        return;
      }
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder')
        .setParent('root');
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      // Safety: if callback never fires (script blocked / popup weirdness), don't hang forever.
      const timeout = setTimeout(() => finish(null), 45000);
      const picker = new google.picker.PickerBuilder()
        .setDeveloperKey(GOOGLE_API_KEY || undefined)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data) => {
          clearTimeout(timeout);
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            finish(data.docs[0].id);
          } else {
            finish(null);
          }
        })
        .build();
      picker.setVisible(true);
    });
  });
}

/**
 * Loo uus kaust Google Drivesse (juurkaustas või etteantud kausta sisse).
 * @param {string} accessToken
 * @param {string} parentId - kausta ID või 'root'
 * @param {string} folderName
 * @returns {Promise<string>} uue kausta ID
 */
export async function createFolder(accessToken, parentId, folderName) {
  const res = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId === 'root' || !parentId ? 'root' : parentId]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Token aegunud. Logi uuesti sisse.' : (err || 'Kausta loomine ebaõnnestus'));
  }
  const data = await res.json();
  return data.id;
}

/**
 * Loo fail antud kaustas.
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} fileName
 * @param {string} content JSON string
 * @returns {Promise<string>} fileId
 */
/** MIME-tüüp, et Drive'is tuvastataks fail NoodiMeisteri projektina (võimaldab "Ava koos"-seost). */
export const NOODIMEISTER_MIME_TYPE = 'application/vnd.noodimeister+json';

export async function createFileInFolder(accessToken, folderId, fileName, content) {
  const boundary = '-------noodimeister-------';
  const meta = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: NOODIMEISTER_MIME_TYPE
  });
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n`,
    `--${boundary}--`
  ].join('');
  const res = await fetch(DRIVE_UPLOAD_URL + '?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Token aegunud. Logi uuesti sisse.' : (err || 'Salvestamine ebaõnnestus'));
  }
  const data = await res.json();
  return data.id;
}

/**
 * Laadi binaarfail (nt video) antud kaustas.
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} fileName
 * @param {Blob} blob
 * @param {string} mimeType nt 'video/webm', 'video/mp4'
 * @returns {Promise<string>} fileId
 */
export async function uploadBinaryFileInFolder(accessToken, folderId, fileName, blob, mimeType) {
  const boundary = '-------noodimeister-bin-------';
  const meta = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: mimeType || 'application/octet-stream'
  });
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`;
  const arrayBuffer = await blob.arrayBuffer();
  const body = new Blob([
    metaPart,
    `\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
    arrayBuffer,
    `\r\n--${boundary}--`
  ]);
  const res = await fetch(DRIVE_UPLOAD_URL + '?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Token aegunud. Logi uuesti sisse.' : (err || 'Salvestamine ebaõnnestus'));
  }
  const data = await res.json();
  return data.id;
}

/**
 * Kasutaja valib faili (Picker). Tagastab faili ID või null.
 * @param {string} accessToken
 * @returns {Promise<string|null>}
 */
export function pickFile(accessToken) {
  return loadScript().then(() => {
    return new Promise((resolve) => {
      const fallbackPrompt = async () => {
        try {
          const [owned, shared] = await Promise.all([
            listNoodimeisterFiles(accessToken, { pageSize: 50 }).catch(() => []),
            listNoodimeisterFilesSharedWithMe(accessToken).catch(() => []),
          ]);
          const files = [...(owned || []), ...(shared || [])].filter(Boolean);
          if (!files.length) return resolve(null);
          const maxShow = 30;
          const shown = files.slice(0, maxShow);
          const answer = window.prompt(
            `Vali Google Drive fail (1-${shown.length})` +
            (files.length > shown.length ? ` (näitan esimesed ${shown.length}/${files.length})` : '') +
            ':\n\n' +
            shown.map((f, i) => `${i + 1}. ${f.name}`).join('\n') +
            '\n\nSisesta number ja vajuta OK (Cancel = katkesta).'
          );
          if (!answer) return resolve(null);
          const idx = Number(answer);
          if (!Number.isFinite(idx) || idx < 1 || idx > shown.length) return resolve(null);
          const picked = shown[idx - 1];
          return resolve(picked?.id || null);
        } catch {
          return resolve(null);
        }
      };

      // If Picker isn't available or API key isn't configured, use the fallback chooser.
      if (!window.google?.picker || !GOOGLE_API_KEY) {
        fallbackPrompt();
        return;
      }

      const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const timeout = setTimeout(() => finish(null), 45000);
      const picker = new google.picker.PickerBuilder()
        .setDeveloperKey(GOOGLE_API_KEY)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data) => {
          clearTimeout(timeout);
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            finish(data.docs[0].id);
          } else {
            finish(null);
          }
        })
        .build();
      picker.setVisible(true);
    });
  });
}

/**
 * Laadi faili sisu.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<string>} file content
 */
export async function getFileContent(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Faili laadimine ebaõnnestus');
  }
  return res.text();
}

/**
 * Laadi faili sisu binaarina (Blob), nt meedia asset.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<Blob>}
 */
export async function getFileBlob(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Meedia faili laadimine ebaõnnestus');
  }
  return res.blob();
}

/**
 * Loe Google Drive faili metadata, et tuvastada konfliktid ja säilitada sama faili identiteet eri seadmetes.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<{ id: string, name: string, modifiedTime?: string, createdTime?: string, parents?: string[], shared?: boolean }>}
 */
export async function getFileMetadata(accessToken, fileId) {
  if (!accessToken) throw new Error('Token aegunud. Logi uuesti sisse.');
  if (!fileId) throw new Error('Fail puudub');
  const params = new URLSearchParams({
    fields: 'id,name,modifiedTime,createdTime,parents,shared',
  });
  const res = await fetch(`${DRIVE_API_URL}/${fileId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Faili metadata laadimine ebaõnnestus');
  }
  const data = await res.json();
  return {
    id: data.id,
    name: data.name || '',
    modifiedTime: data.modifiedTime || '',
    createdTime: data.createdTime || '',
    parents: Array.isArray(data.parents) ? data.parents : [],
    shared: !!data.shared,
  };
}

/**
 * Loetleb Google Drive'ist failid, mille nimi sisaldab ".nm" (või vana ".noodimeister").
 * @param {string} accessToken
 * @param {object} [options] - pageSize, orderBy, folderId (piirdu kaustaga)
 * @returns {Promise<Array<{ id, name, modifiedTime, createdTime }>>}
 */
export async function listNoodimeisterFiles(accessToken, options = {}) {
  const { pageSize = 50, orderBy = 'modifiedTime desc', folderId } = options;
  let q = "trashed = false and (name contains '.nm' or name contains '.noodimeister')";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    orderBy,
    fields: 'files(id, name, modifiedTime, createdTime)'
  });
  const res = await fetch(`${DRIVE_API_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Tööde nimekirja laadimine ebaõnnestus');
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Loetleb Google Drive'ist failid, mis on kasutajaga jagatud (shared with me) ja mille nimi sisaldab ".nm" (või vana ".noodimeister").
 * @param {string} accessToken
 * @returns {Promise<Array<{ id, name, modifiedTime, createdTime }>>}
 */
export async function listNoodimeisterFilesSharedWithMe(accessToken) {
  const q = "sharedWithMe = true and trashed = false and (name contains '.nm' or name contains '.noodimeister')";
  const params = new URLSearchParams({
    q,
    pageSize: '50',
    orderBy: 'modifiedTime desc',
    fields: 'files(id, name, modifiedTime, createdTime)'
  });
  const res = await fetch(`${DRIVE_API_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Jagatud failide nimekirja laadimine ebaõnnestus');
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Kustuta fail Google Drive'ist.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteFile(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API_URL}/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Faili kustutamine ebaõnnestus');
  }
}

/**
 * Loetleb Google Drive'i kausta alamkaustad (ainult kaustad, mitte failid).
 * @param {string} accessToken
 * @param {string|null|'root'} parentId - vanemkausta ID või 'root' / null juurkausta jaoks
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function listFolderChildren(accessToken, parentId) {
  const parent = !parentId || parentId === 'root' ? 'root' : parentId;
  const q = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and '" + parent + "' in parents";
  const params = new URLSearchParams({
    q,
    pageSize: '200',
    fields: 'files(id, name)'
  });
  const res = await fetch(`${DRIVE_API_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Kaustade nimekirja laadimine ebaõnnestus');
  }
  const data = await res.json();
  return (data.files || []).map((f) => ({ id: f.id, name: f.name || '' }));
}

/**
 * Tagastab kausta nime (metadata).
 * @param {string} accessToken
 * @param {string} folderId
 * @returns {Promise<{ name: string }|null>}
 */
export async function getFolderMetadata(accessToken, folderId) {
  if (!folderId) return null;
  const params = new URLSearchParams({ fields: 'name' });
  const res = await fetch(`${DRIVE_API_URL}/${folderId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { name: data.name || '' };
}

/**
 * Tagastab kausta vanemkausta(d) (asukoht). Võib olla mitu, kui kaust on mitmes kaustas.
 * @param {string} accessToken
 * @param {string} folderId
 * @returns {Promise<{ parents: string[] }|null>}
 */
export async function getFolderParents(accessToken, folderId) {
  if (!folderId) return null;
  const params = new URLSearchParams({ fields: 'parents' });
  const res = await fetch(`${DRIVE_API_URL}/${folderId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const parents = Array.isArray(data.parents) ? data.parents : [];
  return { parents };
}

/**
 * Teisalda kaust (või fail) uude asukohta (teise kausta sisse).
 * @param {string} accessToken
 * @param {string} folderId - teisaldatava kausta ID
 * @param {string} newParentId - uue vanemkausta ID (või 'root' juurkausta)
 * @returns {Promise<{ id: string, parents: string[] }|null>}
 */
export async function moveFolder(accessToken, folderId, newParentId) {
  if (!folderId || !newParentId) return null;
  const parentId = newParentId === 'root' || !newParentId ? 'root' : newParentId;
  const meta = await getFolderParents(accessToken, folderId);
  const previousParents = meta?.parents?.length ? meta.parents.join(',') : '';
  const params = new URLSearchParams({ addParents: parentId, fields: 'id,parents,name' });
  if (previousParents) params.set('removeParents', previousParents);
  const res = await fetch(`${DRIVE_API_URL}/${folderId}?${params}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Token aegunud. Logi uuesti sisse.' : (err || 'Kausta teisaldamine ebaõnnestus'));
  }
  const data = await res.json();
  return { id: data.id, parents: data.parents || [parentId], name: data.name };
}

/**
 * Rename a folder (or file) in Google Drive.
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} newName
 * @returns {Promise<{ name: string }|null>}
 */
export async function renameFolder(accessToken, folderId, newName) {
  if (!folderId || !newName?.trim()) return null;
  const res = await fetch(`${DRIVE_API_URL}/${folderId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName.trim() })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Token aegunud. Logi uuesti sisse.' : (err || 'Kausta ümbernimetamine ebaõnnestus'));
  }
  const data = await res.json();
  return { name: data.name || newName.trim() };
}

function buildCopyName(originalName) {
  const name = String(originalName || '').trim() || 'Untitled.nm';
  const lower = name.toLowerCase();
  const ext = lower.endsWith('.noodimeister') ? '.noodimeister' : lower.endsWith('.nm') ? '.nm' : '';
  const base = ext ? name.slice(0, -ext.length) : name;
  const safeBase = base.trim() || 'Untitled';
  return `${safeBase} (koopia)${ext || '.nm'}`;
}

/**
 * Tee NoodiMeisteri projektifailist koopia (uue fileId-ga) samasse või teise kausta.
 * Teostus: loe sisu ja loo uus fail NOODIMEISTER_MIME_TYPE'ga.
 * @param {string} accessToken
 * @param {string} fileId
 * @param {string} targetFolderId
 * @param {string} [newName]
 * @returns {Promise<{ id: string }>}
 */
export async function copyProjectFile(accessToken, fileId, targetFolderId, originalName, newName) {
  if (!accessToken) throw new Error('Token aegunud. Logi uuesti sisse.');
  if (!fileId) throw new Error('Fail puudub');
  const content = await getFileContent(accessToken, fileId);
  const fileName = (newName && String(newName).trim()) ? String(newName).trim() : buildCopyName(originalName);
  const id = await createFileInFolder(accessToken, targetFolderId || 'root', fileName, content);
  return { id };
}

/** Salvestuskaustade nimekirja konfiguratsioonifail Drive'i juurkaustas (sünkroonimiseks seadmete vahel). */
const SAVE_FOLDERS_CONFIG_FILENAME = 'NoodiMeister-save-folders.json';

/**
 * Kontrolli, et projektisisu ei ole tühi ega vigane (vältib tühja faili Drive'is).
 * @param {string} content JSON string
 * @returns {{ valid: boolean, error?: string }}
 */
function validateProjectContent(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Sisu puudub' };
  }
  const trimmed = content.trim();
  if (trimmed.length < 50) {
    return { valid: false, error: 'Projektisisu on liiga lühike või tühi' };
  }
  try {
    const data = JSON.parse(trimmed);
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Vigane projekti vorming' };
    }
    if (!Array.isArray(data.staves) || data.staves.length === 0) {
      return { valid: false, error: 'Projektis puuduvad noodiread (staves)' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Projektisisu ei ole kehtiv JSON' };
  }
}

/**
 * Uuenda olemasoleva faili sisu (media).
 * @param {string} accessToken
 * @param {string} fileId
 * @param {string} content
 */
async function updateFileContent(accessToken, fileId, content) {
  const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: content
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token aegunud. Logi uuesti sisse.');
    throw new Error('Faili uuendamine ebaõnnestus');
  }
  return res.json().catch(() => ({}));
}

/**
 * Uuenda olemasoleva NoodiMeisteri projektifaili sisu Google Drive'is.
 * Kasutab fileId-d (ei loo uut koopiat). Ei luba tühja või vigast sisu (vältib tühjendamist).
 * @param {string} accessToken
 * @param {string} fileId
 * @param {string} content JSON string
 */
export async function updateProjectFile(accessToken, fileId, content) {
  const check = validateProjectContent(content);
  if (!check.valid) {
    throw new Error(check.error || 'Projektisisu ei ole salvestatav');
  }
  return updateFileContent(accessToken, fileId, content);
}

/**
 * Loe salvestuskaustade nimekiri Drive'ist (sünkroonimiseks teise seadmega). Fail juurkaustas.
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getSaveFoldersConfig(accessToken) {
  const q = "trashed = false and name = '" + SAVE_FOLDERS_CONFIG_FILENAME.replace(/'/g, "\\'") + "' and 'root' in parents";
  const params = new URLSearchParams({ q, pageSize: '1', fields: 'files(id)' });
  const res = await fetch(`${DRIVE_API_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  const fileId = data.files?.[0]?.id;
  if (!fileId) return [];
  try {
    const raw = await getFileContent(accessToken, fileId);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.folders) ? parsed.folders : [];
  } catch {
    return [];
  }
}

/**
 * Salvesta salvestuskaustade nimekiri Drive'i (sünkroonimiseks teise seadmega).
 * @param {string} accessToken
 * @param {Array<{ id: string, name: string }>} folders
 */
export async function setSaveFoldersConfig(accessToken, folders) {
  const list = Array.isArray(folders) ? folders : [];
  const content = JSON.stringify({ folders: list });
  const q = "trashed = false and name = '" + SAVE_FOLDERS_CONFIG_FILENAME.replace(/'/g, "\\'") + "' and 'root' in parents";
  const params = new URLSearchParams({ q, pageSize: '1', fields: 'files(id)' });
  const res = await fetch(`${DRIVE_API_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Konfiguratsiooni lugemine ebaõnnestus');
  const data = await res.json();
  const fileId = data.files?.[0]?.id;
  if (fileId) {
    await updateFileContent(accessToken, fileId, content);
  } else {
    await createFileInFolder(accessToken, 'root', SAVE_FOLDERS_CONFIG_FILENAME, content);
  }
}

import * as authStorage from './authStorage';

export function getStoredToken() {
  return authStorage.getStoredTokenFromAuth();
}
