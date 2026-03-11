import React, { useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { getStorageForLogin, getStorageForRead, getLoggedInUser, isLoggedIn } from '../services/authStorage';
import { formatAuthError } from '../utils/authError';

const googleClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

/** Microsoft sisselogimise testija e-mailid (VITE_MICROSOFT_TESTER_EMAILS, komaga eraldatud). Kui massiiv on tühi, piirangut ei ole. */
function getMicrosoftTesterEmails() {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_TESTER_EMAILS) || '';
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

const KEY_LOGGED_IN = 'noodimeister-logged-in';
const KEY_GOOGLE_TOKEN = 'noodimeister-google-token';
const KEY_GOOGLE_EXPIRY = 'noodimeister-google-token-expiry';
const KEY_MICROSOFT_TOKEN = 'noodimeister-microsoft-token';
const KEY_MICROSOFT_EXPIRY = 'noodimeister-microsoft-token-expiry';

const microsoftClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_CLIENT_ID) || '';
const microsoftTenantId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_TENANT_ID) || 'common';

function getMicrosoftRedirectUri() {
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    const normalizedBase = base.endsWith('/') ? base : base + '/';
    return window.location.origin + normalizedBase;
  } catch {
    return window.location.origin + '/';
  }
}

const MSAL_CDN_URLS = [
  'https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.0/dist/msal-browser.min.js',
];

