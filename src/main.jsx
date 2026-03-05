import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';

function showFatalError(message, detail) {
  const el = document.getElementById('root');
  if (!el) return;
  const copyable = [message || 'Tundmatu viga', detail ? '\n\n' + String(detail) : ''].join('');
  const preContent = (message || 'Tundmatu viga') + (detail ? '\n\n' + String(detail) : '');
  el.innerHTML = [
    '<div style="padding:24px;font-family:sans-serif;background:#fef2f2;color:#991b1b;min-height:100vh;box-sizing:border-box">',
    '<h2>Viga</h2>',
    '<p style="margin-top:8px;font-size:14px">Rakendus ei kukkunud kokku – saad selle teate kopeerida ja edastada.</p>',
    '<pre id="fatal-error-pre" style="overflow:auto;font-size:12px;background:#fff;padding:12px;border-radius:8px;border:1px solid #fecaca">' + String(preContent).replace(/</g, '&lt;') + '</pre>',
    '<button type="button" id="fatal-error-copy" style="margin-top:12px;padding:8px 16px;cursor:pointer;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600">Kopeeri veateade</button>',
    '<p style="margin-top:16px;font-size:14px">Ava brauseri konsool (F12) rohkem infot jaoks.</p>',
    '</div>'
  ].join('');
  const copyBtn = document.getElementById('fatal-error-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(copyable).then(() => {
        copyBtn.textContent = 'Kopeeritud';
        setTimeout(() => { copyBtn.textContent = 'Kopeeri veateade'; }, 3000);
      });
    });
  }
}

try {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Element #root ei leitud. Kontrolli index.html.');
  const root = ReactDOM.createRoot(rootEl);
  // StrictMode välja: võib põhjustada "Cannot access 'Tr' before initialization" sõltuvustes
  const app = <App />;

  if (googleClientId) {
    root.render(<GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>);
  } else {
    root.render(app);
  }
} catch (err) {
  console.error(err);
  showFatalError(err?.message || 'Rakenduse käivitus ebaõnnestus', err?.stack);
}

// Püüab võrgu/laadimise vead (nt fetch ebaõnnestub) – näitab konsoolis
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});

// Tööaegsed vead (ReferenceError, COOP jms) – logi täpselt ja ära lase rakendusel vaikselt kukkuda
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  const fromNodeModules = e.filename?.includes('node_modules');
  console.error('[NoodiMeister] Uncaught error:', msg, {
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    type: e.type,
    error: e.error,
  });
  if (!fromNodeModules && msg && typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root && root.firstChild && !root.querySelector('[data-auth-error-overlay]')) {
      const overlay = document.createElement('div');
      overlay.setAttribute('data-auth-error-overlay', '1');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(254,242,242,0.98);color:#991b1b;font-family:sans-serif;padding:24px;overflow:auto;box-sizing:border-box';
      overlay.innerHTML = '<h2>Viga</h2><p>Rakendus ei kukkunud kokku. Saad selle teate kopeerida.</p><pre style="background:#fff;padding:12px;border-radius:8px;font-size:12px;overflow:auto">' + String(msg + (e.error?.stack ? '\n\n' + e.error.stack : '')).replace(/</g, '&lt;') + '</pre><button type="button" style="margin-top:12px;padding:8px 16px;cursor:pointer;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600">Kopeeri veateade</button>';
      const copyable = msg + (e.error?.stack ? '\n\n' + e.error.stack : '');
      overlay.querySelector('button').addEventListener('click', () => {
        navigator.clipboard.writeText(copyable);
        overlay.querySelector('button').textContent = 'Kopeeritud';
      });
      document.body.appendChild(overlay);
    }
  }
});
