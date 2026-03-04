import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, CheckCircle2 } from 'lucide-react';
import { getCopyableErrorText, reportAuthErrorToDev } from '../utils/authError';

const SENT_MESSAGE_DURATION_MS = 6000;
const POLL_STATUS_INTERVAL_MS = 12000;

/**
 * Kuvab veateate ja "Saada Cursorisse" nupu. Arendusrežiimis saadetakse viga automaatselt
 * logs/last-auth-error.json; kasutajat teavitatakse, kui viga on märgitud parandatuks.
 */
export function AuthErrorBlock({ message, errorDetail = null, isSuccess = false }) {
  const [copied, setCopied] = useState(false);
  const [errorFixed, setErrorFixed] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isSuccess && errorDetail?.fullMessage) reportAuthErrorToDev(errorDetail);
  }, [errorDetail, isSuccess]);

  useEffect(() => {
    if (isSuccess || !errorDetail?.fullMessage || typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
    const check = () => {
      fetch('/__dev-auth-error-status')
        .then((r) => r.json())
        .then((data) => {
          if (data?.status === 'fixed') {
            setErrorFixed(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        })
        .catch(() => {});
    };
    pollRef.current = setInterval(check, POLL_STATUS_INTERVAL_MS);
    check();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [errorDetail?.fullMessage, isSuccess]);

  const copyText = errorDetail ? getCopyableErrorText(errorDetail) : (message || '');

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), SENT_MESSAGE_DURATION_MS);
    } catch {
      setCopied(false);
    }
  };

  const showCopy = Boolean(copyText && !isSuccess);

  return (
    <div
      className={`p-3 rounded-lg text-sm ${
        isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {errorFixed && (
        <div className="mb-3 p-2.5 rounded-lg bg-emerald-200/90 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Viga on vastuvõetud, töödeldud, parandatud ja testitud. Proovi uuesti sisselogimist.</span>
        </div>
      )}
      <div className="break-words">{message}</div>
      {showCopy && (
        <div className="mt-2 pt-2 border-t border-red-200/60">
          {copied && (
            <p className="text-xs text-red-800/95 mb-2">
              Teade on saadetud Cursorisse. Ole kannatlik – viga töödeldakse ja parandatakse. Teavitame, kui viga on lahendatud.
            </p>
          )}
          <p className="text-xs text-red-700/90 mb-1.5">
            Saada teade Cursorisse (siia rakendusse), et AI saaks viga kiiremini näha ja parandada:
          </p>
          <pre className="text-xs bg-red-50/80 border border-red-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24 overflow-y-auto mb-2 font-sans">
            {copyText}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-200/80 hover:bg-red-300/80 text-red-900 text-xs font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Saadetud' : 'Saada Cursorisse'}
          </button>
        </div>
      )}
    </div>
  );
}
