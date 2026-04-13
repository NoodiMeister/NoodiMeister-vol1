import React, { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, KeyRound } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { useForceLightTheme } from '../hooks/useForceLightTheme';
import { resetPasswordWithToken } from '../services/authServer';

export default function ResetPasswordPage() {
  useForceLightTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirm) {
      setError('Paroolid ei kattu.');
      return;
    }
    if (password.length < 8) {
      setError('Parool peab olema vähemalt 8 tähemärki.');
      return;
    }
    if (!token) {
      setError('Puudub kehtiv link. Taotle uus taastamislink.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordWithToken(token, password);
      if (res.networkError) {
        setError('Ei saanud serveriga ühendust.');
        return;
      }
      if (res.ok && res.data?.ok) {
        setMessage(res.data.message || 'Parool on uuendatud.');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
        return;
      }
      setError(res.data?.error || 'Parooli uuendamine ebaõnnestus.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <Link to="/login" className="text-amber-700 dark:text-white hover:underline font-medium">
            Sisselogimine
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <KeyRound className="w-6 h-6" /> Uus parool
            </h1>
            <p className="text-slate-200 text-sm mt-1">Sisesta uus parool kohaliku konto jaoks.</p>
          </div>
          {!token ? (
            <div className="p-8 space-y-4">
              <p className="text-red-700 text-sm">Lingis puudub token. Ava link e-kirjast või taotle uus taastamine.</p>
              <Link to="/parool/taasta" className="inline-block text-amber-800 font-semibold hover:underline">
                Taotle uus link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              {message && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm p-3">{message}</div>
              )}
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm p-3">{error}</div>}
              <div>
                <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Uus parool</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500"
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Korda parooli</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500"
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-slate-600 text-white font-bold hover:bg-slate-500 disabled:opacity-60 shadow-md"
              >
                {loading ? 'Salvestan…' : 'Salvesta uus parool'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
