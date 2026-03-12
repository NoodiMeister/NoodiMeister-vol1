/**
 * Ühekordne administraatori registreerimine: noodimeister.ee/administraator/register
 * Ainult üks administraatori konto saab siin registreerida. Pärast seda leht ei luba uut registreerimist.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export default function AdminRegistrationPage() {
  const [status, setStatus] = useState(null); // { alreadyDone, adminEmail? }
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`${getApiBase()}/api/admin/registration-status`)
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ alreadyDone: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/register-once`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      setSubmitLoading(false);
      if (res.ok && data.ok) {
        setSuccess(true);
        setStatus({ alreadyDone: true, adminEmail: data.email });
      } else {
        setError(data.error || 'Viga');
      }
    } catch (err) {
      setSubmitLoading(false);
      setError(err?.message || 'Võrguviga');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600 mb-4" />
        <p className="text-slate-600 dark:text-white/70">Laen…</p>
      </div>
    );
  }

  if (status?.alreadyDone && !success) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-900">
        <header className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-slate-600 dark:text-white/80 font-medium">← NoodiMeister</Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-8 text-center shadow-lg">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Administraator on juba registreeritud</h1>
            <p className="text-sm text-slate-600 dark:text-white/70 mb-2">
              Rohkem administraatori kontosid selle lehe kaudu lisada ei saa.
            </p>
            {status.adminEmail && (
              <p className="text-sm text-slate-500 dark:text-white/60 mb-6">
                Registreeritud konto: <strong>{status.adminEmail}</strong>
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
              Logi sisse <strong>sama e-mailiga</strong> (konto peab olema loodud tavalisel registreerimise lehel või Google/Microsoftiga) ja mine seejärel lehele <Link to="/administraator" className="text-amber-600 hover:underline font-medium">/administraator</Link>.
            </p>
            <Link
              to="/administraator"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-500"
            >
              <Shield className="w-4 h-4" /> Administraatori lehele
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-900">
        <header className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-slate-600 dark:text-white/80 font-medium">← NoodiMeister</Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-8 text-center shadow-lg">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Administraator registreeritud</h1>
            <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
              Konto <strong>{email.trim() || status?.adminEmail}</strong> on nüüd ainus administraatori konto. Järgmise sammuna loo (kui pole veel) tavaline NoodiMeisteri konto <strong>sama e-mailiga</strong> – kas <Link to="/registreeru" className="text-amber-600 hover:underline">registreeru</Link> või logi sisse Google/Microsoftiga selle e-mailiga. Seejärel mine <Link to="/administraator" className="text-amber-600 hover:underline font-medium">/administraator</Link> ja sisesta äsja valitud administraatori parool.
            </p>
            <Link
              to="/administraator"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-500"
            >
              <Shield className="w-4 h-4" /> Administraatori lehele
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-900">
      <header className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-slate-600 dark:text-white/80 font-medium">← NoodiMeister</Link>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-600" />
            Ühekordne administraatori registreerimine
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
            Sellel lehel saab registreerida <strong>ainult ühe</strong> administraatori konto. Pärast registreerimist ei saa keegi teine siin enam kontot luua. Sul peab olema salajane võti (ADMIN_SECRET).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Salajane võti (ADMIN_SECRET)</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Administraatori e-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="sinu@email.ee"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500">Sama e-mailiga pead hiljem NoodiMeisterisse sisse logima (registreeru või Google/Microsoft).</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Administraatori parool (min 8 tähemärki)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-slate-500">Seda parooli sisestad /administraator lehel pärast sisselogimist.</p>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full py-2 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              Registreeri administraator
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500 dark:text-white/60">
            Leht on peidetud (menüüs linki pole). Aadress: <strong>/administraator/register</strong>. Pärast registreerimist hoia see aadress ja ADMIN_SECRET salajane.
          </p>
        </div>
      </main>
    </div>
  );
}
