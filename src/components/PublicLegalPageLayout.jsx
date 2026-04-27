import React from 'react';
import { Link } from 'react-router-dom';
import { AppLogo } from './AppLogo';

/**
 * Avalik leht: privaatsus / kasutustingimused (sama päis kui Teave lehel).
 */
export function PublicLegalPageLayout({ title, backToApp, relatedLink, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center min-w-0" aria-label="Noodimeister avaleht">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 text-sm">
            {relatedLink ? (
              <Link
                to={relatedLink.href}
                className="text-amber-800 dark:text-amber-200/95 hover:underline font-medium"
              >
                {relatedLink.label}
              </Link>
            ) : null}
            <Link
              to="/app"
              className="inline-flex items-center rounded-lg border border-amber-300 dark:border-white/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
            >
              {backToApp}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1
          className="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-white mb-6 sm:mb-8"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {title}
        </h1>
        <article
          className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-5 sm:p-6"
        >
          <div className="space-y-3 text-sm sm:text-base leading-relaxed text-amber-900/95 dark:text-white/90">
            {children}
          </div>
        </article>
      </main>
    </div>
  );
}
