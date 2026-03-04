import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';

function showFatalError(message, detail) {
  const el = document.getElementById('root');
  if (!el) return;
  el.innerHTML = [
    '<div style="padding:24px;font-family:sans-serif;background:#fef2f2;color:#991b1b;min-height:100vh;box-sizing:border-box">',
    '<h2>Viga</h2>',
    '<p><strong>' + (message || 'Tundmatu viga') + '</strong></p>',
    detail ? '<pre style="overflow:auto;font-size:12px;background:#fff;padding:12px;border-radius:8px">' + String(detail).replace(/</g, '&lt;') + '</pre>' : '',
    '<p style="margin-top:16px;font-size:14px">Ava brauseri konsool (F12) rohkem infot jaoks.</p>',
    '</div>'
  ].join('');
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

// Tööaegsed põhiprogrammi vead (nt lazy-load viga) – näita kasutajale
window.addEventListener('error', (e) => {
  if (e.message && !e.filename?.includes('node_modules')) {
    console.error('Uncaught error:', e.message, e.filename, e.lineno);
  }
});
