/**
 * OneDrive (Microsoft Graph) – minimaalne teenus:
 * - loe /me profiili
 * - loe /me/drive/root/children ja filtreeri NoodiMeisteri failid (nt .noodimeister)
 *
 * Eeldab, et:
 * - kasutaja on sisse loginud Microsoftiga
 * - tokenil on vähemalt scope 'User.Read' (profiil)
 * - kui failide loetlemine ebaõnnestub scope puudumise tõttu, tagastame vea, aga ei murra kogu kontolehte
 */

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

async function graphGet(token, path) {
  if (!token) throw new Error('Microsofti token puudub (proovi uuesti sisse logida Microsoftiga).');
  const res = await fetch(`${GRAPH_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.message ||
      (res.status === 403
        ? 'Õigused OneDrive\'i lugemiseks puuduvad (võib vajada administraatori nõusolekut).'
        : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Profiil: /me – näitab, kas token töötab üldse Microsoft Graphiga. */
export async function getOneDriveProfile(token) {
  try {
    const me = await graphGet(token, '/me');
    return {
      ok: true,
      displayName: me.displayName || '',
      mail: me.mail || me.userPrincipalName || '',
      raw: me,
    };
  } catch (e) {
    return { ok: false, error: e?.message || 'Profiili lugemine ebaõnnestus.' };
  }
}

/**
 * Loetleb OneDrive'i kaustast failid ja filtreerib NoodiMeisteri failid.
 * @param {string} token
 * @param {string} [folderId] - kausta ID või undefined/'root' = juurkaust
 */
export async function listNoodimeisterFilesFromOneDrive(token, folderId) {
  try {
    const path = folderId
      ? `/me/drive/items/${encodeURIComponent(folderId)}/children?$top=50`
      : '/me/drive/root/children?$top=50';
    const data = await graphGet(token, path);
    const items = Array.isArray(data.value) ? data.value : [];
    const files = items
      .filter((item) => !item.folder && typeof item.name === 'string')
      .filter((item) => item.name.toLowerCase().includes('.noodimeister'));
    return {
      ok: true,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        lastModifiedDateTime: f.lastModifiedDateTime,
        size: f.size,
        webUrl: f.webUrl,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'OneDrive\'i failide loetlemine ebaõnnestus.',
    };
  }
}

/**
 * Loetleb OneDrive'ist failid, mis on kasutajaga jagatud (shared with me), mille nimi sisaldab ".noodimeister".
 * @param {string} token
 * @returns {Promise<{ ok: boolean, files?: Array<{ id, name, lastModifiedDateTime, size, webUrl }>, error?: string }>}
 */
export async function listNoodimeisterFilesSharedWithMe(token) {
  try {
    const data = await graphGet(token, '/me/drive/sharedWithMe?$top=100');
    const items = Array.isArray(data.value) ? data.value : [];
    const files = items
      .filter((item) => !item.folder && typeof item.name === 'string')
      .filter((item) => item.name.toLowerCase().includes('.noodimeister'))
      .map((f) => ({
        id: f.id,
        name: f.name,
        lastModifiedDateTime: f.lastModifiedDateTime,
        size: f.size,
        webUrl: f.webUrl,
      }));
    return { ok: true, files };
  } catch (e) {
    return {
      ok: false,
      files: [],
      error: e?.message || 'Jagatud failide nimekirja laadimine ebaõnnestus.',
    };
  }
}

/**
 * Loetleb OneDrive'i kausta alamkaustad (children).
 * @param {string} token
 * @param {string} [folderId] - kausta ID või undefined/'root' = juurkaust
 */
export async function listFolderChildren(token, folderId) {
  try {
    const path = folderId && folderId !== 'root'
      ? `/me/drive/items/${encodeURIComponent(folderId)}/children?$top=200`
      : '/me/drive/root/children?$top=200';
    const data = await graphGet(token, path);
    const items = Array.isArray(data.value) ? data.value : [];
    const folders = items
      .filter((item) => item.folder && typeof item.name === 'string')
      .map((f) => ({ id: f.id, name: f.name }));
    return { ok: true, folders };
  } catch (e) {
    return { ok: false, folders: [], error: e?.message || 'Kausta sisu lugemine ebaõnnestus.' };
  }
}

/**
 * Loo OneDrive'i kaust etteantud kausta sisse.
 */
export async function createFolder(token, parentId, folderName) {
  try {
    const path = parentId && parentId !== 'root'
      ? `/me/drive/items/${encodeURIComponent(parentId)}/children`
      : '/me/drive/root/children';
    const res = await fetch(`${GRAPH_ROOT}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, id: body.id, name: body.name || folderName };
  } catch (e) {
    return { ok: false, error: e?.message || 'Kausta loomine ebaõnnestus.' };
  }
}

