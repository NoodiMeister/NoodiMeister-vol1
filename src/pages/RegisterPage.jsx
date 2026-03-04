import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music2, UserPlus, Mail, Lock, User } from 'lucide-react';
import { CloudLoginButtons } from '../components/CloudLogin';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setMessage('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setMessage('Paroolid ei kattu.');
      return;
    }
    if (form.password.length < 8) {
      setMessage('Parool peab olema vähemalt 8 tähemärki.');
      return;
    }
    // Praegu salvestame kohalikku (localStorage) – backend võib tulevikus lisada
    try {
      const users = JSON.parse(localStorage.getItem('noodimeister-users') || '[]');
      if (users.some(u => u.email === form.email)) {
        setMessage('Selle e-mailiga konto on juba olemas.');
        return;
      }
      users.push({ name: form.name, email: form.email, password: form.password });
      localStorage.setItem('noodimeister-users', JSON.stringify(users));
      setMessage('Konto loodud. Saad nüüd sisse logida.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setMessage('Midagi läks valesti. Proovi uuesti.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <header className="flex-shrink-0 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-amber-900" style={{ fontFamily: 'Georgia, serif' }}>NoodiMeister</span>
          </Link>
          <Link to="/" className="text-amber-700 hover:text-amber-900 font-medium">Tagasi esilehele</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border-2 border-amber-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <UserPlus className="w-6 h-6" /> Registreeru
            </h1>
            <p className="text-amber-100 text-sm mt-1">Loo konto, et projekte hallata ja salvestada kohalikult või pilve (Google Drive jms). E-mail + parool või registreeru Google’iga.</p>
          </div>
          <div className="px-8 pt-6 pb-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3 text-sm text-amber-800/90">
              <strong>Miks konto?</strong> Projektide üle vaatamine, salvestuskeskkonna valik (kohalik / pilv) ja tulevikus jagamine — kõik ühe konto all.
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.startsWith('Konto loodud') ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {message}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-amber-900 mb-1">Nimi</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Sinu nimi"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@näide.ee"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 mb-1">Parool</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Vähemalt 8 tähemärki"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-amber-900 mb-1">Korda parooli</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Sisesta parool uuesti"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-800">Jää sisse logituks (soovitame välja jätta ühise arvuti puhul)</span>
            </label>
            <CloudLoginButtons mode="register" stayLoggedIn={stayLoggedIn} />
            <p className="text-center text-sm text-amber-700">
              Juba konto? <Link to="/login" className="font-semibold text-amber-800 hover:underline">Logi sisse</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
