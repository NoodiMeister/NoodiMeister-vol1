import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Mail, Lock } from 'lucide-react';
import { CloudLoginButtons } from '../components/CloudLogin';
import { AuthErrorBlock } from '../components/AuthErrorBlock';
import { getStorageForLogin, getLoggedInUser, isLoggedIn } from '../services/authStorage';
import { formatAuthError } from '../utils/authError';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/tood';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState(null);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [hashStrippedHint, setHashStrippedHint] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('noodimeister-microsoft-hash-stripped') === '1') {
        sessionStorage.removeItem('noodimeister-microsoft-hash-stripped');
        setHashStrippedHint(true);
      }
    } catch (_) {}
  }, []);

  const setError = (msg, detail) => {
    setMessage(msg);
    setErrorDetail(detail ?? null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    setErrorDetail(null);
    try {
      if (typeof window === 'undefined') {
        setError('Brauser ei toeta salvestust. Proovi teist brauserit.', null);
        return;
      }
      const storageOk = getStorageForLogin(stayLoggedIn);
      if (!storageOk) {
        setError('Brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit või lülita privaatne režiim välja.', null);
        return;
      }
      if (typeof localStorage === 'undefined') {
        setError('Brauser ei toeta salvestust. Proovi teist brauserit.', null);
        return;
      }
      let users = [];
      let raw;
      try {
        raw = localStorage.getItem('noodimeister-users');
        users = JSON.parse(raw || '[]');
      } catch (parseErr) {
        console.error('[LoginPage] localStorage.getItem või JSON.parse viga:', parseErr?.message, { rawType: typeof raw });
        const payload = formatAuthError('e-mail/parool', { message: 'Andmeid ei saanud lugeda. Proovi uuesti või tühjenda brauseri andmed.' });
        setError(payload.fullMessage, payload);
        return;
      }
      if (!Array.isArray(users)) {
        console.error('[LoginPage] users ei ole massiiv:', typeof users);
        users = [];
      }
      const user = users.find(u => u && u.email === email && u.password === password);
      if (!user) {
        const payload = formatAuthError('e-mail/parool', { code: 'invalid_credentials', message: 'Vale e-mail või parool.' });
        setError(payload.fullMessage, payload);
        return;
      }
      const storage = getStorageForLogin(stayLoggedIn);
      if (!storage) {
        console.error('[LoginPage] getStorageForLogin tagastas null. stayLoggedIn:', stayLoggedIn, 'window:', typeof window);
        const payload = formatAuthError('brauser', { message: 'Salvestamine ebaõnnestus (brauser võib blokeerida andmeid). Proovi teist brauserit või lülita privaatse režiimi välja.' });
        setError(payload.fullMessage, payload);
        return;
      }
      storage.setItem('noodimeister-logged-in', JSON.stringify({ email: user.email, name: user.name }));
      // Vercel fix: suuna alles siis, kui auth on kinnitatud (loe tagasi), et /app ei laadi enne kui isLoggedIn() töötab
      const confirmedUser = getLoggedInUser();
      const loggedIn = isLoggedIn();
      if (!confirmedUser?.email || !loggedIn) {
        console.error('[LoginPage] Pärast salvestust auth ei kinnitunud:', { confirmedUser: !!confirmedUser, hasEmail: !!confirmedUser?.email, isLoggedIn: loggedIn });
        setError('Sisselogimine salvestati, kuid kinnitamine ebaõnnestus. Proovi uuesti.', null);
        return;
      }
      setMessage('Sisselogimine õnnestus.');
      setErrorDetail(null);
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            navigate(safeRedirect, { replace: true });
          } catch (navErr) {
            const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
            const path = (base.replace(/\/$/, '') || '') + safeRedirect;
            window.location.assign(window.location.origin + path);
          }
        }, 400);
      });
    } catch (err) {
      console.error('[LoginPage] Ootamata viga sisselogimisel:', err?.message, err);
      const payload = formatAuthError('e-mail/parool', err);
      setError(payload.fullMessage, payload);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <Link to="/" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 font-medium">Tagasi esilehele</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 dark:from-zinc-800 dark:to-zinc-900 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <LogIn className="w-6 h-6" /> Logi sisse
            </h1>
            <p className="text-slate-200 dark:text-white/80 text-sm mt-1">Kontoga saad noodiprojekte hallata ja soovi korral salvestada pilve (nt Google Drive). Ilma kontota saad tööriista kasutada ja faili kohalikult salvestada.</p>
          </div>
          <div className="px-8 pt-6 pb-2">
            {hashStrippedHint && (
              <div className="rounded-lg bg-sky-50 dark:bg-white/10 border border-sky-200 dark:border-white/20 p-3 text-sm text-sky-800 dark:text-white mb-3">
                Microsofti sisselogimine avati selles aknas. Lubage hüpikaknad (pop-up) saidi jaoks ja proovige Microsofti nuppu uuesti.
              </div>
            )}
            <div className="rounded-lg bg-amber-50 dark:bg-white/10 border border-amber-200/60 dark:border-white/20 p-3 text-sm text-amber-800/90 dark:text-white">
              <strong>Salvestus:</strong> kohalik fail või pilv (sisselogimisel Google'iga saad hiljem salvestada Google Drivesse).
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {message && (
              <AuthErrorBlock
                message={message}
                errorDetail={errorDetail}
                isSuccess={message === 'Sisselogimine õnnestus.'}
              />
            )}
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-white/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@näide.ee"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-black/50 text-amber-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Parool</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-white/70" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parool"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-black/50 text-amber-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 dark:border-white/30 text-amber-600 focus:ring-amber-500 dark:focus:ring-white/30"
              />
              <span className="text-sm text-amber-800 dark:text-white">Jäta mind meelde</span>
            </label>
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-slate-600 dark:bg-white text-slate-100 dark:text-black font-bold hover:bg-slate-500 dark:hover:bg-white/90 shadow-md transition-all"
            >
              Logi sisse
            </button>
            <CloudLoginButtons
              mode="login"
              stayLoggedIn={stayLoggedIn}
              onError={(payload) => setError(payload.fullMessage, payload)}
            />
            <p className="text-center text-sm text-amber-700 dark:text-white/80">
              Pole kontot? <Link to="/registreeru" className="font-semibold text-amber-800 dark:text-white hover:underline">Registreeru</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
