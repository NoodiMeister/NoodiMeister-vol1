import React, { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  OMR_INSTRUMENT_OPTIONS,
  OMR_KEY_SIGNATURES,
  OMR_NOTATION_MODES,
  PDF_SOURCE_TYPE,
  emptyConstraints,
} from '../../import/pdf/omrConstants.js';

const TIME_PRESETS = [
  [4, 4],
  [3, 4],
  [2, 4],
  [6, 8],
  [5, 4],
  [7, 8],
  [12, 8],
];

/**
 * Guided metadata before PDF/OMR analyze/apply (AGENTS: PDF/OMR import).
 */
export default function PdfOmrGuidedSetup({
  fileName = '',
  suggestions = null,
  constraints = null,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const initial = useMemo(() => {
    const s = suggestions?.suggestedConstraints || emptyConstraints();
    const base = emptyConstraints({
      ...s,
      title: s.title || '',
      sourceType: suggestions?.sourceType || s.sourceType || PDF_SOURCE_TYPE.TEXT_LAYER,
    });
    if (constraints && typeof constraints === 'object') {
      return emptyConstraints({ ...base, ...constraints });
    }
    return base;
  }, [suggestions, constraints]);

  const [title, setTitle] = useState(initial.title);
  const [instrumentId, setInstrumentId] = useState(initial.instrumentId);
  const [timeBeats, setTimeBeats] = useState(initial.timeSignature?.beats || 4);
  const [timeUnit, setTimeUnit] = useState(initial.timeSignature?.beatUnit || 4);
  const [keySignature, setKeySignature] = useState(initial.keySignature || 'C');
  const [notationMode, setNotationMode] = useState(initial.notationMode || 'traditional');
  const [sourceType, setSourceType] = useState(initial.sourceType || PDF_SOURCE_TYPE.TEXT_LAYER);
  const [error, setError] = useState(null);

  const instrument = OMR_INSTRUMENT_OPTIONS.find((o) => o.instrumentId === instrumentId) || OMR_INSTRUMENT_OPTIONS[1];

  const handleConfirm = () => {
    const trimmed = String(title || '').trim();
    if (!trimmed) {
      setError('Pealkiri on kohustuslik (AI soovitus tuleb kinnitada või ümber kirjutada).');
      return;
    }
    setError(null);
    onConfirm?.(
      emptyConstraints({
        title: trimmed,
        instrumentId: instrument.instrumentId,
        instrumentName: instrument.name,
        clefType: instrument.clefType,
        timeSignature: { beats: Number(timeBeats) || 4, beatUnit: Number(timeUnit) || 4 },
        keySignature,
        notationMode,
        sourceType,
      })
    );
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-amber-950/70 dark:bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-omr-guided-title"
      onClick={() => !busy && onCancel?.()}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <h2 id="pdf-omr-guided-title" className="text-lg font-bold">
            PDF import — teose andmed
          </h2>
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

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Enne OCR/AI lugemist kinnita pealkiri, instrument, taktimõõt, helistik ja režiim.
            {fileName ? (
              <span className="block text-xs text-amber-700 dark:text-amber-200/80 mt-1">Fail: {fileName}</span>
            ) : null}
          </p>

          {suggestions && (
            <p className="text-xs rounded-lg bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-white/10 px-3 py-2 text-amber-800 dark:text-amber-100">
              Soovitused: {suggestions.noteTokenCount || 0} nooditokenit · {suggestions.pageCount || 0} lk · allikas{' '}
              {suggestions.sourceType || '—'}. AI soovitusi ei rakendata ilma sinu kinnituseta.
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Pealkiri *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Loo pealkiri"
              className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Instrument</label>
            <select
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
              disabled={busy}
            >
              {OMR_INSTRUMENT_OPTIONS.map((o) => (
                <option key={o.instrumentId} value={o.instrumentId}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Taktimõõt</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {TIME_PRESETS.map(([beats, unit]) => {
                const sel = timeBeats === beats && timeUnit === unit;
                return (
                  <button
                    key={`${beats}/${unit}`}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setTimeBeats(beats);
                      setTimeUnit(unit);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium border-2 transition-colors ${
                      sel
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'border-amber-200 dark:border-white/20 text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {beats}/{unit}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Helistik</label>
            <select
              value={keySignature}
              onChange={(e) => setKeySignature(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
              disabled={busy}
            >
              {OMR_KEY_SIGNATURES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Notatsioonirežiim</label>
            <div className="flex flex-col gap-2">
              {OMR_NOTATION_MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex items-center gap-3 p-2.5 rounded-lg border-2 border-amber-200 dark:border-white/15 hover:bg-amber-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="omrNotationMode"
                    checked={notationMode === m.value}
                    onChange={() => setNotationMode(m.value)}
                    disabled={busy}
                    className="w-4 h-4 text-amber-600"
                  />
                  <span className="font-medium text-amber-900 dark:text-white text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Allika tüüp</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
              disabled={busy}
            >
              <option value={PDF_SOURCE_TYPE.TEXT_LAYER}>Tekstikiht (digitaalne PDF)</option>
              <option value={PDF_SOURCE_TYPE.PRINTED_SCAN}>Skaneeritud trükk</option>
              <option value={PDF_SOURCE_TYPE.HANDWRITTEN}>Käsikiri</option>
            </select>
            <p className="text-xs text-amber-700 dark:text-amber-200/80 mt-1">
              Käsikiri / skänn → serveri OMR + review on kohustuslik.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-amber-100 dark:border-white/10 flex justify-end gap-2 shrink-0">
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
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Analüüsin…' : 'Jätka OCR/AI-ga'}
          </button>
        </div>
      </div>
    </div>
  );
}
