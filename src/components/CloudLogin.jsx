import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { getStorageForLogin, getStorageForRead, getLoggedInUser, isLoggedIn } from '../services/authStorage';
import { formatAuthError } from '../utils/authError';

const googleClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

const KEY_LOGGED_IN = 'noodimeister-logged-in';
const KEY_GOOGLE_TOKEN = 'noodimeister-google-token';
const KEY_GOOGLE_EXPIRY = 'noodimeister-google-token-expiry';

function useCloudLoginWithProvider(mode = 'login', stayLoggedIn = false, onError) {
  const navigate = useNavigate();

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
            if (mode === 'register') {
              const users = JSON.parse(localStorage.getItem('noodimeister-users') || '[]');
              if (!users.some(u => u.email === profile.email)) {
                users.push({ ...user });
                localStorage.setItem('noodimeister-users', JSON.stringify(users));
              }
            }
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
            console.log('[CloudLogin] Auth kinnitatud, suuname /app poole');
            requestAnimationFrame(() => {
              try {
                if (typeof window !== 'undefined') navigate('/app');
              } catch (navErr) {
                console.warn('[CloudLogin] navigate viga:', navErr);
              }
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
    googleLogin();
  };

  const handleMicrosoftClick = () => {
    alert('Microsofti sisselogimine tuleb tulevikus. Kasuta praegu e-maili ja parooli või Google\'i.');
  };

  const handleAppleClick = () => {
    alert('Apple sisselogimine tuleb tulevikus. Kasuta praegu e-maili ja parooli või Google\'i.');
  };

  return { handleGoogleClick, handleMicrosoftClick, handleAppleClick };
}

function CloudLoginButtonsInner({ mode = 'login', stayLoggedIn = false, onError }) {
  const { handleGoogleClick, handleMicrosoftClick, handleAppleClick } = useCloudLoginWithProvider(mode, stayLoggedIn, onError);
  const label = mode === 'register' ? 'Või registreeru pilveteenusega' : 'Või logi sisse pilveteenusega';

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
          className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium hover:bg-amber-50 hover:border-amber-300 transition-all"
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
          className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium hover:bg-amber-50 hover:border-amber-300 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          Microsoft
        </button>
        <button
          type="button"
          onClick={handleAppleClick}
          className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border-2 border-amber-200 bg-white text-amber-900 font-medium hover:bg-amber-50 hover:border-amber-300 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Apple
        </button>
      </div>
    </div>
  );
}

export function CloudLoginButtons({ mode = 'login', stayLoggedIn = false, onError }) {
  if (!googleClientId) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-amber-200" /></div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-amber-700 font-medium">
              {mode === 'register' ? 'Või registreeru pilveteenusega' : 'Või logi sisse pilveteenusega'}
            </span>
          </div>
        </div>
        <p className="text-xs text-amber-600 text-center">Google: lisa VITE_GOOGLE_CLIENT_ID .env faili.</p>
      </div>
    );
  }
  return <CloudLoginButtonsInner mode={mode} stayLoggedIn={stayLoggedIn} onError={onError} />;
}
