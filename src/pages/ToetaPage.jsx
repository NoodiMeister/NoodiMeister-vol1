import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, LogIn, UserPlus } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import { useForceLightTheme } from '../hooks/useForceLightTheme';

/**
 * Toeta leht – infoleht toetamise kohta.
 * Makselahendus (Stripe jms) viiakse sisse alles pärast esitlust.
 */
export default function ToetaPage() {
  useForceLightTheme();
  const ctx = useNoodimeisterOptional();
  const user = ctx?.user;
  const isLoggedIn = !!user?.email;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
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
            Toeta NoodiMeistrit
          </h1>
          <p className="text-amber-800/90 dark:text-white/80 text-center mb-8 text-sm">
            Igal kasutajal on võimalik NoodiMeistri arendamist toetada. Toetuse ajal on sul täisfunktsioon; loodud tööd jäävad alles ka pärast toetuse lõppu.
          </p>

          <div className="rounded-xl bg-amber-100/80 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700/50 p-6 mb-8 text-center">
            <Heart className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-amber-900 dark:text-white mb-2">
              Makselahendus tuleb peagi
            </h2>
            <p className="text-sm text-amber-800/90 dark:text-white/80">
              Toetamise makseviis (kaart, pangaülekanne) lisatakse pärast esitlust. Seni saad tasuta kontot luua ja NoodiMeistrit kasutada.
            </p>
          </div>

          <p className="text-sm text-amber-700/90 dark:text-white/80 mb-4">
            {isLoggedIn
              ? 'Oled sisse logitud. Kui makse on valmis, saad siit valida toetamise perioodi ja maksta turvaliselt.'
              : 'Registreeru või logi sisse, et kasutada NoodiMeistrit. Toetamise võimalus lisandub peagi.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/hinnakiri"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border-2 border-amber-400 bg-white dark:bg-zinc-900 text-amber-800 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10 transition-colors"
            >
              Vaata hinnakirja
            </Link>
            {!isLoggedIn && (
              <Link
                to="/registreeru"
                className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md transition-all"
              >
                <UserPlus className="w-5 h-5" /> Registreeru tasuta
              </Link>
            )}
          </div>

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
