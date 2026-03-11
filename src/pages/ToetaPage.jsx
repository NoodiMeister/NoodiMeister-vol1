import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import { createCheckoutSession } from '../services/supportApi';

const PRICE_PER_MONTH = 5;
const DISCOUNT_12_MONTHS = 55; // 12 kuud soodushinnaga 55 €

const STORAGE_KEY = 'noodimeister-toetus-kuud';

function calcTotal(kuud) {
  if (!Number.isFinite(kuud) || kuud < 1 || kuud > 60) return null;
  return kuud === 12 ? DISCOUNT_12_MONTHS : kuud * PRICE_PER_MONTH;
}

export default function ToetaPage() {
  const [searchParams] = useSearchParams();
  const ctx = useNoodimeisterOptional();
  const user = ctx?.user;
  const isLoggedIn = !!user?.email;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const success = searchParams.get('success') === '1';
  const canceled = searchParams.get('canceled') === '1';

  const preselected = searchParams.get('kuud');
  const [months, setMonths] = useState(() => {
    const k = preselected ? parseInt(preselected, 10) : 1;
    return Number.isFinite(k) && k >= 1 && k <= 60 ? k : 1;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(months));
    } catch (_) {}
  }, [months]);

  const total = calcTotal(months);
  const isValid = total !== null;

  const handleStartCheckout = async () => {
    if (!isValid || !isLoggedIn || !user?.email) return;
    setError('');
    setLoading(true);
    const result = await createCheckoutSession(months, user.email);
    setLoading(false);
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setError(result.error || 'Maksekeskkonna avamine ebaõnnestus.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/hinnakiri" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-white/10 transition-colors">
              Hinnakiri
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-white/10 transition-colors">
              <LogIn className="w-4 h-4" /> Logi sisse
            </Link>
            <Link to="/registreeru" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 shadow-md transition-all">
              <UserPlus className="w-4 h-4" /> Registreeru
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12 sm:py-16">
        <section className="max-w-lg mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 dark:text-white mb-2 text-center" style={{ fontFamily: 'Georgia, serif' }}>
            Vali toetamise periood
          </h1>
          <p className="text-amber-800/90 dark:text-white/80 text-center mb-8 text-sm">
            Sisesta, mitu kuud soovid NoodiMeistrit toetada ja täisfunktsiooni kasutada (1–60 kuud).
          </p>

          <div className="mb-6">
            <label htmlFor="toeta-kuud" className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">
              Kuude arv
            </label>
            <input
              id="toeta-kuud"
              type="number"
              min={1}
              max={60}
              value={months === 0 ? '' : months}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setMonths(0);
                  return;
                }
                const n = parseInt(v, 10);
                if (Number.isFinite(n)) setMonths(Math.max(1, Math.min(60, n)));
              }}
              onBlur={() => { if (months < 1 || months > 60) setMonths(1); }}
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-white/30 bg-white dark:bg-black/50 text-amber-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
              placeholder="nt 6"
            />
            <p className="mt-1 text-xs text-amber-700/80">
              {PRICE_PER_MONTH} € kuus. 12 kuud soodushinnaga {DISCOUNT_12_MONTHS} €.
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200/60 dark:border-white/20 p-4 mb-8">
            <p className="text-sm text-amber-800/90 dark:text-white/80 mb-1">
              {isValid ? `Täisfunktsioon ${months} kuud` : 'Sisesta kuude arv 1–60'}
            </p>
            <p className="text-lg font-bold text-amber-900 dark:text-white">
              Kokku: {isValid ? `${total} €` : '—'}
            </p>
            {months === 12 && isValid && (
              <p className="text-xs text-amber-600 mt-1">12 kuud soodushinnaga</p>
            )}
          </div>

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-sm">
              Täname! Makse õnnestus. Täisfunktsioon on nüüd aktiivne valitud perioodi vältel.
            </div>
          )}
          {canceled && (
            <div className="mb-6 p-4 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-sm">
              Makset ei tehtud. Saad uuesti proovida või valida teise perioodi.
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-amber-700/90 dark:text-white/80 mb-4">
            {isLoggedIn
              ? 'Makse toimub turvaliselt Stripe kaudu (kaart). Toetused lähevad NoodiMeistri arenduse ja ülalpidamise kulude katteks.'
              : 'Pärast registreerumist või sisselogimist saad maksta kaardiga. Toetused lähevad NoodiMeistri arenduse ja ülalpidamise kulude katteks.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={!isValid || loading}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold shadow-md transition-all ${
                  isValid && !loading
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500'
                    : 'bg-amber-200 text-amber-600 cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" />}
                {loading ? 'Suuname maksele…' : 'Maksa kaardiga'}
              </button>
            ) : (
              <Link
                to="/registreeru"
                className={`flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold shadow-md transition-all ${
                  isValid
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500'
                    : 'bg-amber-200 text-amber-600 cursor-not-allowed pointer-events-none'
                }`}
                aria-disabled={!isValid}
              >
                <Heart className="w-5 h-5" />
                Jätka toetamisega (registreeru või logi sisse)
              </Link>
            )}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium border-2 border-amber-400 bg-white text-amber-800 hover:bg-amber-50 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Juba konto? Logi sisse
            </Link>
          </div>

          <p className="mt-4 text-center text-sm text-amber-700/80">
            <Link to="/registreeru" className="underline hover:text-amber-800">Registreeru tasuta</Link> ilma toetamiseta.
          </p>

          <p className="mt-6 text-center text-sm text-amber-700/80">
            <Link to="/hinnakiri" className="underline hover:text-amber-800">Tagasi hinnakirja juurde</Link>
          </p>
        </section>
      </main>

      <footer className="flex-shrink-0 py-6 text-center text-sm text-amber-700/80 border-t border-amber-200/40">
        NoodiMeister — veebis noodistiku loomine. Küsimused? <a href="mailto:info@la-stravaganza.com" className="underline hover:text-amber-800">info@la-stravaganza.com</a>
      </footer>
    </div>
  );
}
