/**
 * Google Drive salvestus ja laadimine.
 * Nõuab kasutajalt sisselogimist Google'iga ja Drive'i luba (OAuth scope).
 */

const SCRIPT_URL = 'https://apis.google.com/js/api.js';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';

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
      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            resolve(data.docs[0].id);
          } else {
            resolve(null);
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
      if (!window.google?.picker) {
        resolve(null);
        return;
      }
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            resolve(data.docs[0].id);
          } else {
            resolve(null);
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
 * Loetleb Google Drive'ist failid, mille nimi sisaldab ".noodimeister".
 * @param {string} accessToken
 * @param {object} [options] - pageSize, orderBy, folderId (piirdu kaustaga)
 * @returns {Promise<Array<{ id, name, modifiedTime, createdTime }>>}
 */
export async function listNoodimeisterFiles(accessToken, options = {}) {
  const { pageSize = 50, orderBy = 'modifiedTime desc', folderId } = options;
  let q = "trashed = false and name contains '.noodimeister'";
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

import * as authStorage from './authStorage';

export function getStoredToken() {
  return authStorage.getStoredTokenFromAuth();
}
