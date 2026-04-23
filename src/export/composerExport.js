import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

function pageToSvg(page) {
  const blocksMarkup = (page.blocks || []).map((block) => {
    if (block.type === 'svg') {
      const slice = block.slice || { x: 0, y: 0, width: block.sourceWidth || block.width, height: block.sourceHeight || block.height };
      const sx = (Number(block.width) || 1) / Math.max(1, Number(slice.width) || 1);
      const sy = (Number(block.height) || 1) / Math.max(1, Number(slice.height) || 1);
      const innerW = (Number(block.sourceWidth) || Number(block.width) || 1) * sx;
      const innerH = (Number(block.sourceHeight) || Number(block.height) || 1) * sy;
      const offsetX = (Number(slice.x) || 0) * sx;
      const offsetY = (Number(slice.y) || 0) * sy;
      return `
      <foreignObject x="${Number(block.x) || 0}" y="${Number(block.y) || 0}" width="${Number(block.width) || 1}" height="${Number(block.height) || 1}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${Number(block.width) || 1}px;height:${Number(block.height) || 1}px;overflow:hidden;background:#fff;">
          <div style="position:absolute;left:-${offsetX}px;top:-${offsetY}px;width:${innerW}px;height:${innerH}px;">${block.svgMarkup || ''}</div>
        </div>
      </foreignObject>`;
    }
    const text = String(block.text || '').replace(/[<>&"]/g, (ch) => {
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '&') return '&amp;';
      return '&quot;';
    });
    return `<foreignObject x="${Number(block.x) || 0}" y="${Number(block.y) || 0}" width="${Number(block.width) || 120}" height="${Number(block.height) || 80}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:18px;color:#111827;">${text}</div>
    </foreignObject>`;
  }).join('');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">
  <rect x="0" y="0" width="${page.width}" height="${page.height}" fill="${page.background || '#ffffff'}" />
  ${blocksMarkup}
</svg>`.trim();
}

export function exportComposerPagesToSvg(doc) {
  return (doc.pages || []).map((page) => pageToSvg(page));
}

export async function exportComposerToPdf(doc, fileName = 'composer.pdf') {
  const pages = exportComposerPagesToSvg(doc);
  if (pages.length === 0) return;
  const first = doc.pages?.[0] || { width: 1123, height: 794 };
  const orientation = first.width > first.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [first.width, first.height],
  });
  for (let i = 0; i < pages.length; i += 1) {
    if (i > 0) {
      const p = doc.pages[i];
      const o = p.width > p.height ? 'landscape' : 'portrait';
      pdf.addPage([p.width, p.height], o);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = pages[i];
    const svgEl = wrap.querySelector('svg');
    if (svgEl) {
      await pdf.svg(svgEl, {
        x: 0,
        y: 0,
        width: doc.pages[i].width,
        height: doc.pages[i].height,
      });
    }
  }
  pdf.save(fileName);
}

export function printComposerDocument(doc) {
  const pages = exportComposerPagesToSvg(doc);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>
  body{margin:0;background:#f3f4f6;}
  .page{page-break-after:always;display:flex;justify-content:center;padding:16px;}
  svg{background:#fff;box-shadow:0 1px 10px rgba(0,0,0,.15);}
  @media print {.page{padding:0} body{background:#fff} svg{box-shadow:none}}
  </style></head><body>${pages.map((svg) => `<div class="page">${svg}</div>`).join('')}</body></html>`;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
