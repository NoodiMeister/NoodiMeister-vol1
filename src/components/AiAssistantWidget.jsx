import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, Send } from 'lucide-react';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, getTranslations } from '../i18n';

const CONTACT_EMAIL = 'info@la-stravaganza.com';

/**
 * Hõljuv AI-kirjutusrobot (all parem): ? ringis → valik küsimus / ettepanek → tekst → e-post.
 * Paneelis klahvid ei leki noodisisestusse; Esc sulgeb paneeli (ei logi välja).
 */
export default function AiAssistantWidget() {
  const [locale] = useState(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  const t = useMemo(() => getTranslations(locale), [locale]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('choose'); // 'choose' | 'compose' | 'sent'
  const [intent, setIntent] = useState(null); // 'question' | 'suggestion'
  const [message, setMessage] = useState('');
  const panelRef = useRef(null);
  const textareaRef = useRef(null);

  const reset = useCallback(() => {
    setStep('choose');
    setIntent(null);
    setMessage('');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const openPanel = useCallback(() => {
    setOpen(true);
    reset();
  }, [reset]);

  // Esc sulgeb roboti enne EscapeLogoutHandler'it (capture).
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (step === 'compose' || step === 'sent') {
        setStep('choose');
        setIntent(null);
        setMessage('');
        return;
      }
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, step, close]);

  useEffect(() => {
    if (open && step === 'compose') {
      const id = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open, step]);

  const pickIntent = (next) => {
    setIntent(next);
    setStep('compose');
    setMessage('');
  };

  const stopKeyLeak = (e) => {
    e.stopPropagation();
  };

  const handleSend = (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || !intent) return;

    const kindLabel =
      intent === 'question'
        ? (t['aiAssistant.intentQuestion'] || 'Küsimus')
        : (t['aiAssistant.intentSuggestion'] || 'Ettepanek');
    const subject = encodeURIComponent(`Noodimeister – ${kindLabel}`);
    const body = encodeURIComponent(
      `${kindLabel}\n\n${text}\n\n---\n${typeof window !== 'undefined' ? window.location.href : ''}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setStep('sent');
  };

  const title = t['aiAssistant.title'] || 'Noodimeistri abiline';
  const greeting = t['aiAssistant.greeting'] || 'Tere! Kuidas saan aidata?';
  const q1 = t['aiAssistant.askQuestions'] || 'Kas sul on küsimusi?';
  const q2 = t['aiAssistant.askSuggestions'] || 'Kas sul on ettepanekuid?';
  const composeHint =
    intent === 'suggestion'
      ? (t['aiAssistant.composeSuggestion'] || 'Kirjuta oma ettepanek:')
      : (t['aiAssistant.composeQuestion'] || 'Kirjuta oma küsimus:');
  const placeholder =
    intent === 'suggestion'
      ? (t['aiAssistant.placeholderSuggestion'] || 'Nt sooviksin, et…')
      : (t['aiAssistant.placeholderQuestion'] || 'Nt kuidas ma saan…');
  const sendLabel = t['aiAssistant.send'] || 'Saada';
  const backLabel = t['aiAssistant.back'] || 'Tagasi';
  const closeLabel = t['common.close'] || 'Sulge';
  const sentThanks =
    t['aiAssistant.sentThanks'] ||
    'Aitäh! Kui e-posti klient ei avanenud, kirjuta aadressile info@la-stravaganza.com.';
  const openAria = t['aiAssistant.openAria'] || 'Ava abiline: küsimused ja ettepanekud';

  return (
    <div
      className="fixed bottom-5 right-5 z-[85] flex flex-col items-end gap-3 pointer-events-none"
      data-nm-ai-assistant
    >
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pointer-events-auto w-[min(92vw,22rem)] rounded-2xl border-2 border-amber-300 dark:border-amber-600 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
          onKeyDown={stopKeyLeak}
          onKeyUp={stopKeyLeak}
          onKeyPress={stopKeyLeak}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-amber-500 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold"
                aria-hidden
              >
                ?
              </span>
              <span className="font-semibold text-sm truncate">{title}</span>
            </div>
            <button
              type="button"
              onClick={close}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {step === 'choose' && (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{greeting}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {t['aiAssistant.choosePrompt'] || 'Vali üks:'}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => pickIntent('question')}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-50 font-medium text-sm hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    {q1}
                  </button>
                  <button
                    type="button"
                    onClick={() => pickIntent('suggestion')}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-50 font-medium text-sm hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    {q2}
                  </button>
                </div>
              </>
            )}

            {step === 'compose' && (
              <form onSubmit={handleSend} className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('choose');
                    setIntent(null);
                    setMessage('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {backLabel}
                </button>
                <p className="text-sm text-slate-700 dark:text-slate-200">{composeHint}</p>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={stopKeyLeak}
                  rows={5}
                  placeholder={placeholder}
                  className="w-full resize-y min-h-[6rem] px-3 py-2 rounded-xl border-2 border-amber-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {sendLabel}
                </button>
              </form>
            )}

            {step === 'sent' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{sentThanks}</p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
                >
                  {closeLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => (open ? close() : openPanel())}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg border-2 border-amber-300 hover:bg-amber-600 hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
        aria-label={open ? closeLabel : openAria}
        aria-expanded={open}
        title={open ? closeLabel : openAria}
      >
        {open ? (
          <X className="w-6 h-6" strokeWidth={2.5} />
        ) : (
          <span className="text-2xl font-bold leading-none select-none" aria-hidden>
            ?
          </span>
        )}
      </button>
    </div>
  );
}
