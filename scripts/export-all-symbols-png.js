/**
 * Export ALL symbol previews to PNG.
 * Run: node scripts/export-all-symbols-png.js
 * Writes PNGs to docs/symbol-previews/
 *
 * All symbols are path-based or use system fonts; Sharp only (no Puppeteer/Chrome).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FIGURE_NOTE_COLORS, getShapePathsByOctave, getFigureStyle } from '../src/constants/FigureNotesLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');

const SIZE = 200;

function svgWrap(content, width = SIZE, height = SIZE) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-width/2} ${-height/2} ${width} ${height}" width="${width}" height="${height}">
  <rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" fill="#fff"/>
  ${content}
</svg>`;
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'symbol';
}

// —— Path-based traditional symbols (Sharp-only; no font/Puppeteer) ——
// Bass clef from bassclefsymbol.svg: path + two dots, scaled and centered
const BASS_CLEF_PATH = `<g transform="translate(-46.2, 78.5) scale(4.62) translate(-5, -12)"><path fill="#1a1a1a" d="M12.4,2.5 C9.8,2.5,7.6,3.4,5.9,5.2 C4.2,7,3.3,9.2,3.3,11.8 c0,2.8,1,5.2,2.9,7.1 c1.9,1.9,4.3,2.9,7.1,2.9 c2.1,0,4-0.6,5.6-1.9 l-1.3-1.6 c-1.2,0.9-2.7,1.4-4.3,1.4 c-2.2,0-4.1-0.8-5.6-2.3 c-1.5-1.5-2.2-3.4-2.2-5.6 c0-2.2,0.8-4.1,2.3-5.6 c1.5-1.5,3.4-2.3,5.6-2.3 c3.2,0,5.9,2,7,4.8 h2.3 C21.6,6,17.5,2.5,12.4,2.5 z"/><circle cx="15" cy="-5" r="1.8" fill="#1a1a1a"/><circle cx="15" cy="0" r="1.8" fill="#1a1a1a"/></g>`;
// C clef: two vertical bars + C curve
const C_CLEF_PATH = '<g stroke="#1a1a1a" fill="none" stroke-width="4" stroke-linecap="round"><line x1="-14" y1="-55" x2="-14" y2="55"/><line x1="14" y1="-55" x2="14" y2="55"/><path d="M14 0 Q-14 0 -14 -28 Q14 -55 14 -28 M14 28 Q-14 28 -14 0 Q14 28 14 0"/></g>';
// Flat sign (simple path for staff)
const FLAT_PATH = '<path fill="#1a1a1a" d="M0 4 L0 -18 L3 -18 L3 2 Q0 -2 -3 2 L-3 18 L0 18 Z"/>';

async function main() {
  const sharp = (await import('sharp')).default;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const toExport = [];

  // Figurenotes: 4 octaves × 7 notes. Shape by octave (2=X, 3=square, 4=circle, 5=triangle), color by note (C–B).
  [2, 3, 4, 5].forEach((oct) => {
    const paths = getShapePathsByOctave(oct);
    Object.entries(FIGURE_NOTE_COLORS).forEach(([note, color]) => {
      const style = getFigureStyle(note, oct);
      const stroke = style.stroke ? `stroke="${style.stroke}" stroke-width="${style.strokeWidth ?? 2}"` : '';
      const pathEls = paths.map((d) => `<path d="${d}" fill="${color}" ${stroke} vector-effect="non-scaling-stroke"/>`).join('');
      const content = `<g transform="translate(-50,-50)">${pathEls}</g>`;
      toExport.push({ id: `figurenotes-o${oct}-${note}`, svg: svgWrap(content, 100, 100) });
    });
  });

  // Clefs (path-based where no Leland script exists)
  toExport.push({ id: 'clef-bass', svg: svgWrap(BASS_CLEF_PATH) });
  // clef-c.png: use scripts/export-clef-c-png.js (Leland U+E05C cClef), not path-based C_CLEF_PATH

  // Octave symbols
  const octaveSymbols = [
    { id: 'octave-1-empty', content: `<g transform="translate(-50,-50)"><rect x="10" y="10" width="80" height="80" fill="none" stroke="#9ca3af" stroke-width="4" stroke-dasharray="8 6"/></g>` },
    { id: 'octave-2-cross', content: `<g transform="translate(-50,-50)"><path d="M10 10 L30 10 L90 70 L90 90 L70 90 L10 30 Z" fill="#1a1a1a"/><path d="M90 10 L70 10 L10 70 L10 90 L30 90 L90 30 Z" fill="#1a1a1a"/></g>` },
    { id: 'octave-3-square', content: `<g transform="translate(-50,-50)"><rect x="15" y="15" width="70" height="70" fill="#6b7280" stroke="#1a1a1a" stroke-width="3"/></g>` },
    { id: 'octave-4-circle', content: `<g transform="translate(-50,-50)"><circle cx="50" cy="50" r="35" fill="#6b7280" stroke="#1a1a1a" stroke-width="3"/></g>` },
    { id: 'octave-5-triangle', content: `<g transform="translate(-50,-50)"><path d="M50 18 L88 82 L12 82 Z" fill="#6b7280" stroke="#1a1a1a" stroke-width="3"/></g>` },
  ];
  octaveSymbols.forEach(({ id, content }) => toExport.push({ id, svg: svgWrap(content, 100, 100) }));

  // Octave 2 coordinate table
  const gridLines = [];
  for (let i = 0; i <= 10; i++) {
    const t = i * 10;
    gridLines.push(`<line x1="${t}" y1="0" x2="${t}" y2="100" stroke="#e0e0e0" stroke-width="0.4"/>`);
    gridLines.push(`<line x1="0" y1="${t}" x2="100" y2="${t}" stroke="#e0e0e0" stroke-width="0.4"/>`);
  }
  const axisLabels = [];
  for (let i = 0; i <= 10; i++) {
    const t = i * 10;
    axisLabels.push(`<text x="${t}" y="-2" text-anchor="middle" font-size="5" fill="#666" font-family="sans-serif">${t}</text>`);
    axisLabels.push(`<text x="-2" y="${t}" text-anchor="end" dominant-baseline="middle" font-size="5" fill="#666" font-family="sans-serif">${t}</text>`);
  }
  const hexagonBackslash = 'M10 10 L30 10 L90 70 L90 90 L70 90 L10 30 Z';
  const hexagonSlash = 'M90 10 L70 10 L10 70 L10 90 L30 90 L90 30 Z';
  const coordTableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 360" width="340" height="360">
  <rect width="340" height="360" fill="#f5f5f5"/>
  <g transform="translate(20,20) scale(3)">
    <rect x="0" y="0" width="100" height="100" fill="#fff" stroke="#ddd" stroke-width="0.5"/>
    ${gridLines.join('\n    ')}
    ${axisLabels.join('\n    ')}
    <path d="${hexagonBackslash}" fill="#1a1a1a"/>
    <path d="${hexagonSlash}" fill="#1a1a1a"/>
  </g>
  <g font-family="sans-serif" font-size="12" fill="#1a1a1a">
    <text x="170" y="338" text-anchor="middle">X: two hexagons (backslash + slash)</text>
    <text x="170" y="352" text-anchor="middle">Tip A 10–30×10–30, Tip B 70–90×70–90 each</text>
  </g>
</svg>`;
  toExport.push({ id: 'octave-2-cross-coordinate-table', svg: coordTableSvg });

  // Bass staff with notes (Eb, A, F, D, Bb) — path-based (bass clef path, circles, stems, flat path)
  const bassClefScale = 0.38;
  const bassStaffSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 100" width="340" height="100">
  <rect width="340" height="100" fill="#fff"/>
  <line x1="40" x2="320" y1="34" y2="34" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="42" y2="42" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="50" y2="50" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="58" y2="58" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="66" y2="66" stroke="#1a1a1a" stroke-width="1"/>
  <g transform="translate(32, 50) scale(${bassClefScale}) translate(-46.2, 78.5) scale(4.62) translate(-5, -12)"><path fill="#1a1a1a" d="M12.4,2.5 C9.8,2.5,7.6,3.4,5.9,5.2 C4.2,7,3.3,9.2,3.3,11.8 c0,2.8,1,5.2,2.9,7.1 c1.9,1.9,4.3,2.9,7.1,2.9 c2.1,0,4-0.6,5.6-1.9 l-1.3-1.6 c-1.2,0.9-2.7,1.4-4.3,1.4 c-2.2,0-4.1-0.8-5.6-2.3 c-1.5-1.5-2.2-3.4-2.2-5.6 c0-2.2,0.8-4.1,2.3-5.6 c1.5-1.5,3.4-2.3,5.6-2.3 c3.2,0,5.9,2,7,4.8 h2.3 C21.6,6,17.5,2.5,12.4,2.5 z"/><circle cx="15" cy="-5" r="1.8" fill="#1a1a1a"/><circle cx="15" cy="0" r="1.8" fill="#1a1a1a"/></g>
  <g transform="translate(72, 46) scale(0.22)">${FLAT_PATH}</g>
  <circle cx="90" cy="46" r="6" fill="#1a1a1a"/><line x1="97" y1="46" x2="97" y2="18" stroke="#1a1a1a" stroke-width="1.2"/>
  <circle cx="140" cy="62" r="6" fill="#1a1a1a"/><line x1="147" y1="62" x2="147" y2="34" stroke="#1a1a1a" stroke-width="1.2"/>
  <circle cx="190" cy="42" r="6" fill="#1a1a1a"/><line x1="197" y1="42" x2="197" y2="14" stroke="#1a1a1a" stroke-width="1.2"/>
  <circle cx="240" cy="50" r="6" fill="#1a1a1a"/><line x1="247" y1="50" x2="247" y2="22" stroke="#1a1a1a" stroke-width="1.2"/>
  <g transform="translate(272, 58) scale(0.22)">${FLAT_PATH}</g>
  <circle cx="290" cy="58" r="6" fill="#1a1a1a"/><line x1="297" y1="58" x2="297" y2="30" stroke="#1a1a1a" stroke-width="1.2"/>
  <text x="90" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">E&#9837;</text>
  <text x="140" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">A</text>
  <text x="190" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">F</text>
  <text x="240" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">D</text>
  <text x="290" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">B&#9837;</text>
</svg>`;
  toExport.push({ id: 'bass-staff-eb-a-f-d-bb', svg: bassStaffSvg, rawSvg: true });

  const base64Images = [];

  for (const item of toExport) {
    const id = item.id;
    const safe = safeId(id);
    const outPath = path.join(OUT_DIR, `${safe}.png`);
    const w = item.rawSvg ? 340 : SIZE;
    const h = item.rawSvg ? 100 : SIZE;

    try {
      const pngBuffer = await sharp(Buffer.from(item.svg)).png().toBuffer();
      fs.writeFileSync(outPath, pngBuffer);
      base64Images.push({ id, safeId: safe, base64: pngBuffer.toString('base64') });
      console.log('Saved', safe + '.png');
    } catch (e) {
      console.warn('Skip', safe, e.message);
    }
  }

  // Index HTML
  const imgs = base64Images.map(({ id, safeId: s, base64 }) => {
    const dataUrl = `data:image/png;base64,${base64}`;
    return `<div class="cell"><img src="${dataUrl}" alt="${id}"/><span>${id}</span></div>`;
  }).join('\n');

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Symbol previews</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #fafafa; padding: 24px; margin: 0; }
    h1 { font-size: 1.25rem; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
    .cell { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
    .cell img { max-width: 100%; height: 100px; object-fit: contain; display: block; margin: 0 auto; }
    .cell span { font-size: 0.7rem; color: #6b7280; margin-top: 8px; display: block; }
  </style>
</head>
<body>
  <h1>Symbol designs</h1>
  <div class="grid">${imgs}</div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml, 'utf8');
  console.log('Done. Output in docs/symbol-previews/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
