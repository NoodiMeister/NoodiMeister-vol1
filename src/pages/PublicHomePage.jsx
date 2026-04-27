import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import { FileMusic, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '../i18n';

function getLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const COPY = {
  et: {
    tagline: 'Noodigraafika programm veebis — õpetajatele, õppijatele ja harrastajatele',
    ctaIntro: 'Sissejuhatus (demo heli + logo)',
    ctaApp: 'Ava tööriist',
    navTeave: 'Teave',
    navPriv: 'Privaatsus',
    navTerms: 'Kasutustingimused',
    navHow: 'Kuidas teha?',
    legalNote: 'Noodimeister: noodistiku loomine ja toimetamine brauseris. Sisselogimine ei ole nõutav tutvumiseks.',
  },
  en: {
    tagline: 'Notation in the browser — for teachers, learners, and musicians',
    ctaIntro: 'Intro (audio + logo)',
    ctaApp: 'Open editor',
    navTeave: 'About',
    navPriv: 'Privacy',
    navTerms: 'Terms of use',
    navHow: 'How to',
    legalNote: 'Noodimeister: write and edit scores in the browser. Sign-in is not required to explore the intro.',
  },
  fi: {
    tagline: 'Nuotintaminen verkkoselaimessa – opettajille, opiskelijoille ja harrastajille',
    ctaIntro: 'Intro (ääni + logo)',
    ctaApp: 'Avaa työkalu',
    navTeave: 'Tietoa',
    navPriv: 'Tietosuoja',
    navTerms: 'Käyttöehdot',
    navHow: 'Miten',
    legalNote: 'Noodimeister: nuottien kirjoitus ja muokkaus selaimessa. Tuttustumiseen ei vaadita kirjautumista.',
  },
};

export default function PublicHomePage() {
  const [locale] = useState(getLocale);
  const t = useMemo(() => {
    const n = String(locale).toLowerCase();
    if (n.startsWith('et')) return COPY.et;
    if (n.startsWith('fi')) return COPY.fi;
    return COPY.en;
  }, [locale]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center min-w-0">
            <AppLogo variant="header" alt="NoodiMeister" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2 text-sm">
            <Link
              to="/teave"
              className="px-2.5 py-1.5 rounded-lg text-amber-900 dark:text-white/95 hover:bg-amber-100 dark:hover:bg-white/10"
            >
              {t.navTeave}
            </Link>
            <Link
              to="/privaatsus"
              className="px-2.5 py-1.5 rounded-lg text-amber-900 dark:text-white/95 hover:bg-amber-100 dark:hover:bg-white/10"
            >
              {t.navPriv}
            </Link>
            <Link
              to="/tingimused"
              className="px-2.5 py-1.5 rounded-lg text-amber-900 dark:text-white/95 hover:bg-amber-100 dark:hover:bg-white/10"
            >
              {t.navTerms}
            </Link>
            <Link
              to="/kuidas"
              className="px-2.5 py-1.5 rounded-lg text-amber-900 dark:text-white/95 hover:bg-amber-100 dark:hover:bg-white/10"
            >
              {t.navHow}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        <h1
          className="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-white mb-3"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          NoodiMeister
        </h1>
        <p className="text-lg text-amber-800/90 dark:text-white/85 mb-8 leading-relaxed">{t.tagline}</p>
        <p className="text-sm text-amber-800/80 dark:text-white/70 mb-8 border-l-2 border-amber-400/80 pl-3">
          {t.legalNote}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Link
            to="/demo-intro"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-500 dark:border-amber-400/80 bg-amber-600 text-white font-semibold px-6 py-3.5 shadow-md hover:bg-amber-500 transition-colors"
          >
            <FileMusic className="w-5 h-5 shrink-0" />
            {t.ctaIntro}
            <ArrowRight className="w-4 h-4 shrink-0 opacity-90" />
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 dark:border-white/25 bg-white/90 dark:bg-zinc-900 text-amber-900 dark:text-white font-semibold px-6 py-3.5 hover:bg-amber-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {t.ctaApp}
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-200/90 hover:underline">
              <LogIn className="w-4 h-4" /> Logi sisse
            </Link>
          </li>
          <li>
            <Link to="/registreeru" className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-200/90 hover:underline">
              <UserPlus className="w-4 h-4" /> Registreeru
            </Link>
          </li>
        </ul>
      </main>

      <footer className="mt-auto border-t border-amber-200/50 dark:border-white/15 bg-white/60 dark:bg-zinc-950/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-sm text-amber-900/85 dark:text-white/75 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="font-medium">Noodimeister · La Stravaganza OÜ</span>
          <nav className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-1" aria-label="Juriidiline">
            <Link to="/privaatsus" className="hover:underline">
              {t.navPriv}
            </Link>
            <Link to="/tingimused" className="hover:underline">
              {t.navTerms}
            </Link>
            <Link to="/teave" className="hover:underline">
              {t.navTeave}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
