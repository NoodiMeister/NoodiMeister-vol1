import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileMusic, Cloud, UserPlus, LogIn, PenTool, Save, Share2, Settings, ChevronDown, Info } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, getTranslations } from '../i18n';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import { SHOW_SUPPORT_AND_PRICING_UI } from '../config/productFlags';

export default function LandingPage() {
  const [locale] = useState(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const store = useNoodimeisterOptional();
  const themeMode = store?.theme?.mode ?? 'light';
  const setThemeMode = (mode) => { if (store?.setTheme) store.setTheme(mode); };
  const t = useMemo(() => getTranslations(locale), [locale]);
  const aboutLabel = locale === 'en' ? 'About' : locale === 'fi' ? 'Tietoa' : 'Teave';

  useEffect(() => {
    const close = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    if (settingsOpen) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [settingsOpen]);

  const setLocale = (code) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
      window.location.reload();
    } catch (_) {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <nav className="flex items-center gap-3" ref={settingsRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm bg-amber-100/80 dark:bg-white/10 text-amber-900 dark:text-white border border-amber-200 dark:border-white/20 hover:bg-amber-200/80 dark:hover:bg-white/20 transition-colors"
                  title={t['settings.title'] || 'Seaded'}
                  aria-expanded={settingsOpen}
                >
                  <Settings className="w-4 h-4" />
                  <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </button>
                {settingsOpen && (
                  <div className="absolute right-0 top-full mt-1 min-w-[220px] py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200 dark:border-white/20 shadow-xl z-50">
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-white/80 uppercase tracking-wider">{t['app.language'] || 'Keel'}</div>
                    <div className="flex gap-0.5 px-2 pb-2">
                      {LOCALES.map(({ code, name }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => { setLocale(code); setSettingsOpen(false); }}
                          className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${locale === code ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                          title={name}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-amber-200 dark:border-white/20 my-1" />
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-white/80 uppercase tracking-wider">{t['app.theme'] || 'Värvirežiim'}</div>
                    <div className="flex gap-1 px-2 pb-1">
                      <button
                        type="button"
                        onClick={() => { setThemeMode('light'); setSettingsOpen(false); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'light' ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                      >
                        {t['theme.light'] || 'Hele'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setThemeMode('dark'); setSettingsOpen(false); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'dark' ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                      >
                        {t['theme.dark'] || 'Tume'}
                      </button>
                    </div>
                    <div className="border-t border-amber-200 dark:border-white/20 my-1" />
                    <Link
                      to="/about"
                      onClick={() => setSettingsOpen(false)}
                      className="w-full inline-flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-amber-800 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10 transition-colors"
                    >
                      <Info className="w-4 h-4" /> {aboutLabel}
                    </Link>
                  </div>
                )}
              </div>
              {SHOW_SUPPORT_AND_PRICING_UI ? (
                <Link
                  to="/hinnakiri"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
                >
                  {t['landing.pricing']}
                </Link>
              ) : null}
            </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 py-12 sm:py-16">
        <section className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 dark:text-white mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            {t['landing.heroTitle']}
          </h1>
          <p className="text-lg sm:text-xl text-amber-800/90 dark:text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t['landing.heroSubtitle']}
          </p>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link
              to="/demo-noodid"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              <FileMusic className="w-5 h-5" /> {t['landing.demoVersion']}
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-amber-400 dark:border-white/30 bg-white dark:bg-zinc-900 text-amber-800 dark:text-white font-semibold hover:bg-amber-50 dark:hover:bg-white/10 transition-colors"
              >
                <LogIn className="w-5 h-5" /> {t['landing.logIn']}
              </Link>
              <Link
                to="/registreeru"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-amber-400 dark:border-white/30 bg-white dark:bg-zinc-900 text-amber-800 dark:text-white font-semibold hover:bg-amber-50 dark:hover:bg-white/10 transition-colors"
              >
                <UserPlus className="w-5 h-5" /> {t['landing.createAccount']}
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-amber-700/80 dark:text-white/70">
            {t['landing.demoHint']}
          </p>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-amber-900 dark:text-white mb-8 text-center" style={{ fontFamily: 'Georgia, serif' }}>
            {t['landing.howItWorks']}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white/80 dark:bg-zinc-900 dark:border-white/20 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
                <PenTool className="w-6 h-6 text-amber-600 dark:text-white" />
              </div>
              <h3 className="font-semibold text-amber-900 dark:text-white mb-1">{t['landing.step1Title']}</h3>
              <p className="text-sm text-amber-800/80 dark:text-white/80">{t['landing.step1Desc']}</p>
            </div>
            <div className="bg-white/80 dark:bg-zinc-900 dark:border-white/20 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
                <Save className="w-6 h-6 text-amber-600 dark:text-white" />
              </div>
              <h3 className="font-semibold text-amber-900 dark:text-white mb-1">{t['landing.step2Title']}</h3>
              <p className="text-sm text-amber-800/80 dark:text-white/80">{t['landing.step2Desc']}</p>
            </div>
            <div className="bg-white/80 dark:bg-zinc-900 dark:border-white/20 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
                <Share2 className="w-6 h-6 text-amber-600 dark:text-white" />
              </div>
              <h3 className="font-semibold text-amber-900 dark:text-white mb-1">{t['landing.step3Title']}</h3>
              <p className="text-sm text-amber-800/80 dark:text-white/80">{t['landing.step3Desc']}</p>
            </div>
          </div>
        </section>

        {/* Storage options */}
        <section className="max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-amber-900 dark:text-white mb-6 text-center" style={{ fontFamily: 'Georgia, serif' }}>
            {t['landing.storageOptions']}
          </h2>
          <div className="bg-white/80 dark:bg-zinc-900 dark:border-white/20 rounded-2xl p-6 sm:p-8 border border-amber-200/60 shadow-sm">
            <ul className="space-y-4 text-amber-800 dark:text-white">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-white/10 flex items-center justify-center text-amber-700 dark:text-white font-semibold text-sm">1</span>
                <div>
                  <strong>{t['landing.localStorage']}</strong> — {t['landing.localStorageDesc']}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-white/10 flex items-center justify-center text-amber-700 dark:text-white font-semibold text-sm">2</span>
                <div>
                  <strong>{t['landing.accountStorage']}</strong> — {t['landing.accountStorageDesc']}
                </div>
              </li>
            </ul>
            <p className="mt-4 text-sm text-amber-700/80 dark:text-white/70 border-t border-amber-200/60 dark:border-white/20 pt-4">
              {t['landing.privacyNote']}
            </p>
          </div>
        </section>

        {/* Features strip */}
        <section className="border-t border-amber-200/60 dark:border-white/20 bg-white/50 dark:bg-black py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-amber-800 dark:text-white">
            <span className="flex items-center gap-2 font-medium">
              <FileMusic className="w-5 h-5 text-amber-600 dark:text-white" /> {t['landing.featuresTraditional']}
            </span>
            <span className="flex items-center gap-2 font-medium">
              <Cloud className="w-5 h-5 text-amber-600 dark:text-white" /> {t['landing.featuresCloud']}
            </span>
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 py-6 text-center text-sm text-amber-700/80 dark:text-white/70 border-t border-amber-200/40 dark:border-white/20">
        {t['landing.footerTagline']}
        <p className="mt-2">{t['landing.questionsContact']} <a href="mailto:info@la-stravaganza.com" className="underline hover:text-amber-800 dark:hover:text-white">info@la-stravaganza.com</a></p>
      </footer>
    </div>
  );
}
