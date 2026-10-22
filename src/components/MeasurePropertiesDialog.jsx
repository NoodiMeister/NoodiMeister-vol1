import React, { useEffect, useMemo, useState } from 'react';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';
import {
  defaultActualBeatsForIndex,
  getMeasureProp,
} from '../musical/measureProperties';
import { getPickupQuarterBeats } from '../musical/pickup';

/**
 * MuseScore-lähedane Taktiomadused hüpikaken.
 * Actual muudab ainult selle takti kestust; Nominal (taktimõõt) on read-only.
 */
export function MeasurePropertiesDialog({
  open,
  measureIndex = 0,
  totalMeasures = 1,
  timeSignature,
  pickupEnabled = false,
  pickupQuantity = 1,
  pickupDuration = '1/4',
  incompleteLastMeasure = false,
  measurePropsByIndex = {},
  measureStretchFactors = [],
  labels = {},
  onClose,
  onSave,
  onNavigate,
}) {
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  const pickupBeats = getPickupQuarterBeats({
    enabled: pickupEnabled,
    quantity: pickupQuantity,
    duration: pickupDuration,
    timeSignature,
  });

  const defaults = useMemo(() => {
    const fallback = defaultActualBeatsForIndex(measureIndex, {
      measureQuarters,
      pickupBeats,
      incompleteLast: incompleteLastMeasure,
      totalMeasures,
    });
    const prop = getMeasureProp(measurePropsByIndex, measureIndex);
    const stretch = Array.isArray(measureStretchFactors) && typeof measureStretchFactors[measureIndex] === 'number'
      ? measureStretchFactors[measureIndex]
      : (prop?.stretch ?? 1);
    return {
      actualBeats: prop?.actualBeats != null ? prop.actualBeats : fallback,
      excludeFromCount: prop?.excludeFromCount === true
        || (pickupBeats > 0 && measureIndex === 0 && prop?.excludeFromCount !== false),
      stretch,
    };
  }, [
    measureIndex,
    measureQuarters,
    pickupBeats,
    incompleteLastMeasure,
    totalMeasures,
    measurePropsByIndex,
    measureStretchFactors,
  ]);

  const [actualBeats, setActualBeats] = useState(defaults.actualBeats);
  const [excludeFromCount, setExcludeFromCount] = useState(defaults.excludeFromCount);
  const [stretch, setStretch] = useState(defaults.stretch);

  useEffect(() => {
    if (!open) return;
    setActualBeats(defaults.actualBeats);
    setExcludeFromCount(defaults.excludeFromCount);
    setStretch(defaults.stretch);
  }, [open, defaults, measureIndex]);

  if (!open) return null;

  const beats = Number(timeSignature?.beats) || 4;
  const beatUnit = Number(timeSignature?.beatUnit) || 4;
  const nominalLabel = `${beats}/${beatUnit}`;

  const handleSave = () => {
    const safeActual = Math.max(0.25, Math.min(64, Number(actualBeats) || measureQuarters));
    const safeStretch = Math.max(0.25, Math.min(4, Number(stretch) || 1));
    onSave?.({
      measureIndex,
      actualBeats: Math.round(safeActual * 1000) / 1000,
      excludeFromCount: !!excludeFromCount,
      stretch: Math.round(safeStretch * 100) / 100,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-amber-950/40 backdrop-blur-sm p-4"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border-2 border-amber-300 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="measure-props-title"
      >
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-3 flex items-center justify-between">
          <h2 id="measure-props-title" className="font-bold text-base">
            {labels.title || 'Taktiomadused'}
            <span className="font-normal opacity-90 ml-2">
              ({(labels.measure || 'Takt')} {measureIndex + 1})
            </span>
          </h2>
          <button type="button" className="text-white/90 hover:text-white text-2xl leading-none" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4 text-amber-950 dark:text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
              {labels.durationSection || 'Takti kestus'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{labels.nominal || 'Nominal'}</label>
                <input
                  type="text"
                  readOnly
                  value={nominalLabel}
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-800"
                />
                <p className="text-xs text-amber-600 mt-1">{labels.nominalHint || 'Skoori taktimõõt (ei muutu).'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{labels.actual || 'Actual (löögid)'}</label>
                <input
                  type="number"
                  min={0.25}
                  max={64}
                  step={0.25}
                  value={actualBeats}
                  onChange={(e) => setActualBeats(parseFloat(e.target.value) || 0.25)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-300 bg-white text-amber-950"
                />
                <p className="text-xs text-amber-600 mt-1">{labels.actualHint || 'Ainult selle takti pikkus (neljandikühikutes).'}</p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeFromCount}
              onChange={(e) => setExcludeFromCount(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 text-amber-600"
            />
            <span className="text-sm font-medium">{labels.excludeFromCount || 'Ära loe taktinumbrite hulka'}</span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">
              {labels.stretch || 'Paigutuse venitamine'}: {Number(stretch).toFixed(2)}
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={stretch}
              onChange={(e) => setStretch(parseFloat(e.target.value) || 1)}
              className="w-full"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2 bg-amber-50/60">
          <div className="flex gap-1">
            <button
              type="button"
              disabled={measureIndex <= 0}
              onClick={() => onNavigate?.(measureIndex - 1)}
              className="px-2 py-1 rounded border border-amber-300 text-sm disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={measureIndex >= totalMeasures - 1}
              onClick={() => onNavigate?.(measureIndex + 1)}
              className="px-2 py-1 rounded border border-amber-300 text-sm disabled:opacity-40"
            >
              →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border-2 border-amber-200 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              {labels.cancel || 'Tühista'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
            >
              {labels.saveClose || 'Salvesta ja sulge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeasurePropertiesDialog;
