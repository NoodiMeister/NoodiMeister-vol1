import React, { useEffect, useState } from 'react';
import {
  getStorageForLogin,
  getStorageForRead,
  getLoggedInUser,
  isLoggedIn,
  KEY_LOGGED_IN,
  KEY_MICROSOFT_TOKEN,
  KEY_MICROSOFT_EXPIRY,
} from './services/authStorage';

function getMicrosoftRedirectUri() {
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/';
  return window.location.origin + base;
}

function getMicrosoftTesterEmails() {
  const raw = import.meta.env?.VITE_MICROSOFT_TESTER_EMAILS || '';
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function redirectToTood() {
  try {
    const base = (import.meta.env?.BASE_URL || '').replace(/\/$/, '') || '';
    const path = base ? `${base}/tood` : '/tood';
    window.location.assign(window.location.origin + path);
  } catch {
    window.location.assign('/tood');
  }
}

/**
 * Shown when the app loads with ?code= or #code= (Microsoft redirect flow).
 * Uses window.msal from CDN, runs handleRedirectPromise(), then saves user and redirects to /tood.
 */
export default function MicrosoftRedirectHandler() {
  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = getMicrosoftRedirectUri();

    if (!clientId) {
      setStatus('error');
      setErrorMessage('VITE_MICROSOFT_CLIENT_ID puudub.');
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

    waitForMsal()
      .then(() => run())
      .then((result) => {
        if (cancelled) return;
        if (!result?.account) {
          setStatus('error');
          setErrorMessage('Konto infot ei saadud. Proovi uuesti.');
          return;
        }
        const account = result.account;
        const accessToken = result.accessToken || '';
        if (!accessToken) {
          setStatus('error');
          setErrorMessage('Access token puudub.');
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
              setErrorMessage('E-maili ei saadud.');
              return;
            }
            const allowed = getMicrosoftTesterEmails();
            if (allowed.length > 0 && !allowed.includes(email)) {
              setStatus('error');
              setErrorMessage(`Konto ${email} pole testijate nimekirjas.`);
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
              setErrorMessage('Salvestus ei ole saadaval.');
              return;
            }
            storage.setItem(KEY_LOGGED_IN, JSON.stringify(user));
            storage.setItem(KEY_MICROSOFT_TOKEN, accessToken);
            const expiresAt = result.expiresOn ? result.expiresOn.getTime() : 0;
            storage.setItem(KEY_MICROSOFT_EXPIRY, String(expiresAt));
            try {
              const users = JSON.parse(localStorage.getItem('noodimeister-users') || '[]');
              if (!users.some((u) => u && u.email === email)) {
                users.push({ ...user });
                localStorage.setItem('noodimeister-users', JSON.stringify(users));
              }
            } catch (_) {}
            if (!getLoggedInUser()?.email || !isLoggedIn()) {
              setStatus('error');
              setErrorMessage('Kinnitamine ebaõnnestus.');
              return;
            }
            setStatus('redirect');
            redirectToTood();
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
      {status === 'processing' && <p>Microsofti sisselogimine… Töötleme.</p>}
      {status === 'redirect' && <p>Suuname Minu tööde lehele…</p>}
      {status === 'error' && (
        <div>
          <p>{errorMessage}</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '8px 16px',
              background: '#b45309',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Tagasi avalehele
          </a>
        </div>
      )}
    </div>
  );
}
