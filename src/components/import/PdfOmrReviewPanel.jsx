import React, { useMemo, useState } from 'react';
import { X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { confidenceBand } from '../../import/pdf/omrConstants.js';

function BandDot({ band }) {
  const cls =
    band === 'green'
      ? 'bg-emerald-500'
      : band === 'yellow'
        ? 'bg-amber-400'
        : 'bg-red-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} aria-hidden />;
}

/**
 * Side-by-side review: source page preview + draft confidence markers before create-new apply.
 */
export default function PdfOmrReviewPanel({
  report = null,
  busy = false,
  onBack,
  onConfirmApply,
  onCancel,
}) {
  const pages = report?.pagePreviews || [];
  const [pageIdx, setPageIdx] = useState(0);
  const markers = report?.noteMarkers || [];
  const bands = report?.confidence?.bands || { green: 0, yellow: 0, red: 0 };
  const draft = report?.draftProject;
  const notes = draft?.staves?.[0]?.notes || [];
  const constraints = report?.constraintsApplied || {};

  const activePage = pages[Math.min(pageIdx, Math.max(0, pages.length - 1))] || null;

  const summaryLine = useMemo(() => {
    const title = draft?.songTitle || constraints.title || '—';
    const ts = draft?.timeSignature || constraints.timeSignature;
    return `${title} · ${constraints.instrumentName || draft?.staves?.[0]?.name || '—'} · ${ts?.beats || 4}/${ts?.beatUnit || 4} · ${draft?.keySignature || constraints.keySignature || 'C'}`;
  }, [draft, constraints]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-amber-950/70 dark:bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-omr-review-title"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <h2 id="pdf-omr-review-title" className="text-lg font-bold">
              PDF import — ülevaatus
            </h2>
            <p className="text-xs text-amber-100/90 mt-0.5">{summaryLine}</p>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-50"
            onClick={() => onCancel?.()}
            disabled={busy}
            aria-label="Sulge"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
          {/* Source */}
          <div className="border-b lg:border-b-0 lg:border-r border-amber-100 dark:border-white/10 flex flex-col min-h-0">
            <div className="px-4 py-2 text-sm font-semibold text-amber-900 dark:text-white border-b border-amber-50 dark:border-white/5 flex items-center justify-between">
              <span>Allikas</span>
              {pages.length > 1 && (
                <span className="flex items-center gap-2 text-xs font-normal">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-amber-200 dark:border-white/20"
                    disabled={pageIdx <= 0}
                    onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                  >
                    ‹
                  </button>
                  {pageIdx + 1}/{pages.length}
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-amber-200 dark:border-white/20"
                    disabled={pageIdx >= pages.length - 1}
                    onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
                  >
                    ›
                  </button>
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto p-3 bg-amber-50/40 dark:bg-black/30">
              {activePage?.dataUrl ? (
                <img
                  src={activePage.dataUrl}
                  alt={`PDF leht ${pageIdx + 1}`}
                  className="max-w-full h-auto mx-auto rounded shadow border border-amber-100 dark:border-white/10"
                />
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-200 p-4">
                  Lehe eelvaade puudub (render ebaõnnestus). Mustandit saad siiski üle vaadata.
                </p>
              )}
            </div>
          </div>

          {/* Draft / markers */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 text-sm font-semibold text-amber-900 dark:text-white border-b border-amber-50 dark:border-white/5">
              Muudetav mustand · confidence
            </div>
            <div className="px-4 py-2 flex flex-wrap gap-3 text-xs text-amber-800 dark:text-amber-100 border-b border-amber-50 dark:border-white/5">
              <span className="inline-flex items-center gap-1.5">
                <BandDot band="green" /> OK {bands.green || 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BandDot band="yellow" /> Kontrolli {bands.yellow || 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BandDot band="red" /> Madal / paus {bands.red || 0}
              </span>
              <span className="text-amber-600 dark:text-amber-300">
                Kokku ~{Math.round((report?.confidence?.score || 0) * 100)}%
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(report?.warnings || []).length > 0 && (
                <ul className="space-y-1.5">
                  {report.warnings.map((w, i) => (
                    <li
                      key={`w-${i}`}
                      className="text-xs flex gap-2 text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-zinc-800 rounded-lg px-3 py-2 border border-amber-100 dark:border-white/10"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
                  Noodid ({notes.length})
                </h3>
                {notes.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-200">
                    Mustandis pole noote. Saad siiski avada tühja töö guided andmetega või tühistada.
                  </p>
                ) : (
                  <ol className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
                    {notes.map((n, idx) => {
                      const band = n.importConfidenceBand || confidenceBand(n.importConfidence);
                      return (
                        <li
                          key={n.id || idx}
                          className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border ${
                            band === 'red'
                              ? 'border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800'
                              : band === 'yellow'
                                ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
                                : 'border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900'
                          }`}
                        >
                          <BandDot band={band} />
                          <span className="font-mono text-amber-950 dark:text-white">
                            {n.isRest
                              ? `Paus ${n.durationLabel || ''}`
                              : `${n.pitch}${n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : ''}${n.octave ?? ''} ${n.durationLabel || ''}`}
                          </span>
                          <span className="ml-auto text-xs opacity-70">
                            {Math.round((Number(n.importConfidence) || 0) * 100)}%
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {markers.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  {markers.length} kohta vajab kontrolli pärast avamist (kollane/punane).
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-amber-100 dark:border-white/10 flex flex-wrap justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onBack?.()}
            disabled={busy}
            className="px-4 py-2 rounded-xl border-2 border-amber-200 dark:border-white/20 text-amber-900 dark:text-white font-semibold disabled:opacity-50"
          >
            Tagasi andmetesse
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              disabled={busy}
              className="px-4 py-2 rounded-xl border-2 border-amber-200 dark:border-white/20 text-amber-900 dark:text-white font-semibold disabled:opacity-50"
            >
              Tühista
            </button>
            <button
              type="button"
              onClick={() => onConfirmApply?.()}
              disabled={busy || !report?.ok}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Loo uus töö mustandist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
