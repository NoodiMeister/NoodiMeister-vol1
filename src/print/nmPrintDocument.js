/**
 * Noodimeistri isoleeritud print-dokument (Google Docs–stiilis): ainult see HTML/CSS
 * läheb printimisele, mitte terve SPA. Sünkroonis PDF/print SVG mudeliga (scoreToSvg).
 *
 * Peamised stiilid peegeldavad src/index.css @media print + @page reegleid;
 * muutmisel hoia mõlemad kooskõlas (või tõsta ühine .css + ?raw import).
 */

import { getPageSvgString } from '../utils/scoreToSvg';

/**
 * @param {object} pageModel — scoreToSvg / buildScoreExportSnapshot väljund
 * @param {{ paperSize?: string, pageOrientation?: string }} opts
 * @returns {string} .nm-print-svg-page blokid (SVG stringid sees)
 */
export function buildNmPrintSvgPagesMarkup (pageModel, opts = {}) {
  if (!pageModel) return '';
  const { defsString, contentString, contentHeight, orientation, footerText } = pageModel;
  const pageOrientation = opts.pageOrientation ?? 'portrait';
  const orient = (orientation ?? pageOrientation) === 'landscape' ? 'landscape' : 'portrait';
  const pageH = orient === 'landscape' ? 794 : 1123;
  const numPages = Math.max(1, Math.ceil((Number(contentHeight) || pageH) / pageH));
  const paper = (pageModel?.paperSize || opts.paperSize || 'a4').toLowerCase();
  const printPageClass = `print-page-${paper}-${orient}`;
  const foot = typeof footerText === 'string' ? footerText : '';
  let html = '';
  for (let p = 0; p < numPages; p += 1) {
    const pageSvg = getPageSvgString(defsString, contentString, pageModel, p, { footerText: foot });
    html += `<div class="nm-print-svg-page ${printPageClass}">${pageSvg}</div>`;
  }
  return html;
}

/** Täielik HTML-dokument iframe srcdoc / document.write jaoks. */
export function buildNmStandalonePrintDocumentHtml (pagesInnerHtml) {
  const style = getNmStandalonePrintStylesheet();
  const body = `<div class="nm-print-svg-pages">${pagesInnerHtml}</div>`;
  return `<!DOCTYPE html><html lang="et"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Noodimeister</title><style>${style}</style></head><body>${body}</body></html>`;
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
    win.focus();
    win.print();
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

function getNmStandalonePrintStylesheet () {
  return `
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  height: 100%;
}
@media print {
  @page a4-portrait {
    size: 210mm 297mm;
    margin: 12mm;
  }
  @page a4-landscape {
    size: 297mm 210mm;
    margin: 12mm;
  }
  @page a3-portrait {
    size: A3 portrait;
    margin: 12mm;
  }
  @page a3-landscape {
    size: A3 landscape;
    margin: 12mm;
  }
  @page a5-portrait {
    size: A5 portrait;
    margin: 12mm;
  }
  @page a5-landscape {
    size: A5 landscape;
    margin: 12mm;
  }
  @page {
    size: A4 portrait;
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
  .nm-print-svg-page.print-page-a4-portrait { page: a4-portrait; }
  .nm-print-svg-page.print-page-a4-landscape { page: a4-landscape; }
  .nm-print-svg-page.print-page-a3-portrait { page: a3-portrait; }
  .nm-print-svg-page.print-page-a3-landscape { page: a3-landscape; }
  .nm-print-svg-page.print-page-a5-portrait { page: a5-portrait; }
  .nm-print-svg-page.print-page-a5-landscape { page: a5-landscape; }
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
