import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { useForceLightTheme } from '../hooks/useForceLightTheme';
import { requestPasswordReset } from '../services/authServer';

export default function ForgotPasswordPage() {
  useForceLightTheme();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(String(email).trim().toLowerCase());
      if (res.networkError) {
        setError(
          'Ei saanud serveriga ühendust. Kohalikus arenduses lisa vite.config proxy (NM_DEV_API_PROXY) või kasuta tootmise URL-i.'
        );
        return;
      }
      if (res.status === 429) {
        setError('Liiga palju päringuid. Proovi tunni pärast uuesti.');
        return;
      }
      if (res.status === 503) {
        setError(res.data?.error || 'E-kirja saatmine pole seadistatud.');
        return;
      }
      if (res.ok && res.data?.message) {
        setMessage(res.data.message);
        return;
      }
      if (res.ok) {
        setMessage(
          'Kui see e-post on meie juures kohaliku kontoga registreeritud, saadetakse peagi juhised parooli taastamiseks.'
        );
        return;
      }
      setError(res.data?.error || 'Taotlus ebaõnnestus.');
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
            Tagasi sisselogimisele
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <KeyRound className="w-6 h-6" /> Unustasid parooli?
            </h1>
            <p className="text-slate-200 text-sm mt-1">
              Ainult <strong>kohaliku e-posti ja parooliga</strong> registreeritud kontodele. Google/Microsoft parooli muudavad
              vastavad teenused.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {message && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm p-3">{message}</div>
            )}
            {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm p-3">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@näide.ee"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-slate-600 text-white font-bold hover:bg-slate-500 disabled:opacity-60 shadow-md"
            >
              {loading ? 'Saadan…' : 'Saada taastamislink'}
            </button>
            <p className="text-center text-sm text-amber-700">
              <Link to="/login" className="font-semibold text-amber-800 hover:underline">
                Logi sisse
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
