import {
  getStorageForRead,
  getLoggedInUser,
  KEY_GOOGLE_TOKEN,
  KEY_GOOGLE_EXPIRY,
  KEY_MICROSOFT_TOKEN,
  KEY_MICROSOFT_EXPIRY,
  setGoogleGrantedScopes,
  setMicrosoftGrantedScopes,
} from './authStorage';
import { getMsalPublicClientApplication } from './msalBrowser';

const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

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
        scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.install',
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
    setGoogleGrantedScopes(tokenResponse.scope || 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.install');
    return tokenResponse.access_token;
  })();
  try {
    return await googleRefreshPromise;
  } finally {
    googleRefreshPromise = null;
  }
}

async function getMsalInstance() {
  const instance = await getMsalPublicClientApplication();
  if (!instance) throw new Error('Microsoft Client ID puudub.');
  await instance.handleRedirectPromise({ navigateToLoginRequestUrl: false }).catch(() => null);
  return instance;
}

let microsoftRefreshPromise = null;
export async function refreshMicrosoftTokenSilently() {
  if (microsoftRefreshPromise) return microsoftRefreshPromise;
  microsoftRefreshPromise = (async () => {
    const instance = await getMsalInstance();
    const scopes = ['openid', 'profile', 'offline_access', 'User.Read', 'Files.Read'];
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
    setMicrosoftGrantedScopes(tokenResponse.scopes || scopes);
    return tokenResponse.accessToken;
  })();
  try {
    return await microsoftRefreshPromise;
  } finally {
    microsoftRefreshPromise = null;
  }
}
