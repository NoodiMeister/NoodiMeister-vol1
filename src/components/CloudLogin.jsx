import React, { useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { getStorageForLogin, getStorageForRead, getLoggedInUser, isLoggedIn, setLoggedInUser, clearMicrosoftAuthSession, clearMsalPreRedirectKeys, KEY_GOOGLE_TOKEN, KEY_GOOGLE_EXPIRY, KEY_MICROSOFT_TOKEN, KEY_MICROSOFT_EXPIRY, setGoogleGrantedScopes, setMicrosoftGrantedScopes } from '../services/authStorage';
import { formatAuthError } from '../utils/authError';
import { getMsalPublicClientApplication } from '../services/msalBrowser';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, getTranslations } from '../i18n';

function getT() {
  try {
    const locale = (typeof window !== 'undefined' && localStorage.getItem(LOCALE_STORAGE_KEY)) || DEFAULT_LOCALE;
    return getTranslations(locale);
  } catch {
    return getTranslations(DEFAULT_LOCALE);
  }
}

const googleClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

const microsoftClientId = String((typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_CLIENT_ID) || '').trim();
const GOOGLE_SCOPE_READ = 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.install';
const GOOGLE_SCOPE_WRITE = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install';
/** MSAL v5 / OIDC: openid (+ profile, offline_access) peab olemas olema koos Graph scope'idega. */
const MICROSOFT_OIDC_BASE = ['openid', 'profile', 'offline_access'];
/** OneDrive (kaustad, salvestus): Graph POST /children nõuab Files.ReadWrite — ainult Files.Read annab 403. */
const MICROSOFT_SCOPE_ONEDRIVE = [...MICROSOFT_OIDC_BASE, 'User.Read', 'Files.ReadWrite'];
const MICROSOFT_SCOPE_READ = MICROSOFT_SCOPE_ONEDRIVE;
const MICROSOFT_SCOPE_WRITE = MICROSOFT_SCOPE_ONEDRIVE;
/** Registreerimine ilma Drive loata — ainult konto + Graph User.Read */
const MICROSOFT_SCOPE_REGISTER_MIN = [...MICROSOFT_OIDC_BASE, 'User.Read'];

/** Heuristics to detect mobile / tablet (especially iPadOS where popups are fragile). */
function isMobileOrTablet() {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
    const hasTouch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isMobile = /mobile/.test(ua);
    // iPadOS 13+ reports as Mac, so combine touch + Mac check
    const isIPadLikeMac = hasTouch && /macintosh|mac os x/.test(ua);
    return isIOS || isAndroid || isMobile || isIPadLikeMac;
  } catch {
    return false;
  }
}

/** Google OAuth redirect URI: current page (so we can return to the same view). */
function getGoogleRedirectUri() {
  try {
    const origin = window.location.origin;
    const path = window.location.pathname || '/';
    const search = window.location.search || '';
    return origin + path + search;
  } catch {
    return (typeof window !== 'undefined' ? window.location.origin : '') + '/';
  }
}

/** Save and restore return URL across Google redirect. */
const KEY_GOOGLE_RETURN_URL = 'noodimeister-google-return-url';

function rememberGoogleReturnUrl() {
  if (typeof window === 'undefined') return;
  try {
    const href = window.location.href;
    window.sessionStorage?.setItem(KEY_GOOGLE_RETURN_URL, href);
  } catch {
    // ignore
  }
}

function consumeGoogleReturnUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const href = window.sessionStorage?.getItem(KEY_GOOGLE_RETURN_URL);
    if (href) window.sessionStorage?.removeItem(KEY_GOOGLE_RETURN_URL);
    return href || null;
  } catch {
    return null;
  }
}

/** Parse Google OAuth implicit-flow hash fragment (access_token, error, state). */
function parseGoogleHashResponse() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash || hash.length < 2 || !hash.startsWith('#')) return null;
  try {
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const expiresIn = params.get('expires_in');
    if (!accessToken && !error) return null;
    return {
      access_token: accessToken || null,
      error: error || null,
      error_description: errorDescription || null,
      expires_in: expiresIn ? Number(expiresIn) : null,
      rawParams: params,
    };
  } catch {
    return null;
  }
}

function clearLocationHash() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
  } catch {
    // ignore
  }
}

async function ensureMsalReady() {
  if (!microsoftClientId) return null;
  try {
    return await getMsalPublicClientApplication();
  } catch (e) {
    console.error('[CloudLogin] MSAL ei käivitunud:', e?.message || e);
    return null;
  }
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

/** Suuna Minu kontole (/konto) Vercelil korrektselt (arvestab BASE_URL). */
function redirectToKonto() {
  if (typeof window === 'undefined') return;
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
    const path = (base.replace(/\/$/, '') || '') + '/konto';
    const url = window.location.origin + path;
    window.location.assign(url);
  } catch (e) {
    console.warn('[CloudLogin] redirectToKonto viga:', e);
    window.location.assign('/konto');
  }
}

