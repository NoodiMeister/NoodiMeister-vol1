import React, { useEffect, useState, useMemo } from 'react';
import {
  getStorageForLogin,
  getStorageForRead,
  getLoggedInUser,
  isLoggedIn,
  KEY_MICROSOFT_TOKEN,
  KEY_MICROSOFT_EXPIRY,
  setMicrosoftGrantedScopes,
  clearGoogleAuthSession,
  setLoggedInUser,
} from './services/authStorage';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, getTranslations } from './i18n';
import { getMicrosoftRedirectUri } from './utils/microsoftRedirectUri';

function redirectToKonto() {
  try {
    const base = (import.meta.env?.BASE_URL || '').replace(/\/$/, '') || '';
    const path = base ? `${base}/konto` : '/konto';
    window.location.assign(window.location.origin + path);
  } catch {
    window.location.assign('/konto');
  }
}

/**
 * Shown when the app loads with ?code= or #code= (Microsoft redirect flow).
 * Uses window.msal from CDN, runs handleRedirectPromise(), then saves user and redirects to /konto (Minu konto).
 */
export default function MicrosoftRedirectHandler() {
  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const locale = typeof window !== 'undefined' ? (localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE) : DEFAULT_LOCALE;
  const t = useMemo(() => getTranslations(locale), [locale]);

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = getMicrosoftRedirectUri();

    if (!clientId) {
      setStatus('error');
      setErrorMessage(t['auth.configMissingClientId'] || 'VITE_MICROSOFT_CLIENT_ID puudub.');
      return;
    }

    function run() {
      if (!window.msal?.PublicClientApplication) return Promise.resolve(null);
      const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}`;
      const pca = new window.msal.PublicClientApplication({
        auth: { clientId, authority, redirectUri },
        cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
      });
      return pca.initialize().then(() => pca.handleRedirectPromise());
    }

    function waitForMsal() {
      if (window.msal?.PublicClientApplication) return Promise.resolve();
      return new Promise((resolve) => {
        let attempts = 0;
        const t = setInterval(() => {
          attempts++;
          if (window.msal?.PublicClientApplication) {
            clearInterval(t);
            resolve();
            return;
          }
          if (attempts >= 50) {
            clearInterval(t);
            resolve();
          }
        }, 200);
      });
    }

    function getUrlParams(fragmentOrQuery) {
      const str = fragmentOrQuery || '';
      const params = {};
      str.replace(/^[#?]/, '').split('&').forEach((pair) => {
        const [k, v] = pair.split('=').map((s) => decodeURIComponent(s || '').trim());
        if (k) params[k] = v;
      });
      return params;
    }

    waitForMsal()
      .then(() => run())
      .then((result) => {
        if (cancelled) return;
        if (!result?.account) {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          const params = { ...getUrlParams(hash), ...getUrlParams(search) };
          const errMsg = params.error_description || params.error || '';
          const redirectUri = getMicrosoftRedirectUri();
          setStatus('error');
          setErrorMessage(
            errMsg
              ? `Microsoft: ${errMsg}`
              : `No login data received. In Azure Portal → App registrations → NoodiMeister → Authentication, add this exact Redirect URI under "Single-page application": ${redirectUri} (then try again).`
          );
          return;
        }
        const account = result.account;
        const accessToken = result.accessToken || '';
        if (!accessToken) {
          setStatus('error');
          setErrorMessage(t['auth.accessTokenMissing'] || 'Access token puudub.');
          return;
        }
        return fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json().catch(() => ({})))
          .then((profile) => {
            if (cancelled) return;
            const emailRaw = profile.mail || profile.userPrincipalName || account.username || '';
            const email = String(emailRaw || '').trim().toLowerCase();
            if (!email) {
              setStatus('error');
              setErrorMessage(t['auth.emailNotReceived'] || 'E-maili ei saadud.');
              return;
            }
            const user = {
              email,
              name: profile.displayName || account.name || email.split('@')[0],
              provider: 'microsoft',
            };
            const storage = getStorageForLogin(false);
            if (!storage) {
              setStatus('error');
              setErrorMessage(t['auth.storageNotAvailable'] || 'Salvestus ei ole saadaval.');
              return;
            }
            const sessionUser = setLoggedInUser(user, false);
            if (!sessionUser?.email) {
              setStatus('error');
              setErrorMessage(t['auth.storageNotAvailable'] || 'Salvestus ei ole saadaval.');
              return;
            }
            clearGoogleAuthSession();
            storage.setItem(KEY_MICROSOFT_TOKEN, accessToken);
            const expiresAt = result.expiresOn ? result.expiresOn.getTime() : 0;
            storage.setItem(KEY_MICROSOFT_EXPIRY, String(expiresAt));
            setMicrosoftGrantedScopes(result.scopes || ['User.Read', 'Files.Read']);
            if (!getLoggedInUser()?.email || !isLoggedIn()) {
              setStatus('error');
              setErrorMessage(t['auth.confirmationFailed'] || 'Kinnitamine ebaõnnestus.');
              return;
            }
            setStatus('redirect');
            try { sessionStorage.setItem('noodimeister-show-welcome', '1'); } catch (_) {}
            // Clear hash/query so refresh doesn't re-run handler; then redirect
            try {
              window.history.replaceState(null, '', window.location.pathname || '/');
            } catch (_) {}
            setTimeout(() => redirectToKonto(), 100);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[MicrosoftRedirectHandler]', err);
        setStatus('error');
        setErrorMessage(err?.message || err?.errorMessage || String(err));
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        background: '#fefce8',
        color: '#854d0e',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {status === 'processing' && <p>{t['auth.microsoftSigningIn']}</p>}
      {status === 'redirect' && (
        <div>
          <p>{t['auth.redirectingToMyWork']}</p>
          <a
            href={typeof window !== 'undefined' ? (window.location.origin + ((import.meta.env?.BASE_URL || '').replace(/\/$/, '') || '') + '/konto') : '/konto'}
            style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', background: '#b45309', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}
          >
            {t['auth.clickIfNotRedirecting']}
          </a>
        </div>
      )}
      {status === 'error' && (
        <div style={{ maxWidth: 480 }}>
          <p style={{ marginBottom: 12 }}>{errorMessage}</p>
          {typeof window !== 'undefined' && (
            <p style={{ fontSize: 12, color: '#78716c', marginTop: 8, wordBreak: 'break-all' }}>
              Redirect URI for Azure: <code>{getMicrosoftRedirectUri()}</code>
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: '#b45309',
                color: '#fff',
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t['auth.backToHome']}
            </a>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                border: '2px solid #b45309',
                color: '#b45309',
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t['auth.tryAgain']}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
