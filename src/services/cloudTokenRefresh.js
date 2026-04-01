import {
  getStorageForRead,
  getLoggedInUser,
  KEY_GOOGLE_TOKEN,
  KEY_GOOGLE_EXPIRY,
  KEY_MICROSOFT_TOKEN,
  KEY_MICROSOFT_EXPIRY,
} from './authStorage';

const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const MSAL_CDN_URLS = [
  'https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.0/dist/msal-browser.min.js',
];

function storeGoogleToken(token, expiresInSeconds) {
  const storage = getStorageForRead();
  if (!storage || !token) return;
  storage.setItem(KEY_GOOGLE_TOKEN, token);
  const expiresAt = Number.isFinite(Number(expiresInSeconds))
    ? Date.now() + Number(expiresInSeconds) * 1000
    : 0;
  storage.setItem(KEY_GOOGLE_EXPIRY, String(expiresAt));
}

function storeMicrosoftToken(token, expiresInSeconds) {
  const storage = getStorageForRead();
  if (!storage || !token) return;
  storage.setItem(KEY_MICROSOFT_TOKEN, token);
  const expiresAt = Number.isFinite(Number(expiresInSeconds))
    ? Date.now() + Number(expiresInSeconds) * 1000
    : 0;
  storage.setItem(KEY_MICROSOFT_EXPIRY, String(expiresAt));
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Brauseri keskkond puudub'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

let googleRefreshPromise = null;
export async function refreshGoogleTokenSilently() {
  if (googleRefreshPromise) return googleRefreshPromise;
  googleRefreshPromise = (async () => {
    const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';
    if (!clientId) throw new Error('Google Client ID puudub.');
    await loadScriptOnce(GOOGLE_GSI_SCRIPT_URL);
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
      throw new Error('Google OAuth teek pole saadaval.');
    }

    const tokenResponse = await new Promise((resolve, reject) => {
      let finished = false;
      const done = (fn, value) => {
        if (finished) return;
        finished = true;
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('Google token refresh timeout')), 12000);
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile https://www.googleapis.com/auth/drive',
        prompt: '',
        callback: (resp) => {
          clearTimeout(timer);
          if (resp?.error) done(reject, new Error(resp.error_description || resp.error));
          else done(resolve, resp);
        },
      });
      tokenClient.requestAccessToken();
    });

    if (!tokenResponse?.access_token) throw new Error('Google token refresh ebaõnnestus.');
    storeGoogleToken(tokenResponse.access_token, tokenResponse.expires_in);
    return tokenResponse.access_token;
  })();
  try {
    return await googleRefreshPromise;
  } finally {
    googleRefreshPromise = null;
  }
}

async function ensureMsal() {
  if (typeof window === 'undefined') throw new Error('Brauseri keskkond puudub');
  if (window.msal?.PublicClientApplication) return;
  let lastError = null;
  for (const src of MSAL_CDN_URLS) {
    try {
      await loadScriptOnce(src);
      if (window.msal?.PublicClientApplication) return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('MSAL scripti laadimine ebaõnnestus.');
}

let msalInstancePromise = null;
async function getMsalInstance() {
  if (msalInstancePromise) return msalInstancePromise;
  msalInstancePromise = (async () => {
    await ensureMsal();
    const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_CLIENT_ID) || '';
    const tenantId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_TENANT_ID) || 'common';
    if (!clientId) throw new Error('Microsoft Client ID puudub.');
    const redirectUri = window.location.origin + '/login';
    const instance = new window.msal.PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}`,
        redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    });
    await instance.initialize();
    await instance.handleRedirectPromise().catch(() => null);
    return instance;
  })();
  return msalInstancePromise;
}

let microsoftRefreshPromise = null;
export async function refreshMicrosoftTokenSilently() {
  if (microsoftRefreshPromise) return microsoftRefreshPromise;
  microsoftRefreshPromise = (async () => {
    const instance = await getMsalInstance();
    const scopes = ['User.Read', 'Files.ReadWrite'];
    const userEmail = getLoggedInUser()?.email || '';
    const accounts = instance.getAllAccounts();
    const account = accounts.find((a) => String(a?.username || '').toLowerCase() === String(userEmail).toLowerCase()) || accounts[0];
    if (!account) throw new Error('Microsofti konto puudub lokaalsest sessioonist.');
    let tokenResponse = null;
    try {
      tokenResponse = await instance.acquireTokenSilent({ scopes, account });
    } catch {
      tokenResponse = await instance.ssoSilent({
        scopes,
        loginHint: userEmail || account.username || undefined,
      });
    }
    if (!tokenResponse?.accessToken) throw new Error('Microsoft token refresh ebaõnnestus.');
    storeMicrosoftToken(tokenResponse.accessToken, tokenResponse.expiresIn);
    return tokenResponse.accessToken;
  })();
  try {
    return await microsoftRefreshPromise;
  } finally {
    microsoftRefreshPromise = null;
  }
}
