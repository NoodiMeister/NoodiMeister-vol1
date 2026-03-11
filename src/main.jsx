import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './utils/notationConstants'; // Lae enne Appi – vältib TDZ/ReferenceError lazy chunkides (Vercel)
import App from './App';
import MicrosoftPopupCallback from './MicrosoftPopupCallback';
import './index.css';

// Teema enne esimest joonistust (vältib vilkumist)
(function applyStoredTheme() {
  try {
    const raw = localStorage.getItem('noodimeister-theme');
    if (raw) {
      const o = JSON.parse(raw);
      const mode = o.mode === 'dark' ? 'dark' : 'light';
      const primaryColor = ['orange', 'blue', 'green'].includes(o.primaryColor) ? o.primaryColor : 'orange';
      document.documentElement.setAttribute('data-theme', mode);
      document.documentElement.setAttribute('data-primary-color', primaryColor);
    }
  } catch (_) { /* ignore */ }
})();

// Microsoft: if URL has #code=, we always run the callback (popup can lose window.opener after redirect). Do not strip.

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

  const hasMicrosoftCode = typeof window !== 'undefined' && window.location.hash && /[#&]code=/.test(window.location.hash);
  if (hasMicrosoftCode) {
    root.render(<MicrosoftPopupCallback />);
  } else {
    const app = <App />;
    if (googleClientId) {
      root.render(<GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>);
    } else {
      root.render(app);
    }
  }
} catch (err) {
  console.error(err);
  showFatalError(err?.message || 'Rakenduse käivitus ebaõnnestus', err?.stack);
}

// Püüab võrgu/laadimise vead (nt fetch ebaõnnestub) – näitab konsoolis
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});

// Tööaegsed vead (ReferenceError, COOP jms) – logi täpselt; välti blokeerivat ülekattet
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
    // Overlay is on body – check body, not root (overlay is not inside #root)
    if (document.body.querySelector('[data-auth-error-overlay]')) return;
    const root = document.getElementById('root');
    if (!root || !root.firstChild) return;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-auth-error-overlay', '1');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(254,242,242,0.98);color:#991b1b;font-family:sans-serif;padding:24px;overflow:auto;box-sizing:border-box';
    const copyable = msg + (e.error?.stack ? '\n\n' + e.error.stack : '');
    overlay.innerHTML = '<h2>Viga</h2><p>Rakendus ei kukkunud kokku. Saad selle teate kopeerida või sulgeda ja proovida edasi.</p><pre style="background:#fff;padding:12px;border-radius:8px;font-size:12px;overflow:auto">' + String(msg + (e.error?.stack ? '\n\n' + e.error.stack : '')).replace(/</g, '&lt;') + '</pre><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-copy style="padding:8px 16px;cursor:pointer;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600">Kopeeri veateade</button><button type="button" data-close style="padding:8px 16px;cursor:pointer;background:#6b7280;color:#fff;border:none;border-radius:8px;font-weight:600">Sulge ja jätka</button></div>';
    overlay.querySelector('[data-copy]').addEventListener('click', () => {
      navigator.clipboard.writeText(copyable);
      overlay.querySelector('[data-copy]').textContent = 'Kopeeritud';
    });
    overlay.querySelector('[data-close]').addEventListener('click', () => {
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }
});
