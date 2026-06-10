import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { IMPORT_TIMELINE_LABELS } from '../../utils/composerImportTimeline';

function StepIcon({ state }) {
  if (state === 'done') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-200 dark:border-white/25 bg-white dark:bg-zinc-800" />
  );
}

export default function ComposerImportTimeline({ timeline, onDismiss }) {
  if (!timeline) return null;

  const { type, steps = [], current = 0, status, detail } = timeline;
  const title = IMPORT_TIMELINE_LABELS[type] || 'Import';
  const progressPct = Math.max(
    8,
    Math.round(((Math.max(0, current) + (status === 'running' ? 0.35 : 1)) / Math.max(1, steps.length)) * 100),
  );
  const canDismiss = status === 'done' || status === 'error';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-amber-950/50 dark:bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-import-timeline-title"
      aria-busy={status === 'running'}
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-200 dark:border-white/20 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-amber-100 dark:border-white/10 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-zinc-800 dark:to-zinc-900">
          <h2 id="composer-import-timeline-title" className="text-base font-bold text-amber-900 dark:text-white">
            {title}
          </h2>
          {detail && status === 'running' && (
            <p className="text-sm text-amber-700 dark:text-amber-200/90 mt-1">{detail}</p>
          )}
          <div className="mt-3 h-2 rounded-full bg-amber-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        </div>

        <ol className="px-5 py-4 space-y-3 max-h-[min(50vh,320px)] overflow-y-auto">
          {steps.map((label, idx) => {
            let stepState = 'pending';
            if (status === 'done') {
              stepState = 'done';
            } else if (status === 'error' && idx === current) {
              stepState = 'error';
            } else if (status === 'error' && idx < current) {
              stepState = 'done';
            } else if (idx < current) {
              stepState = 'done';
            } else if (idx === current && status === 'running') {
              stepState = 'active';
            }

            return (
              <li key={`${label}-${idx}`} className="flex items-start gap-3">
                <StepIcon state={stepState} />
                <span
                  className={`text-sm pt-0.5 ${
                    stepState === 'active'
                      ? 'font-semibold text-amber-900 dark:text-white'
                      : stepState === 'done'
                        ? 'text-amber-800/80 dark:text-white/70'
                        : stepState === 'error'
                          ? 'font-semibold text-red-700 dark:text-red-300'
                          : 'text-amber-600/70 dark:text-white/45'
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {canDismiss && (
          <div className="px-5 py-3 border-t border-amber-100 dark:border-white/10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {detail && status !== 'running' && (
              <p className={`text-sm ${status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {detail}
              </p>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className={`px-4 py-2 rounded-lg text-white text-sm font-semibold ${
                status === 'error'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-emerald-600 hover:bg-emerald-500 ml-auto'
              }`}
            >
              {status === 'error' ? 'Sulge' : 'Edasi'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