/**
 * Tagastab kausta/elemendi nime.
 */
export async function getItemName(token, itemId) {
  try {
    const item = await graphGet(token, `/me/drive/items/${encodeURIComponent(itemId)}?$select=name`);
    return item?.name || null;
  } catch {
    return null;
  }
}

/**
 * Tagastab elemendi vanemkausta (asukoht).
 * @param {string} token
 * @param {string} itemId
 * @returns {Promise<{ parentId: string, parentName?: string }|null>}
 */
export async function getItemParent(token, itemId) {
  try {
    const item = await graphGet(token, `/me/drive/items/${encodeURIComponent(itemId)}?$select=parentReference`);
    const ref = item?.parentReference;
    if (!ref?.id) return null;
    return { parentId: ref.id, parentName: ref.name };
  } catch {
    return null;
  }
}

/**
 * Teisalda kaust või fail OneDrive'is teise kausta sisse.
 * @param {string} token
 * @param {string} itemId - teisaldatava elemendi ID
 * @param {string} newParentId - uue vanemkausta ID (või 'root' juurkausta)
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function moveItem(token, itemId, newParentId) {
  if (!token || !itemId || !newParentId) {
    return { ok: false, error: 'Missing token, item or parent.' };
  }
  try {
    let targetId = newParentId;
    if (newParentId === 'root') {
      const root = await graphGet(token, '/me/drive/root?$select=id');
      targetId = root?.id || newParentId;
    }
    const res = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentReference: { id: targetId } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: e?.message || 'Kausta teisaldamine ebaõnnestus.' };
  }
}

/**
 * Rename a folder (or item) in OneDrive.
 * @param {string} token
 * @param {string} itemId
 * @param {string} newName
 * @returns {Promise<{ ok: boolean, name?: string, error?: string }>}
 */
export async function renameItem(token, itemId, newName) {
  if (!token || !itemId || !newName?.trim()) {
    return { ok: false, error: 'Missing token, item or name.' };
  }
  try {
    const res = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, name: body.name || newName.trim() };
  } catch (e) {
    return { ok: false, error: e?.message || 'Kausta ümbernimetamine ebaõnnestus.' };
  }
}

/**
 * Upload a file to OneDrive root (small files, up to ~250 MB).
 * Requires scope Files.ReadWrite (or Files.ReadWrite.AppFolder).
 * PUT /me/drive/root:/fileName:/content
 */
export async function uploadFileToRoot(token, fileName, content, contentType = 'application/json') {
  if (!token) throw new Error('Microsofti token puudub (proovi uuesti sisse logida Microsoftiga).');
  const path = `/me/drive/root:/${encodeURIComponent(fileName)}:/content`;
  const res = await fetch(`${GRAPH_ROOT}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: typeof content === 'string' ? content : JSON.stringify(content),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.message ||
      (res.status === 403
        ? 'Õigused OneDrive\'i salvestamiseks puuduvad (võib vajada Files.ReadWrite või uut sisselogimist).'
        : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Upload a file to a specific OneDrive folder.
 * PUT /me/drive/items/{parent-id}:/{fileName}:/content
 */
export async function uploadFileToFolder(token, folderId, fileName, content, contentType = 'application/json') {
  if (!token) throw new Error('Microsofti token puudub (proovi uuesti sisse logida Microsoftiga).');
  if (!folderId || folderId === 'root') {
    return uploadFileToRoot(token, fileName, content, contentType);
  }
  const path = `/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content`;
  const res = await fetch(`${GRAPH_ROOT}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: typeof content === 'string' ? content : JSON.stringify(content),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.message ||
      (res.status === 403
        ? 'Õigused OneDrive\'i salvestamiseks puuduvad (võib vajada Files.ReadWrite või uut sisselogimist).'
        : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Kustuta fail OneDrive'ist.
 * @param {string} token
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteFile(token, fileId) {
  if (!token) throw new Error('Microsofti token puudub.');
  const res = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
}

/** Loe OneDrive'i faili sisu (tekstina). Kasutada töö avamiseks /app?fileId=...&cloud=onedrive. */
export async function getFileContent(token, fileId) {
  if (!token) throw new Error('Microsofti token puudub.');
  const res = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(fileId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.text();
}
