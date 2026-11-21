import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

if (typeof pdfjsLib?.GlobalWorkerOptions === 'object' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

/**
 * Render PDF pages to PNG data URLs for OMR API + side-by-side review.
 * @param {File|ArrayBuffer|Uint8Array} fileOrBytes
 * @param {{ maxPages?: number, scale?: number }} [opts]
 */
export async function renderPdfPagesToDataUrls(fileOrBytes, opts = {}) {
  const maxPages = Math.max(1, Math.min(24, Number(opts.maxPages) || 8));
  const scale = Math.max(0.5, Math.min(2, Number(opts.scale) || 1.25));

  let data = fileOrBytes;
  if (typeof File !== 'undefined' && fileOrBytes instanceof File) {
    data = await fileOrBytes.arrayBuffer();
  }

  const docTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
  const pdf = await docTask.promise;
  const pageCount = pdf.numPages;
  const pages = [];
  const limit = Math.min(pageCount, maxPages);

  for (let i = 1; i <= limit; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) {
      throw new Error('PDF lehtede renderdamine vajab brauserit (canvas)');
    }
    const ctx = canvas.getContext('2d');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      pageIndex: i - 1,
      width: canvas.width,
      height: canvas.height,
      dataUrl: canvas.toDataURL('image/png'),
    });
  }

  return { pageCount, pages, truncated: pageCount > limit };
}
