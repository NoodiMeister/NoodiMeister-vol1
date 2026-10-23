import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '../i18n';
import { getHowToGuideContent } from '../content/howToGuideContent';

function getLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export default function HowToPage() {
  const [locale] = useState(getLocale);
  const [activeQa, setActiveQa] = useState(null);
  const content = useMemo(() => getHowToGuideContent(locale), [locale]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center rounded-lg border border-amber-300 dark:border-white/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
          >
            {content.backToApp}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-white mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          {content.pageTitle}
        </h1>
        <p className="text-sm sm:text-base text-amber-800/90 dark:text-white/90 mb-7">
          {content.intro}
        </p>

        <section className="space-y-6">
          {content.sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-white">
                {section.title}
              </h2>
              {section.qa.map((item) => (
                <article
                  key={item.q}
                  className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-5 sm:p-6"
                >
                  <h3 className="text-lg sm:text-xl font-semibold text-amber-900 dark:text-white mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-amber-900/95 dark:text-white/90 mb-3">
                    {(item.steps && item.steps[0]) || item.a}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveQa(item)}
                    className="inline-flex items-center rounded-lg border border-amber-300 dark:border-white/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
                  >
                    {content.openGuide}
                  </button>
                </article>
              ))}
            </div>
          ))}
        </section>
      </main>

      {activeQa && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white dark:bg-zinc-900 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-white">
                {activeQa.q}
              </h2>
              <button
                type="button"
                onClick={() => setActiveQa(null)}
                className="inline-flex items-center rounded-lg border border-amber-300 dark:border-white/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
              >
                {content.closeGuide}
              </button>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200 mb-2">
              {content.stepsTitle}
            </h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-amber-900/95 dark:text-white/90">
              {(activeQa.steps || [activeQa.a]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {(activeQa.images || []).length > 0 && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200 mt-6 mb-2">
                  {content.visualsTitle}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeQa.images.map((image) => (
                    <figure key={`${activeQa.q}-${image.src}`} className="rounded-xl border border-amber-200/70 dark:border-white/20 p-3 bg-amber-50/40 dark:bg-zinc-800/40">
                      <img src={image.src} alt={image.caption} className="w-full h-auto rounded-lg" />
                      <figcaption className="mt-2 text-xs sm:text-sm text-amber-800 dark:text-white/80">
                        {image.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
