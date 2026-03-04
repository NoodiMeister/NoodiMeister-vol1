import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music2, LogIn, Mail, Lock } from 'lucide-react';
import { CloudLoginButtons } from '../components/CloudLogin';
import { getStorageForLogin } from '../services/authStorage';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const users = JSON.parse(localStorage.getItem('noodimeister-users') || '[]');
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        const storage = getStorageForLogin(stayLoggedIn);
        if (storage) {
          storage.setItem('noodimeister-logged-in', JSON.stringify({ email: user.email, name: user.name }));
        }
        setMessage('Sisselogimine õnnestus.');
        setTimeout(() => navigate('/app'), 800);
      } else {
        setMessage('Vale e-mail või parool.');
      }
    } catch (err) {
      setMessage('Midagi läks valesti.');
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
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-8 py-6">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <LogIn className="w-6 h-6" /> Logi sisse
            </h1>
            <p className="text-slate-200 text-sm mt-1">Kontoga saad noodiprojekte hallata ja soovi korral salvestada pilve (nt Google Drive). Ilma kontota saad tööriista kasutada ja faili kohalikult salvestada.</p>
          </div>
          <div className="px-8 pt-6 pb-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3 text-sm text-amber-800/90">
              <strong>Salvestus:</strong> kohalik fail või pilv (sisselogimisel Google’iga saad hiljem salvestada Google Drivesse).
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message === 'Sisselogimine õnnestus.' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {message}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-amber-900 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parool"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-800">Jää sisse logituks (soovitame välja jätta ühise arvuti puhul)</span>
            </label>
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-slate-600 text-white font-bold hover:bg-slate-500 shadow-md transition-all"
            >
              Logi sisse
            </button>
            <CloudLoginButtons mode="login" stayLoggedIn={stayLoggedIn} />
            <p className="text-center text-sm text-amber-700">
              Pole kontot? <Link to="/registreeru" className="font-semibold text-amber-800 hover:underline">Registreeru</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
