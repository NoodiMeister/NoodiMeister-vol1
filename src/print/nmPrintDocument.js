/**
 * Noodimeistri isoleeritud print-dokument (Google Docs–stiilis): ainult see HTML/CSS
 * läheb printimisele, mitte terve SPA. Sünkroonis PDF/print SVG mudeliga (scoreToSvg).
 *
 * @page size arvutatakse trükihetkel layoutOpts-ist (paber + orientatsioon); index.css host-print reeglid on eraldi.
 */

import {
  getPageSvgString,
  rewriteSmuflTimeSigDigitsToAscii,
  validateSmuflTimeSigExport,
} from '../utils/scoreToSvg';
import {
  getPageCount,
  getPaperDimensionsMm,
  normalizePageOrientation,
  normalizePaperSize,
} from '../utils/pageGeometry';

/**
 * @param {object} pageModel — scoreToSvg / buildScoreExportSnapshot väljund
 * @param {{ paperSize?: string, pageOrientation?: string }} opts
 * @returns {string} .nm-print-svg-page blokid (SVG stringid sees)
 */
export function buildNmPrintSvgPagesMarkup (pageModel, opts = {}) {
  if (!pageModel) return '';
  const { defsString, contentString, contentHeight, orientation, footerText, pageMetrics, flowDirection } = pageModel;
  const pageOrientation = opts.pageOrientation ?? 'portrait';
  const orient = (orientation ?? pageOrientation) === 'landscape' ? 'landscape' : 'portrait';
  const flow = flowDirection === 'horizontal' ? 'horizontal' : 'vertical';
  const pageExtentPx = pageMetrics
    ? (flow === 'horizontal' ? pageMetrics.widthPx : pageMetrics.heightPx)
    : (orient === 'landscape' ? 794 : 1123);
  const numPages = getPageCount(Number(contentHeight) || pageExtentPx, pageExtentPx);
  const foot = typeof footerText === 'string' ? footerText : '';
  let smuflOk = true;
  try {
    smuflOk = validateSmuflTimeSigExport({ defsString, contentString }).ok !== false;
  } catch (_) {}
  let html = '';
  for (let p = 0; p < numPages; p += 1) {
    const pageSvg = getPageSvgString(defsString, contentString, pageModel, p, { footerText: foot });
    const safePageSvg = smuflOk ? pageSvg : rewriteSmuflTimeSigDigitsToAscii(pageSvg);
    html += `<div class="nm-print-svg-page">${safePageSvg}</div>`;
  }
  return html;
}

/**
 * @param {string} pagesInnerHtml
 * @param {{ paperSize?: string, pageOrientation?: string }} layoutOpts — peab vastama pageModeli orientatsioonile,
 *   et @page size ei jääks vaikimisi portrait’iks (Chrome võib muidu Cmd/Ctrl+P eelvaates paberi püsti jätta).
 */
export function buildNmStandalonePrintDocumentHtml (pagesInnerHtml, layoutOpts = {}) {
  const paper = normalizePaperSize(layoutOpts.paperSize || 'a4');
  const orient = normalizePageOrientation(layoutOpts.pageOrientation || 'portrait');
  const { width, height } = getPaperDimensionsMm(paper, orient);
  const style = getNmStandalonePrintStylesheet(width, height);
  const baseHref = (() => {
    try {
      if (typeof document !== 'undefined' && document.baseURI) return document.baseURI;
    } catch (_) {}
    return '/';
  })();
  const body = `<div class="nm-print-svg-pages">${pagesInnerHtml}</div>`;
  return `<!DOCTYPE html><html lang="et"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><base href="${baseHref}"/><title>Noodimeister</title><style>${style}</style></head><body>${body}</body></html>`;
}

/**
 * Prindib isoleeritud dokumendi peidetud iframe'is (sama tee nagu handlePrint).
 *
 * @param {string} fullDocumentHtml — buildNmStandalonePrintDocumentHtml tulem
 * @param {{ blankHostDocument?: boolean, onFinished?: () => void }} opts
 *   Kui true: enne printi lisatakse põhilehele `html.nm-print-svg-mode` ilma `.nm-print-svg-pages`
 *   sõlmeta — index.css peidab kogu põhidokumendi print-eelvaate; kasulik brauseri menüü Print,
 *   kui võib avaneda ka põhidokumendi print (tühi eelvaade, sisu ainult iframe'is).
 *   onFinished: kutsutakse pärast puhastust (afterprint või timeout).
 */
export function runIsolatedPrintFromHtml (fullDocumentHtml, opts = {}) {
  const blankHostDocument = opts.blankHostDocument === true;
  const onFinished = typeof opts.onFinished === 'function' ? opts.onFinished : null;
  let iframe = null;
  const removeIframe = () => {
    try {
      if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (_) {}
    iframe = null;
  };

  if (blankHostDocument) {
    document.documentElement.classList.add('nm-print-svg-mode');
  }

  try {
    iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Noodimeister print');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;visibility:hidden';
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(fullDocumentHtml);
    idoc.close();
    const win = iframe.contentWindow;
    let cleaned = false;
    const finish = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        win.removeEventListener('afterprint', onIframeAfterPrint);
      } catch (_) {}
      try {
        window.removeEventListener('afterprint', onHostAfterPrint);
      } catch (_) {}
      if (blankHostDocument) {
        document.documentElement.classList.remove('nm-print-svg-mode');
      }
      removeIframe();
      try {
        onFinished?.();
      } catch (_) {}
    };
    const onIframeAfterPrint = () => finish();
    const onHostAfterPrint = () => finish();
    win.addEventListener('afterprint', onIframeAfterPrint);
    window.addEventListener('afterprint', onHostAfterPrint, { once: true });
    setTimeout(finish, 120000);
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (_) {
        finish();
      }
    };
    const readyPromise = idoc?.fonts?.ready
      ? idoc.fonts.ready.catch(() => null)
      : Promise.resolve(null);
    Promise.race([
      readyPromise,
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]).finally(triggerPrint);
  } catch (e) {
    if (blankHostDocument) {
      document.documentElement.classList.remove('nm-print-svg-mode');
    }
    removeIframe();
    try {
      onFinished?.();
    } catch (_) {}
    throw e;
  }
}

function getNmStandalonePrintStylesheet (widthMm, heightMm) {
  const w = Number(widthMm) || 210;
  const h = Number(heightMm) || 297;
  return `
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  height: 100%;
}
@media print {
  /* Üks @page reegel dokumendi kohta — vältib “vaikimisi A4 portrait” võitu üle page: nimetatud lehtede (Chrome). */
  @page {
    size: ${w}mm ${h}mm;
    margin: 12mm;
  }
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    margin: 0;
    padding: 0;
    background: #ffffff !important;
  }
  .nm-print-svg-pages {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    background: #ffffff !important;
  }
  .nm-print-svg-page {
    background: #ffffff !important;
    page-break-after: always;
    break-after: page;
  }
  .nm-print-svg-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .nm-print-svg-page img,
  .nm-print-svg-page svg {
    width: 100%;
    height: auto;
    display: block;
  }
}
`;
}
