/**
 * Peidetud administraatori leht: noodimeister.ee/administraator
 * Nõuab: sisselogitud kasutaja, kelle e-mail on ADMIN_EMAILS nimekirjas, ja administraatori parooli.
 * Parool tuleb vahetada iga 3 kuud.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, CheckCircle, AlertCircle, Lock, KeyRound, List, ExternalLink } from 'lucide-react';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import * as authStorage from '../services/authStorage';
import { SHOW_SUPPORT_AND_PRICING_UI } from '../config/productFlags';

const JWT_STORAGE_KEY = 'noodimeister-admin-jwt';
const PASSWORD_CHANGE_MONTHS = 3;

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export default function AdminGrantSupportPage() {
  const navigate = useNavigate();
  const ctx = useNoodimeisterOptional();
  const user = ctx?.user;
  const email = user?.email?.trim()?.toLowerCase() || '';

  const [step, setStep] = useState('loading'); // loading | notLoggedIn | notAllowed | setInitial | enterPassword | changePassword | grant
  const [status, setStatus] = useState(null); // { allowed, hasPasswordSet, mustChangePassword }
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(JWT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [supportUntil, setSupportUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [supportList, setSupportList] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      setStep('notLoggedIn');
      return;
    }
    let cancelled = false;
    setStep('loading');
    fetch(`${getApiBase()}/api/admin/status?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        if (!data.allowed) {
          setStep('notAllowed');
          return;
        }
        if (!data.hasPasswordSet) {
          setStep('setInitial');
          return;
        }
        if (data.mustChangePassword) {
          setStep(token ? 'changePassword' : 'enterPassword');
          return;
        }
        if (token) {
          setStep('grant');
          return;
        }
        setStep('enterPassword');
      })
      .catch(() => {
        if (!cancelled) setStep('notAllowed');
      });
    return () => { cancelled = true; };
  }, [email]);

  const saveToken = (t) => {
    setToken(t);
    try {
      if (t) sessionStorage.setItem(JWT_STORAGE_KEY, t);
      else sessionStorage.removeItem(JWT_STORAGE_KEY);
    } catch (_) {}
  };

  const handleSetInitial = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/set-initial-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secret, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        saveToken(data.token);
        setStep('grant');
        setSecret('');
        setNewPassword('');
      } else {
        setError(data.error || 'Viga');
      }
    } catch (err) {
      setError(err?.message || 'Võrguviga');
    }
    setLoading(false);
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(status?.hasPasswordSet ? {} : { secret }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        saveToken(data.token);
        if (data.mustChangePassword) {
          setStep('changePassword');
          setPassword('');
        } else {
          setStep('grant');
          setPassword('');
        }
      } else {
        setError(data.error || 'Vale parool või viga');
      }
    } catch (err) {
      setError(err?.message || 'Võrguviga');
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        saveToken(data.token);
        setStep('grant');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setError(data.error || 'Viga');
      }
    } catch (err) {
      setError(err?.message || 'Võrguviga');
    }
    setLoading(false);
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    const emails = emailsText
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && s.includes('@'));
    if (emails.length === 0) {
      setError('Sisesta vähemalt üks e-mail.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/grant-support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ emails, supportUntil, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (res.ok && data.ok) {
        setResult(data);
        setEmailsText('');
        fetchSupportList();
      } else {
        setError(data.error || 'Viga');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Võrguviga');
    }
  };

  const handleLogout = () => {
    saveToken('');
    setStep(email ? 'enterPassword' : 'notLoggedIn');
  };

  const fetchSupportList = useCallback(() => {
    if (!token) return;
    setListLoading(true);
    fetch(`${getApiBase()}/api/admin/list-support`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.list) setSupportList(data.list);
      })
      .catch(() => setSupportList([]))
      .finally(() => setListLoading(false));
  }, [token]);

  useEffect(() => {
    if (step === 'grant' && token) fetchSupportList();
  }, [step, token, fetchSupportList]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600 mb-4" />
        <p className="text-slate-600 dark:text-white/70">Laen…</p>
      </div>
    );
  }

  if (step === 'notLoggedIn') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900 px-6">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-8 text-center shadow-lg">
          <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Administraator</h1>
          <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
            Selle lehe kasutamiseks pead olema sisselogitud.
          </p>
          <Link
            to={`/login?redirect=${encodeURIComponent('/administraator')}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500"
          >
            Logi sisse
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'notAllowed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900 px-6">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-8 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ligipääs piiratud</h1>
          <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
            Sul ei ole administraatori õigusi.
          </p>
          <Link to="/" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-600 text-white font-medium hover:bg-slate-500">
            Tagasi
          </Link>
        </div>
      </div>
    );
  }

  const layout = (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-900">
      <header className="flex-shrink-0 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-slate-600 dark:text-white/80 font-medium">← NoodiMeister</Link>
          <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/60">
            <Shield className="w-4 h-4" /> Administraator
            {email && <span className="hidden sm:inline">({email})</span>}
          </span>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <div className="max-w-xl mx-auto">
          {step === 'setInitial' && (
            <>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-amber-600" />
                Esialgne parooli seadistamine
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
                Sisesta salajane võti (ADMIN_SECRET keskkonnamuutujast) ja vali administraatori parool (vähemalt 8 tähemärki). Parooli tuleb vahetada iga {PASSWORD_CHANGE_MONTHS} kuu järel.
              </p>
              <form onSubmit={handleSetInitial} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Salajane võti (ADMIN_SECRET)</label>
                  <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" autoComplete="off" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Uus parool (min 8 tähemärki)</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" autoComplete="new-password" />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Seadista parool
                </button>
              </form>
            </>
          )}

          {step === 'enterPassword' && (
            <>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Lock className="w-6 h-6 text-amber-600" />
                Sisesta administraatori parool
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
                Parool tuleb vahetada iga {PASSWORD_CHANGE_MONTHS} kuu järel. Kui süsteem palub, vaheta parool pärast sisselogimist.
              </p>
              <form onSubmit={handleVerifyPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Parool</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" autoComplete="current-password" />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Jätka
                </button>
              </form>
            </>
          )}

          {step === 'changePassword' && (
            <>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-amber-600" />
                Vaheta parool
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
                Administraatori parool tuleb vahetada iga {PASSWORD_CHANGE_MONTHS} kuu järel. Sisesta praegune ja uus parool.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Praegune parool</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" autoComplete="current-password" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Uus parool (min 8 tähemärki)</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" autoComplete="new-password" />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Vaheta parool
                </button>
              </form>
            </>
          )}

          {step === 'grant' && (
            <>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Shield className="w-6 h-6 text-amber-600" />
                Administraatori töölaud
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/70 mb-4">
                Väljalogimiseks: <button type="button" onClick={handleLogout} className="underline text-amber-600 hover:text-amber-500">logi administraatorist välja</button>.
              </p>

              <div className="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-white mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Kogu rakendus – lingid
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/60 mb-3">Administraatoril on ligipääs kõigile lehtedele. Avage vajadusel uues vahekaardis.</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link to="/" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Avaleht</Link>
                  <Link to="/tood" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Minu tööd</Link>
                  <Link to="/app" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Tööriist (noodiredaktor)</Link>
                  <Link to="/konto" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Minu konto</Link>
                  <Link to="/login" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Logi sisse</Link>
                  <Link to="/registreeru" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Registreeru</Link>
                  {SHOW_SUPPORT_AND_PRICING_UI ? (
                    <>
                      <Link to="/hinnakiri" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Hinnakiri</Link>
                      <Link to="/toeta" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Toeta</Link>
                    </>
                  ) : null}
                  <Link to="/gallery" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Sümboligalerii</Link>
                  <Link to="/gallery/figurenotes" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Figuurnoodi galerii</Link>
                  <Link to="/piano" className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-zinc-600" target="_blank" rel="noopener noreferrer">Klaver</Link>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-white mb-2 flex items-center gap-2">
                  <List className="w-4 h-4" /> Toetuse saanud kontod
                </h2>
                {listLoading ? (
                  <p className="text-sm text-slate-500">Laen nimekirja…</p>
                ) : supportList.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-white/60">Ühtegi toetust pole veel antud või nimekiri on tühi.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-white/20 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-white/80">
                        <tr>
                          <th className="px-3 py-2 font-medium">E-mail</th>
                          <th className="px-3 py-2 font-medium">Kehtib kuni</th>
                          <th className="px-3 py-2 font-medium">Märkus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {supportList.map((row) => (
                          <tr key={row.email} className="bg-white dark:bg-zinc-800/50">
                            <td className="px-3 py-2 font-mono text-slate-800 dark:text-white">{row.email}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-white/80">{row.supportUntil || '—'}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-white/60 max-w-[180px] truncate" title={row.note || ''}>{row.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <h2 className="text-sm font-semibold text-slate-700 dark:text-white mb-2">Anna täisfunktsioon (e-arve / organisatsioon)</h2>
              <form onSubmit={handleGrant} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">E-mailid (üks reale või komadega)</label>
                  <textarea rows={5} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} placeholder="opetaja@kool.ee&#10;opilane@kool.ee" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Toetus kehtib kuni</label>
                  <input type="date" value={supportUntil} onChange={(e) => setSupportUntil(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white mb-1">Märkus (valikuline)</label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="nt Pärnu Päikese kool, arve 2024-001" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
                {result && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Täisfunktsioon antud {result.granted} kontole, kehtib kuni {result.supportUntil}.</p>}
                <button type="submit" disabled={loading} className="w-full py-2 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Anna täisfunktsioon
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <footer className="flex-shrink-0 py-4 text-center text-xs text-slate-500 dark:text-white/50 border-t border-slate-200 dark:border-white/10">
        {SHOW_SUPPORT_AND_PRICING_UI ? (
          <>
            <Link to="/hinnakiri" className="underline">Hinnakiri</Link>
            {' · '}
          </>
        ) : null}
        <Link to="/" className="underline">Avaleht</Link>
      </footer>
    </div>
  );

  return layout;
}
