import React from 'react';
import { CloudDownload, X } from 'lucide-react';
import { AppLogo } from '../AppLogo';

/**
 * Google Drive nooditööde (.nm) valija kujundaja importi jaoks.
 */
export default function ComposerGoogleDriveImportPicker({
  open,
  loading,
  error,
  rows,
  labels,
  locale = 'et',
  onClose,
  onPick,
}) {
  if (!open) return null;

  const dateLocaleTag = locale === 'en' ? 'en-GB' : locale === 'fi' ? 'fi-FI' : 'et-EE';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-sky-200 dark:border-white/20 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="composer-google-import-title"
        aria-modal="true"
      >
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white px-5 py-3 flex items-center justify-between gap-2">
          <h2 id="composer-google-import-title" className="text-base font-bold flex items-center gap-2">
            <CloudDownload className="w-5 h-5 shrink-0" />
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/90 hover:text-white p-1 rounded-lg hover:bg-white/10"
            aria-label={labels.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3 min-h-0">
          <p className="text-sm text-amber-900 dark:text-amber-100/90">{labels.intro}</p>
          {loading && (
            <p className="text-sm text-sky-800 dark:text-sky-200 animate-pulse">{labels.loading}</p>
          )}
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-200/90">{labels.empty}</p>
          )}
          {!loading && rows.length > 0 && (
            <ul className="overflow-y-auto max-h-[50vh] border border-amber-200 dark:border-white/15 rounded-lg divide-y divide-amber-100 dark:divide-white/10">
              {rows.map((row) => (
                <li key={row.id} className="flex items-stretch bg-amber-50/50 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => onPick?.(row)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 hover:bg-amber-100/90 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset transition-colors"
                  >
                    <AppLogo variant="iconMd" alt="" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-amber-950 dark:text-white truncate" title={row.name}>
                        {row.name}
                      </span>
                      <span className="block text-xs text-amber-700 dark:text-amber-200/80 mt-0.5">
                        {row.modifiedTime
                          ? new Date(row.modifiedTime).toLocaleString(dateLocaleTag, { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                        {row.fromShared ? ` · ${labels.shared}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-semibold hover:bg-amber-300 dark:hover:bg-amber-900/60"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );
}
