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
export async function createFileInFolder(accessToken, folderId, fileName, content) {
  const boundary = '-------noodimeister-------';
  const meta = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json'
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

export function getStoredToken() {
  const token = localStorage.getItem('noodimeister-google-token');
  const expiry = localStorage.getItem('noodimeister-google-token-expiry');
  if (!token) return null;
  if (expiry && Date.now() > Number(expiry)) {
    localStorage.removeItem('noodimeister-google-token');
    localStorage.removeItem('noodimeister-google-token-expiry');
    return null;
  }
  return token;
}
