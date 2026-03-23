import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User } from 'lucide-react';
import { CloudLoginButtons } from '../components/CloudLogin';
import { AuthErrorBlock } from '../components/AuthErrorBlock';
import { AppLogo } from '../components/AppLogo';
import { formatAuthError } from '../utils/authError';
import { useForceLightTheme } from '../hooks/useForceLightTheme';
import { getStoredUsers, upsertUserAccount } from '../services/authStorage';

export default function RegisterPage() {
  useForceLightTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
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

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setMessage('');
    setErrorDetail(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorDetail(null);
    if (form.password !== form.confirmPassword) {
      const payload = formatAuthError('registreerimine', { code: 'password_mismatch', message: 'Paroolid ei kattu.' });
      setError(payload.fullMessage, payload);
      return;
    }
    if (form.password.length < 8) {
      const payload = formatAuthError('registreerimine', { code: 'password_too_short', message: 'Parool peab olema vähemalt 8 tähemärki.' });
      setError(payload.fullMessage, payload);
      return;
    }
    try {
      const users = getStoredUsers();
      const normalizedEmail = String(form.email || '').trim().toLowerCase();
      if (users.some((u) => {
        const sameEmail = String(u?.email || '').trim().toLowerCase() === normalizedEmail;
        const isLocalAccount = String(u?.provider || 'local').trim().toLowerCase() === 'local';
        return sameEmail && isLocalAccount;
      })) {
        const payload = formatAuthError('registreerimine', {
          code: 'email_exists',
          message: 'Selle e-mailiga konto on juba olemas. Suuname sisselogimise lehele.'
        });
        setError(payload.fullMessage, payload);
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      upsertUserAccount({
        name: form.name,
        email: normalizedEmail,
        password: form.password,
        provider: 'local',
      }, { provider: 'local' });
      setMessage('Registreerumine õnnestus! Konto on loodud. Suuname sisselogimise lehele…');
      setErrorDetail(null);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      const payload = formatAuthError('registreerimine', err);
      setError(payload.fullMessage, payload);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <Link to="/" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 font-medium">Tagasi esilehele</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-zinc-800 dark:to-zinc-900 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <UserPlus className="w-6 h-6" /> Registreeru
            </h1>
            <p className="text-amber-100 dark:text-white/80 text-sm mt-1">Loo konto, et projekte hallata ja salvestada kohalikult või pilve (Google Drive jms). E-mail + parool või registreeru Google'iga.</p>
          </div>
          <div className="px-8 pt-6 pb-2">
            {hashStrippedHint && (
              <div className="rounded-lg bg-sky-50 dark:bg-white/10 border border-sky-200 dark:border-white/20 p-3 text-sm text-sky-800 dark:text-white mb-3">
                Microsofti sisselogimine avati selles aknas. Lubage hüpikaknad (pop-up) saidi jaoks ja proovige Microsofti nuppu uuesti.
              </div>
            )}
            <div className="rounded-lg bg-amber-50 dark:bg-white/10 border border-amber-200/60 dark:border-white/20 p-3 text-sm text-amber-800/90 dark:text-white">
              <strong>Miks konto?</strong> Projektide üle vaatamine, salvestuskeskkonna valik (kohalik / pilv) ja tulevikus jagamine — kõik ühe konto all.
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {message && (
              <AuthErrorBlock
                message={message}
                errorDetail={errorDetail}
                isSuccess={message.startsWith('Registreerumine õnnestus') || message.startsWith('Konto loodud')}
              />
            )}
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Nimi</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-white/70" />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Sinu nimi"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-black/50 text-amber-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-white/70" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
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
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Vähemalt 8 tähemärki"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-black/50 text-amber-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Korda parooli</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-white/70" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Sisesta parool uuesti"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-black/50 text-amber-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold hover:from-amber-500 hover:to-orange-500 shadow-md transition-all"
            >
              Loo konto
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 dark:border-white/30 text-amber-600 focus:ring-amber-500 dark:focus:ring-white/30"
              />
              <span className="text-sm text-amber-800 dark:text-white">Jäta mind meelde</span>
            </label>
            <CloudLoginButtons
              mode="register"
              stayLoggedIn={stayLoggedIn}
              onError={(payload) => setError(payload.fullMessage, payload)}
            />
            <p className="text-center text-sm text-amber-700 dark:text-white/80">
              Juba konto? <Link to="/login" className="font-semibold text-amber-800 dark:text-white hover:underline">Logi sisse</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
