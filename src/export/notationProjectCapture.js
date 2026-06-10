/**
 * Kujundaja import: renderdab .nm projekti samas SVG-mudelis mis PDF/print (scoreToSvg).
 * Kasutab peidetud /app?notationCapture=1 iframe'i ja postMessage protokolli.
 */

export const NM_CAPTURE_SOURCE = 'nm-notation-capture';
export const NM_COMPOSER_SOURCE = 'nm-composer-import';

function captureAppUrl() {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${base}app?notationCapture=1`;
}

/**
 * @param {object|string} project — .nm JSON (objekt või string)
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ pages: string[], pageCount: number, orientation: string, paperSize: string }>}
 */
export async function captureNotationProjectPages(project, { timeoutMs = 45000, onProgress } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Noodigraafika render nõuab brauserit.');
  }

  const origin = window.location.origin;
  const parsedProject = typeof project === 'string' ? JSON.parse(project) : project;

  onProgress?.('start', 'Käivitan noodigraafika renderit…');

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Noodigraafika render');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:2400px;border:0;visibility:hidden;pointer-events:none';

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      try { iframe.remove(); } catch (_) { /* ignore */ }
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('Noodigraafika render aegus. Proovi uuesti või impordi väiksema failina.'));
    }, timeoutMs);

    const onMessage = (ev) => {
      if (ev.origin !== origin) return;
      if (ev.data?.source !== NM_CAPTURE_SOURCE) return;

      if (ev.data.type === 'nm-capture-ready') {
        onProgress?.('editor-ready', 'Laen projekti editorisse…');
        try {
          iframe.contentWindow?.postMessage({
            source: NM_COMPOSER_SOURCE,
            type: 'nm-capture-project',
            project: parsedProject,
          }, origin);
          onProgress?.('rendering', 'Joonistan noodigraafikat…');
        } catch (e) {
          finish(reject, e);
        }
        return;
      }

      if (ev.data.type === 'nm-capture-result') {
        if (ev.data.ok) {
          onProgress?.('done', 'Render valmis');
          finish(resolve, {
            pages: Array.isArray(ev.data.pages) ? ev.data.pages : [],
            pageCount: Math.max(1, Number(ev.data.pageCount) || 1),
            orientation: ev.data.orientation || 'portrait',
            paperSize: ev.data.paperSize || 'A4',
          });
        } else {
          finish(reject, new Error(ev.data.error || 'Noodigraafika render ebaõnnestus.'));
        }
      }
    };

    window.addEventListener('message', onMessage);
    iframe.src = new URL(captureAppUrl(), window.location.href).href;
    document.body.appendChild(iframe);
    onProgress?.('iframe', 'Avan noodiprogrammi…');
  });
}

export function isNotationCaptureSupported() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
