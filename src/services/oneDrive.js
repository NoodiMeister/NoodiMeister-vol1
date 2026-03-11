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
 * Loetleb OneDrive'i juurkaustast mõned failid ja filtreerib NoodiMeisteri failid.
 * NB: ainult lugemine; salvestamise/üleslaadimise loogika tuleb hiljem.
 */
export async function listNoodimeisterFilesFromOneDrive(token) {
  try {
    const data = await graphGet(token, '/me/drive/root/children?$top=50');
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