/** Load one MSAL script; on failure try next URL. */
function loadMsalScript(urls, index = 0) {
  if (index >= urls.length) return Promise.reject(new Error('MSAL script failed to load'));
  const url = urls[index];
  if (document.querySelector(`script[src="${url}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => {
      loadMsalScript(urls, index + 1).then(resolve).catch(reject);
    };
    document.head.appendChild(script);
  });
}

/** Ensure MSAL script is in the page; if not, add it dynamically (helps when index.html script is blocked). */
function ensureMsalScriptLoaded() {
  if (window.msal?.PublicClientApplication) return Promise.resolve();
  return loadMsalScript(MSAL_CDN_URLS);
}

/** Wait for window.msal (poll up to 12s). Tries dynamic script load once if still missing after 10s. */
function waitForMsal() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.msal?.PublicClientApplication) return Promise.resolve(true);
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      if (window.msal?.PublicClientApplication) {
        clearInterval(interval);
        resolve(true);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        ensureMsalScriptLoaded()
          .then(() => {
            const again = setInterval(() => {
              if (window.msal?.PublicClientApplication) {
                clearInterval(again);
                resolve(true);
              }
            }, 200);
            setTimeout(() => {
              clearInterval(again);
              resolve(!!window.msal?.PublicClientApplication);
            }, 4000);
          })
          .catch(() => {
            console.error('[CloudLogin] MSAL CDN script ei laadinud.');
            resolve(false);
          });
      }
    }, 200);
  });
}

/** Promise that resolves to an already-initialized MSAL instance (global msal from CDN). */
let msalPromiseByOrigin = {};
function getOrCreateMsalPromise() {
  if (typeof window === 'undefined' || !microsoftClientId) return null;
  if (!window.msal?.PublicClientApplication) return null;
  const origin = window.location.origin;
  if (msalPromiseByOrigin[origin]) return msalPromiseByOrigin[origin];
  const redirectUri = getMicrosoftRedirectUri();
  const authority = `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenantId || 'common')}`;
  const instance = new window.msal.PublicClientApplication({
    auth: {
      clientId: microsoftClientId,
      authority,
      redirectUri,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  });
  const promise = instance.initialize().then(() => instance).catch((e) => {
    delete msalPromiseByOrigin[origin];
    throw e;
  });
  msalPromiseByOrigin[origin] = promise;
  return promise;
}

async function ensureMsalReady() {
  const ok = await waitForMsal();
  if (!ok) return null;
  const p = getOrCreateMsalPromise();
  if (!p) return null;
  return p;
}

/** Vercel/sisselogimise eelne kontroll: kas salvestus on kirjutatav ja loetav (vältib "kinnitamine ebaõnnestus"). */
function canUseStorageForLogin(stayLoggedIn) {
  if (typeof window === 'undefined') return false;
  try {
    const storage = stayLoggedIn ? window.localStorage : window.sessionStorage;
    if (!storage) return false;
    const testKey = 'noodimeister-storage-check';
    storage.setItem(testKey, '1');
    const ok = storage.getItem(testKey) === '1';
    storage.removeItem(testKey);
    return ok;
  } catch {
    return false;
  }
}

/** Synchronous lock so a second Microsoft click cannot run before the first finishes (avoids interaction_in_progress). */
let microsoftInteractionLock = false;

/** Suuna Minu tööde vaatesse (/tood) Vercelil korrektselt (arvestab BASE_URL). */
function redirectToTood() {
  if (typeof window === 'undefined') return;
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
    const path = (base.replace(/\/$/, '') || '') + '/tood';
    const url = window.location.origin + path;
    window.location.assign(url);
  } catch (e) {
    console.warn('[CloudLogin] redirectToTood viga:', e);
    window.location.assign('/tood');
  }
}

function useCloudLoginWithProvider(mode = 'login', stayLoggedIn = false, onError) {
  const navigate = useNavigate();
  const [microsoftInProgress, setMicrosoftInProgress] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      try {
        if (typeof tokenResponse === 'undefined') {
          console.error('[CloudLogin] Sisselogimise hetkel: tokenResponse on undefined');
          return;
        }
        if (!tokenResponse?.access_token) {
          console.error('[CloudLogin] Puudub access_token:', { hasTokenResponse: !!tokenResponse, keys: tokenResponse && typeof tokenResponse === 'object' ? Object.keys(tokenResponse) : [] });
          return;
        }
      } catch (e) {
        alert('Sisselogimise viga: ' + (e?.message ?? String(e)));
        console.error(e);
        if (onError) onError(formatAuthError('Google OAuth', e));
        return;
      }
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            const errDetail = body.error?.message ?? body.error_description ?? body.message ?? (r.status === 401 ? 'Token kehtetu või aegunud' : `HTTP ${r.status}`);
            const err = { status: r.status, code: body.error?.code ?? body.error, message: errDetail, ...body };
            console.error('[CloudLogin] Google userinfo API viga:', err);
            throw err;
          }
          return body;
        })
        .then(profile => {
          try {
            if (typeof profile === 'undefined') {
              console.error('[CloudLogin] Sisselogimise hetkel: profile on undefined');
              throw new Error('Profiili andmeid ei saadud');
            }
            if (!profile || profile.error) {
              const errObj = profile && (typeof profile.error === 'string' ? { error: profile.error, error_description: profile.error_description } : profile);
              const payload = formatAuthError('Google userinfo', errObj);
              alert('Sisselogimise viga: ' + (payload.fullMessage || payload.description || 'Profiili viga'));
              if (onError) onError(payload);
              return;
            }
            if (!profile.email) {
              const msg = 'e-mail puudub (konto võib olla piiratud)';
              alert('Sisselogimise viga: ' + msg);
              const payload = formatAuthError('Google userinfo', { message: msg });
              if (onError) onError(payload);
              return;
            }
            const user = { email: profile.email, name: profile.name || profile.given_name || profile.email?.split('@')[0], provider: 'google' };
            if (!canUseStorageForLogin(stayLoggedIn)) {
              const msg = 'brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit.';
              alert('Sisselogimise viga: ' + msg);
              if (onError) onError(formatAuthError('brauser', { message: msg }));
              return;
            }
            const storage = getStorageForLogin(stayLoggedIn);
            if (!storage) {
              const msg = 'brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit.';
              alert('Sisselogimise viga: ' + msg);
              const payload = formatAuthError('brauser', { message: msg });
              if (onError) onError(payload);
              return;
            }
            storage.setItem(KEY_LOGGED_IN, JSON.stringify(user));
            if (tokenResponse.access_token) {
              storage.setItem(KEY_GOOGLE_TOKEN, tokenResponse.access_token);
              const expiresAt = tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : 0;
              storage.setItem(KEY_GOOGLE_EXPIRY, String(expiresAt));
            }
            // Always ensure user is in noodimeister-users so the account is "fully registered" (login or register).
            try {
              const users = JSON.parse(localStorage.getItem('noodimeister-users') || '[]');
              if (!users.some(u => u && u.email === profile.email)) {
                users.push({ ...user });
                localStorage.setItem('noodimeister-users', JSON.stringify(users));
              }
            } catch (_) {}
            // Vercel fix: suuna alles siis, kui auth andmed on kinnitatud (loe tagasi), et /app ei laadi enne kui isLoggedIn() töötab.
            // COOP: ära kasuta window.close() – sisselogimine suunab /app poole; close() põhjustaks Cross-Origin-Opener-Policy vigu.
            const readStorage = getStorageForRead();
            const confirmedUser = getLoggedInUser();
            const loggedIn = isLoggedIn();
            if (!readStorage || !confirmedUser?.email || !loggedIn) {
              const msg = 'Sisselogimine salvestati, kuid kinnitamine ebaõnnestus. Proovi uuesti või teist brauserit.';
              alert('Sisselogimise viga: ' + msg);
              const payload = formatAuthError('brauser', { message: msg });
              if (onError) onError(payload);
              return;
            }
            console.log('[CloudLogin] Auth kinnitatud, suuname /tood poole (Minu tööd)');
            try { sessionStorage.setItem('noodimeister-show-welcome', '1'); } catch (_) {}
            requestAnimationFrame(() => {
              setTimeout(redirectToTood, 50);
            });
          } catch (e) {
            alert('Sisselogimise viga: ' + (e?.message ?? String(e)));
            console.error(e);
            const payload = formatAuthError('Google userinfo', e && typeof e === 'object' ? e : new Error(String(e)));
            if (onError) onError(payload);
          }
        })
        .catch((err) => {
          const msg = err?.message ?? err?.error_description ?? (err && typeof err === 'object' ? (err.fullMessage || JSON.stringify(err)) : String(err));
          alert('Sisselogimise viga: ' + msg);
          console.error(err);
          const payload = formatAuthError('Google userinfo', err && typeof err === 'object' ? err : new Error(String(err)));
          if (onError) onError(payload);
        });
    },
    onError: (err) => {
      console.error('[CloudLogin] Google OAuth onError:', err, { errorType: typeof err, keys: err && typeof err === 'object' ? Object.keys(err) : [] });
      const isPopupClosed = err?.error === 'popup_closed_by_user' || err?.type === 'popup_closed' || err?.type === 'popup_closed_by_user';
      if (!isPopupClosed) {
        const msg = err?.message ?? err?.error_description ?? err?.error ?? (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert('Sisselogimise viga: ' + msg);
        const payload = formatAuthError('Google OAuth', err && typeof err === 'object' ? err : new Error(String(err)));
        if (onError) onError(payload);
      }
    },
    flow: 'implicit',
    scope: 'email profile https://www.googleapis.com/auth/drive'
  });

  const handleGoogleClick = () => {
    if (!googleClientId) {
      const msg = 'VITE_GOOGLE_CLIENT_ID puudub. Lisa .env faili rida (Google Cloud Console).';
      alert('Sisselogimise viga: ' + msg);
      const payload = formatAuthError('konfiguratsioon', { message: msg });
      if (onError) onError(payload);
      return;
    }
    if (!canUseStorageForLogin(false) && !canUseStorageForLogin(true)) {
      const msg = 'Brauser ei luba andmeid salvestada (nt privaatne režiim või kolmandate küpsiste blokeerimine). Proovi teist brauserit või lülita privaatne režiim välja.';
      alert('Sisselogimise viga: ' + msg);
      if (onError) onError(formatAuthError('brauser', { message: msg }));
      return;
    }
    googleLogin();
  };

  const handleMicrosoftClick = () => {
    if (microsoftInteractionLock) return;
    microsoftInteractionLock = true;
    setMicrosoftInProgress(true);
    (async () => {
      if (typeof window === 'undefined') return;
      if (!microsoftClientId) {
        const msg = 'VITE_MICROSOFT_CLIENT_ID puudub. Lisa .env faili rida (Azure App Registration).';
        alert('Sisselogimise viga: ' + msg);
        const payload = formatAuthError('konfiguratsioon', { message: msg });
        if (onError) onError(payload);
        return;
      }
      if (!canUseStorageForLogin(false) && !canUseStorageForLogin(true)) {
        const msg = 'Brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit või lülita privaatne režiim välja.';
        alert('Sisselogimise viga: ' + msg);
        if (onError) onError(formatAuthError('brauser', { message: msg }));
        return;
      }

      // Only User.Read for sign-in so users can consent without org admin. Request Files.ReadWrite later when using OneDrive.
      const loginScopes = ['User.Read'];
      const msal = await ensureMsalReady();
      if (!msal) throw new Error('Microsofti sisselogimise teek ei laadinud. Lülita reklaamide või skriptide blokeerija välja sellel lehel või proovi teist brauserit või privaatakent.');

      // Clear any leftover redirect state so interaction_in_progress does not block the next attempt
      await msal.handleRedirectPromise().catch(() => null);
      await msal.loginRedirect({
        scopes: loginScopes,
        prompt: 'select_account',
      });
      return;
    })().catch((err) => {
      const isPopupClosed = err?.errorCode === 'user_cancelled' || err?.errorCode === 'popup_window_error' || err?.errorMessage?.includes('user_cancelled');
      const isInteractionInProgress = err?.errorCode === 'interaction_in_progress' || (err?.message && String(err.message).includes('interaction_in_progress'));
      if (!isPopupClosed) {
        const msg = isInteractionInProgress
          ? 'Sisselogimise aken on juba avatud või eelmine proovimine ei lõppenud. Sulge kõik Microsofti aknad, oota mõni sekund ja proovi uuesti.'
          : (err?.message || err?.errorMessage || err?.error_description || (err && typeof err === 'object' ? JSON.stringify(err) : String(err)));
        alert('Sisselogimise viga: ' + msg);
        console.error('[CloudLogin] Microsoft OAuth viga:', err);
        const payload = formatAuthError('Microsoft OAuth', err && typeof err === 'object' ? err : new Error(String(err)));
        if (onError) onError(payload);
      }
    }).finally(() => {
      microsoftInteractionLock = false;
      setMicrosoftInProgress(false);
    });
  };

  const handleAppleClick = () => {
    alert('Apple sisselogimine tuleb tulevikus. Kasuta praegu e-maili ja parooli või Google\'i.');
  };

  return { handleGoogleClick, handleMicrosoftClick, handleAppleClick, microsoftInProgress };
}

function CloudLoginButtonsInner({ mode = 'login', stayLoggedIn = false, onError }) {
  const { handleGoogleClick, handleMicrosoftClick, handleAppleClick, microsoftInProgress } = useCloudLoginWithProvider(mode, stayLoggedIn, onError);
  const label = mode === 'register' ? 'Või registreeru pilveteenusega' : 'Või logi sisse pilveteenusega';
  const googleEnabled = !!googleClientId;
  const microsoftEnabled = !!microsoftClientId;
  const appleEnabled = false;

  // Start MSAL initialization as soon as login/register page is shown so it's ready when user clicks Microsoft.
  useEffect(() => {
    if (microsoftClientId && typeof window !== 'undefined') {
      getOrCreateMsalPromise();
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-amber-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-amber-700 font-medium">{label}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={!googleEnabled}
          className={[
            "flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium transition-all",
            googleEnabled ? "hover:bg-amber-50 hover:border-amber-300" : "opacity-60 cursor-not-allowed"
          ].join(' ')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </button>
        <button
          type="button"
          onClick={handleMicrosoftClick}
          disabled={!microsoftClientId || microsoftInProgress}
          className={[
            "flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium transition-all",
            (microsoftClientId && !microsoftInProgress) ? "hover:bg-amber-50 hover:border-amber-300" : "opacity-60 cursor-not-allowed"
          ].join(' ')}
        >
          <svg className="w-5 h-5" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          {microsoftInProgress ? '...' : 'Microsoft'}
        </button>
        <button
          type="button"
          onClick={handleAppleClick}
          disabled={!appleEnabled}
          className={[
            "flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium transition-all",
            appleEnabled ? "hover:bg-amber-50 hover:border-amber-300" : "opacity-60 cursor-not-allowed"
          ].join(' ')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Apple
        </button>
      </div>
      {!googleEnabled && <p className="text-xs text-amber-600 text-center">Google: lisa `VITE_GOOGLE_CLIENT_ID` .env faili.</p>}
      {!microsoftEnabled && <p className="text-xs text-amber-600 text-center">Microsoft: lisa `VITE_MICROSOFT_CLIENT_ID` .env faili.</p>}
      {!appleEnabled && <p className="text-xs text-amber-600 text-center">Apple: tuleb hiljem.</p>}
    </div>
  );
}

export function CloudLoginButtons({ mode = 'login', stayLoggedIn = false, onError }) {
  return <CloudLoginButtonsInner mode={mode} stayLoggedIn={stayLoggedIn} onError={onError} />;
}