function useCloudLoginWithProvider(mode = 'login', stayLoggedIn = false, onError, options = {}) {
  const navigate = useNavigate();
  const [microsoftInProgress, setMicrosoftInProgress] = useState(false);

  const handleGoogleToken = (tokenResponse) => {
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
      const t = getT();
      alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + (e?.message ?? String(e)));
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
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + (payload.fullMessage || payload.description || 'Profiili viga'));
            if (onError) onError(payload);
            return;
          }
          if (!profile.email) {
            const msg = 'e-mail puudub (konto võib olla piiratud)';
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
            const payload = formatAuthError('Google userinfo', { message: msg });
            if (onError) onError(payload);
            return;
          }
          const user = { email: profile.email, name: profile.name || profile.given_name || profile.email?.split('@')[0], provider: 'google' };
          if (!canUseStorageForLogin(stayLoggedIn)) {
            const msg = 'brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit.';
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
            if (onError) onError(formatAuthError('brauser', { message: msg }));
            return;
          }
          const storage = getStorageForLogin(stayLoggedIn);
          if (!storage) {
            const msg = 'brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit.';
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
            const payload = formatAuthError('brauser', { message: msg });
            if (onError) onError(payload);
            return;
          }
          const sessionUser = setLoggedInUser(user, stayLoggedIn);
          if (!sessionUser?.email) {
            const msg = 'Sisselogimise salvestamine ebaõnnestus. Proovi uuesti või teist brauserit.';
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
            const payload = formatAuthError('brauser', { message: msg });
            if (onError) onError(payload);
            return;
          }
          clearMicrosoftAuthSession();
          if (tokenResponse.access_token) {
            storage.setItem(KEY_GOOGLE_TOKEN, tokenResponse.access_token);
            const expiresAt = tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : 0;
            storage.setItem(KEY_GOOGLE_EXPIRY, String(expiresAt));
            setGoogleGrantedScopes(tokenResponse.scope || options.googleScope || GOOGLE_SCOPE_READ);
          }
          // Vercel fix: suuna alles siis, kui auth andmed on kinnitatud (loe tagasi), et /app ei laadi enne kui isLoggedIn() töötab.
          // COOP: ära kasuta window.close() – sisselogimine suunab /app poole; close() põhjustaks Cross-Origin-Opener-Policy vigu.
          const readStorage = getStorageForRead();
          const confirmedUser = getLoggedInUser();
          const loggedIn = isLoggedIn();
          if (!readStorage || !confirmedUser?.email || !loggedIn) {
            const msg = 'Sisselogimine salvestati, kuid kinnitamine ebaõnnestus. Proovi uuesti või teist brauserit.';
            const t = getT();
            alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
            const payload = formatAuthError('brauser', { message: msg });
            if (onError) onError(payload);
            return;
          }

          // After redirect login, try to return the user to the page they were on before starting Google OAuth.
          const returnUrl = consumeGoogleReturnUrl();
          console.log('[CloudLogin] Auth kinnitatud, returnUrl =', returnUrl);
          try { sessionStorage.setItem('noodimeister-show-welcome', '1'); } catch (_) {}
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (returnUrl && returnUrl !== window.location.href) {
                window.location.replace(returnUrl);
              } else {
                redirectToKonto();
              }
            }, 50);
          });
        } catch (e) {
          const t = getT();
          alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + (e?.message ?? String(e)));
          console.error(e);
          const payload = formatAuthError('Google userinfo', e && typeof e === 'object' ? e : new Error(String(e)));
          if (onError) onError(payload);
        }
      })
      .catch((err) => {
        const msg = err?.message ?? err?.error_description ?? (err && typeof err === 'object' ? (err.fullMessage || JSON.stringify(err)) : String(err));
        const t = getT();
        alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
        console.error(err);
        const payload = formatAuthError('Google userinfo', err && typeof err === 'object' ? err : new Error(String(err)));
        if (onError) onError(payload);
      });
  };

  const startGoogleRedirect = () => {
    if (!googleClientId || typeof window === 'undefined') return;
    rememberGoogleReturnUrl();
    const redirectUri = getGoogleRedirectUri();
    const scope = encodeURIComponent(options.googleScope || GOOGLE_SCOPE_READ);
    const state = encodeURIComponent(JSON.stringify({ ts: Date.now(), mode }));
    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(googleClientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&response_type=token' +
      `&scope=${scope}` +
      '&include_granted_scopes=true' +
      '&prompt=select_account' +
      `&state=${state}`;
    console.log('[CloudLogin] Google redirect flow:', { redirectUri, url });
    window.location.assign(url);
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      handleGoogleToken(tokenResponse);
    },
    onError: (err) => {
      console.error('[CloudLogin] Google OAuth onError:', err, { errorType: typeof err, keys: err && typeof err === 'object' ? Object.keys(err) : [] });
      const isPopupClosed = err?.error === 'popup_closed_by_user' || err?.type === 'popup_closed' || err?.type === 'popup_closed_by_user';
      const msg = err?.message ?? err?.error_description ?? err?.error ?? (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      const isCrossOriginIssue = typeof msg === 'string' && /cross-origin|cross origin|coop|opener|blocked/i.test(msg);
      if (!isPopupClosed) {
        const t = getT();
        alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
        const payload = formatAuthError('Google OAuth', err && typeof err === 'object' ? err : new Error(String(err)));
        if (onError) onError(payload);
      }
      // On iPadOS / mobile or cross-origin popup issues, switch to redirect-based login.
      if (isMobileOrTablet() || isCrossOriginIssue) {
        console.warn('[CloudLogin] Google popup failed or cross-origin issue detected – falling back to redirect flow.');
        startGoogleRedirect();
      }
    },
    flow: 'implicit',
    scope: options.googleScope || GOOGLE_SCOPE_READ
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
    // On mobile/tablet (especially iPadOS), prefer a full-page redirect flow instead of popup.
    if (isMobileOrTablet()) {
      startGoogleRedirect();
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
        const t = getT();
        alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
        const payload = formatAuthError('konfiguratsioon', { message: msg });
        if (onError) onError(payload);
        return;
      }
      if (!canUseStorageForLogin(false) && !canUseStorageForLogin(true)) {
        const msg = 'Brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit või lülita privaatne režiim välja.';
        const t = getT();
        alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
        if (onError) onError(formatAuthError('brauser', { message: msg }));
        return;
      }

      const loginScopes = Array.isArray(options.microsoftScopes) && options.microsoftScopes.length > 0
        ? options.microsoftScopes
        : MICROSOFT_SCOPE_READ;
      const msal = await ensureMsalReady();
      if (!msal) throw new Error('Microsofti sisselogimise teek ei laadinud. Proovi teist brauserit või võrku; mõnikord blokeeritakse Microsofti skripte.');

      // Katkenud redirect jätab MSAL ajutise oleku (session + mõnikord localStorage) — loginRedirect võib vaikselt ebaõnnestuda
      clearMsalPreRedirectKeys();
      // Clear any leftover redirect state so interaction_in_progress does not block the next attempt
      await msal.handleRedirectPromise({ navigateToLoginRequestUrl: false }).catch(() => null);
      await msal.loginRedirect({
        scopes: loginScopes,
        prompt: 'select_account',
      });
      return;
    })().catch((err) => {
      const isPopupClosed = err?.errorCode === 'user_cancelled' || err?.errorCode === 'popup_window_error' || err?.errorMessage?.includes('user_cancelled');
      const isInteractionInProgress = err?.errorCode === 'interaction_in_progress' || (err?.message && String(err.message).includes('interaction_in_progress'));
      if (isInteractionInProgress) clearMsalPreRedirectKeys();
      if (!isPopupClosed) {
        const msg = isInteractionInProgress
          ? 'Eelmine Microsofti sisselogimine jäi pooleli. Proovi Microsofti nuppu uuesti (vajadusel värskenda lehte).'
          : (err?.message || err?.errorMessage || err?.error_description || (err && typeof err === 'object' ? JSON.stringify(err) : String(err)));
        const t = getT();
        alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + msg);
        console.error('[CloudLogin] Microsoft OAuth viga:', err);
        const payload = formatAuthError('Microsoft OAuth', err && typeof err === 'object' ? err : new Error(String(err)));
        if (onError) onError(payload);
      }
    }).finally(() => {
      microsoftInteractionLock = false;
      setMicrosoftInProgress(false);
    });
  };

  // Handle Google redirect callback (implicit flow with access_token in hash) on any page where this hook is used.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseGoogleHashResponse();
    if (!parsed) return;
    clearLocationHash();
    if (parsed.error) {
      const payload = formatAuthError('Google OAuth redirect', { error: parsed.error, error_description: parsed.error_description });
      const t = getT();
      alert((t['auth.loginError'] || 'Sisselogimise viga') + ': ' + (payload.fullMessage || payload.description || parsed.error));
      if (onError) onError(payload);
      return;
    }
    if (parsed.access_token) {
      handleGoogleToken({
        access_token: parsed.access_token,
        expires_in: parsed.expires_in,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleGoogleClick, handleMicrosoftClick, microsoftInProgress };
}

function CloudLoginButtonsInner({ mode = 'login', stayLoggedIn = false, onError, googleScope = GOOGLE_SCOPE_READ, microsoftScopes = MICROSOFT_SCOPE_READ }) {
  const { handleGoogleClick, handleMicrosoftClick, microsoftInProgress } = useCloudLoginWithProvider(mode, stayLoggedIn, onError, { googleScope, microsoftScopes });
  const t = getT();
  const label = mode === 'register' ? (t['auth.registerCloud'] || 'Või registreeru pilveteenusega') : (t['auth.loginOrRegisterCloud'] || 'Või logi sisse pilveteenusega');
  const googleEnabled = !!googleClientId;
  const microsoftEnabled = !!microsoftClientId;

  // Eellaadimine: MSAL initialize enne Microsofti nuppu (kiirem esimene klikk).
  useEffect(() => {
    if (microsoftClientId && typeof window !== 'undefined') {
      getMsalPublicClientApplication().catch(() => {});
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
      </div>
      {!googleEnabled && <p className="text-xs text-amber-600 text-center">Google: lisa `VITE_GOOGLE_CLIENT_ID` .env faili.</p>}
      {!microsoftEnabled && <p className="text-xs text-amber-600 text-center">Microsoft: lisa `VITE_MICROSOFT_CLIENT_ID` .env faili.</p>}
    </div>
  );
}

export function CloudLoginButtons({ mode = 'login', stayLoggedIn = false, onError, googleScope = GOOGLE_SCOPE_READ, microsoftScopes = MICROSOFT_SCOPE_READ }) {
  return <CloudLoginButtonsInner mode={mode} stayLoggedIn={stayLoggedIn} onError={onError} googleScope={googleScope} microsoftScopes={microsoftScopes} />;
}

export async function requestGoogleReadPermission() {
  if (!googleClientId || typeof window === 'undefined') throw new Error('Google Client ID puudub.');
  await new Promise((resolve, reject) => {
    const script = document.querySelector(`script[src="https://accounts.google.com/gsi/client"]`);
    if (window.google?.accounts?.oauth2?.initTokenClient) return resolve();
    if (script) {
      const t = setInterval(() => {
        if (window.google?.accounts?.oauth2?.initTokenClient) {
          clearInterval(t);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(t); reject(new Error('Google OAuth teek ei laadinud.')); }, 8000);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google OAuth teek ei laadinud.'));
    document.head.appendChild(s);
  });
  const response = await new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_SCOPE_READ,
      prompt: 'consent',
      callback: (resp) => {
        if (resp?.error) reject(new Error(resp.error_description || resp.error));
        else resolve(resp);
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
  const storage = getStorageForRead();
  if (response?.access_token && storage) {
    storage.setItem(KEY_GOOGLE_TOKEN, response.access_token);
    storage.setItem(KEY_GOOGLE_EXPIRY, String(Date.now() + Number(response.expires_in || 3600) * 1000));
    setGoogleGrantedScopes(response.scope || GOOGLE_SCOPE_READ);
  }
  return response;
}

export async function requestMicrosoftReadPermission() {
  const msal = await ensureMsalReady();
  if (!msal) throw new Error('Microsofti sisselogimise teek ei laadinud.');
  await msal.handleRedirectPromise({ navigateToLoginRequestUrl: false }).catch(() => null);
  const user = getLoggedInUser();
  const email = String(user?.email || '').toLowerCase();
  const accounts = msal.getAllAccounts();
  const account = accounts.find((a) => String(a?.username || '').toLowerCase() === email) || accounts[0];
  const tokenResponse = await msal.acquireTokenPopup({
    scopes: MICROSOFT_SCOPE_READ,
    account: account || undefined,
    prompt: 'select_account',
  });
  const storage = getStorageForRead();
  if (tokenResponse?.accessToken && storage) {
    storage.setItem(KEY_MICROSOFT_TOKEN, tokenResponse.accessToken);
    storage.setItem(KEY_MICROSOFT_EXPIRY, String(Date.now() + Number(tokenResponse.expiresIn || 3600) * 1000));
    setMicrosoftGrantedScopes(tokenResponse.scopes || MICROSOFT_SCOPE_READ);
  }
  return tokenResponse;
}

export { GOOGLE_SCOPE_READ, GOOGLE_SCOPE_WRITE, MICROSOFT_SCOPE_READ, MICROSOFT_SCOPE_WRITE, MICROSOFT_SCOPE_REGISTER_MIN };
