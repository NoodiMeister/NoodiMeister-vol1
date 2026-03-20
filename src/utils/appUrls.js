/**
 * Absoluutne URL pilvefaili avamiseks redaktoris (/app?fileId=… [&cloud=onedrive]).
 */
export function getEditorUrlForCloudFile(fileId, options = {}) {
  if (typeof window === 'undefined' || fileId == null || fileId === '') return '';
  const cloud = options.cloud;
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const q = new URLSearchParams({ fileId: String(fileId) });
  if (cloud === 'onedrive') q.set('cloud', 'onedrive');
  return new URL(`app?${q.toString()}`, `${window.location.origin}${base}`).href;
}

export function openCloudFileInNewBrowserTab(fileId, options) {
  if (typeof window === 'undefined' || fileId == null || fileId === '') return;
  const href = getEditorUrlForCloudFile(fileId, options);
  if (!href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
}
