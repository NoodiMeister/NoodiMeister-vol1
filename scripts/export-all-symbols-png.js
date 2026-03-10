/**
 * Export ALL symbol previews to PNG.
 * Run: node scripts/export-all-symbols-png.js
 * Writes PNGs to docs/symbol-previews/
 *
 * - Figurenotes, JO clef, octave: Sharp (no font).
 * - Traditional clefs/notes/rests: Puppeteer so Leland font is applied (Sharp does not use @font-face).
 *   If Puppeteer is not installed, those PNGs are still generated with Sharp but will show wrong/missing glyphs.
 *
 * For correct traditional symbols: npm install puppeteer --save-dev
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FIGURE_NOTE_COLORS, getShapePathsByOctave, getFigureStyle } from '../src/constants/FigureNotesLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Leland.woff2');

const SIZE = 200;

/** IDs that use Leland; must be rendered in a browser (Puppeteer) for correct glyphs. */
const FONT_DEPENDENT_IDS = new Set([
  'clef-treble', 'clef-bass', 'clef-c',
  'note-whole', 'note-half-up', 'note-quarter-up', 'note-eighth-up', 'note-16th-up', 'note-32nd-up',
  'rest-whole', 'rest-half', 'rest-quarter', 'rest-eighth', 'rest-16th', 'rest-32nd',
  'bass-staff-eb-a-f-d-bb',
]);

function lelandFontDataUrl() {
  if (!fs.existsSync(FONT_PATH)) return null;
  const woff2 = fs.readFileSync(FONT_PATH);
  return `data:font/woff2;base64,${woff2.toString('base64')}`;
}

/** Render SVG to PNG in headless Chrome so Leland @font-face is applied. Returns null if Puppeteer unavailable. */
async function renderSvgWithPuppeteer(svgString, width, height) {
  try {
    const puppeteer = (await import('puppeteer')).default;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;">${svgString}</body></html>`;
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: Math.max(width, 400), height: Math.max(height, 400), deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 200));
    const el = await page.$('svg');
    const pngBuffer = el ? await el.screenshot({ type: 'png' }) : null;
    await browser.close();
    return pngBuffer ? (Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer)) : null;
  } catch {
    return null;
  }
}

function svgWrap(content, width = SIZE, height = SIZE, fontDataUrl = null) {
  const defs = fontDataUrl
    ? `<defs><style>@font-face{font-family:'Leland';src:url('${fontDataUrl}') format('woff2');}</style></defs>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-width/2} ${-height/2} ${width} ${height}" width="${width}" height="${height}">
  ${defs}
  <rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" fill="#fff"/>
  ${content}
</svg>`;
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'symbol';
}

// —— Rest paths (when font not available) ——
const REST_WHOLE_PATH = '<path fill="#1a1a1a" d="M-48,-18 L48,-18 L48,18 L-48,18 Z"/>';
const REST_QUARTER_PATH = '<g transform="translate(-17,-42.5) scale(0.85)"><path fill="#1a1a1a" d="M28,5 C35,5 38,12 36,22 L34,45 C30,62 22,72 12,68 C4,64 2,54 8,46 C14,38 26,42 30,50 L28,78 C26,88 20,95 12,92 C4,89 2,82 6,78 L20,52 C26,42 24,32 16,34 C10,36 6,32 8,26 L24,8 C28,4 30,2 28,5 Z"/></g>';
// Half rest: hat on line
const REST_HALF_PATH = '<path fill="#1a1a1a" d="M-40,-8 L40,-8 L35,8 L-35,8 Z"/>';
// Eighth: squiggle similar to quarter
const REST_EIGHTH_PATH = '<g transform="translate(-12,-45) scale(0.6)"><path fill="#1a1a1a" d="M28,5 C35,5 38,12 36,22 L34,45 C30,62 22,72 12,68 C4,64 2,54 8,46 C14,38 26,42 30,50 L28,78 C26,88 20,95 12,92 C4,89 2,82 6,78 L20,52 C26,42 24,32 16,34 C10,36 6,32 8,26 L24,8 C28,4 30,2 28,5 Z"/></g>';
const REST_16TH_PATH = '<g transform="translate(-8,-48) scale(0.5)"><path fill="#1a1a1a" d="M28,5 C35,5 38,12 36,22 L34,45 C30,62 22,72 12,68 C4,64 2,54 8,46 C14,38 26,42 30,50 L28,78 C26,88 20,95 12,92 C4,89 2,82 6,78 L20,52 C26,42 24,32 16,34 C10,36 6,32 8,26 L24,8 C28,4 30,2 28,5 Z"/></g>';
const REST_32ND_PATH = '<g transform="translate(-5,-50) scale(0.4)"><path fill="#1a1a1a" d="M28,5 C35,5 38,12 36,22 L34,45 C30,62 22,72 12,68 C4,64 2,54 8,46 C14,38 26,42 30,50 L28,78 C26,88 20,95 12,92 C4,89 2,82 6,78 L20,52 C26,42 24,32 16,34 C10,36 6,32 8,26 L24,8 C28,4 30,2 28,5 Z"/></g>';

async function main() {
  const sharp = (await import('sharp')).default;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fontUrl = lelandFontDataUrl();
  const textStyle = 'font-family:\'Leland\',sans-serif; font-size:120; fill:#1a1a1a; text-anchor:middle; dominant-baseline:middle';
  const textStyleOutline = 'font-family:\'Leland\',sans-serif; font-size:120; fill:none; stroke:#1a1a1a; stroke-width:2; text-anchor:middle; dominant-baseline:middle';

  // SMuFL: clefs, noteheads, rests; precomposed notes (note+stem+flag in one glyph) from font
  const smufl = {
    gClef: '\uE050', fClef: '\uE062', cClef: '\uE05C',
    noteheadWhole: '\uE0A2', noteheadHalf: '\uE0A3', noteheadBlack: '\uE0A4',
    noteWhole: '\uE1D2', noteHalfUp: '\uE1D3', noteQuarterUp: '\uE1D5',
    note8thUp: '\uE1D7', note16thUp: '\uE1D9', note32ndUp: '\uE1DB',
    restWhole: '\uE4E3', restHalf: '\uE4E4', restQuarter: '\uE4E5',
    rest8th: '\uE4E6', rest16th: '\uE4E7', rest32nd: '\uE4E8',
  };

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

  // Clefs (Leland)
  [
    { id: 'clef-treble', content: `<text x="0" y="0" style="${textStyle}">${smufl.gClef}</text>` },
    { id: 'clef-bass', content: `<text x="0" y="0" style="${textStyle}">${smufl.fClef}</text>` },
    { id: 'clef-c', content: `<text x="0" y="0" style="${textStyle}">${smufl.cClef}</text>` },
  ].forEach(({ id, content }) => toExport.push({ id, svg: svgWrap(content, SIZE, SIZE, fontUrl) }));

  // JO clef
  const joClef = `<g transform="translate(0,0) scale(0.6) translate(0,-40)"><rect x="0" y="0" width="12" height="80" fill="#000"/><rect x="15" y="0" width="40" height="32" fill="#000"/><rect x="15" y="48" width="40" height="32" fill="#000"/></g>`;
  toExport.push({ id: 'clef-jo', svg: svgWrap(joClef) });

  // Notes: use Leland precomposed glyphs (note+stem+flag in one character) so previews match font design
  toExport.push({ id: 'note-whole', svg: svgWrap(`<text x="0" y="0" style="${textStyle}">${smufl.noteheadWhole}</text>`, SIZE, SIZE, fontUrl) });
  toExport.push({ id: 'note-half-up', svg: svgWrap(`<text x="0" y="0" style="${textStyleOutline}">${smufl.noteHalfUp}</text>`, SIZE, SIZE, fontUrl) });
  toExport.push({ id: 'note-quarter-up', svg: svgWrap(`<text x="0" y="0" style="${textStyle}">${smufl.noteQuarterUp}</text>`, SIZE, SIZE, fontUrl) });
  toExport.push({ id: 'note-eighth-up', svg: svgWrap(`<text x="0" y="0" style="${textStyle}">${smufl.note8thUp}</text>`, SIZE, SIZE, fontUrl) });
  toExport.push({ id: 'note-16th-up', svg: svgWrap(`<text x="0" y="0" style="${textStyle}">${smufl.note16thUp}</text>`, SIZE, SIZE, fontUrl) });
  toExport.push({ id: 'note-32nd-up', svg: svgWrap(`<text x="0" y="0" style="${textStyle}">${smufl.note32ndUp}</text>`, SIZE, SIZE, fontUrl) });

  // Rests (Leland first; fallback paths used if font fails)
  [
    { id: 'rest-whole', font: `<text x="0" y="0" style="${textStyle}">${smufl.restWhole}</text>`, path: REST_WHOLE_PATH },
    { id: 'rest-half', font: `<text x="0" y="0" style="${textStyle}">${smufl.restHalf}</text>`, path: REST_HALF_PATH },
    { id: 'rest-quarter', font: `<text x="0" y="0" style="${textStyle}">${smufl.restQuarter}</text>`, path: REST_QUARTER_PATH },
    { id: 'rest-eighth', font: `<text x="0" y="0" style="${textStyle}">${smufl.rest8th}</text>`, path: REST_EIGHTH_PATH },
    { id: 'rest-16th', font: `<text x="0" y="0" style="${textStyle}">${smufl.rest16th}</text>`, path: REST_16TH_PATH },
    { id: 'rest-32nd', font: `<text x="0" y="0" style="${textStyle}">${smufl.rest32nd}</text>`, path: REST_32ND_PATH },
  ].forEach(({ id, font, path: pathContent }) => {
    toExport.push({ id, svg: svgWrap(font, SIZE, SIZE, fontUrl), pathFallback: pathContent });
  });

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

  // Bass staff with notes (Eb, A, F, D, Bb) — font embedded for Sharp
  const bassStaffFontDef = fontUrl ? `<defs><style>@font-face{font-family:'Leland';src:url('${fontUrl}') format('woff2');} text.leland{font-family:Leland,sans-serif;fill:#1a1a1a} text.acc{font-family:Leland,sans-serif;font-size:22px;fill:#1a1a1a}</style></defs>` : '<defs><style>text.leland{font-family:sans-serif;fill:#1a1a1a} text.acc{font-size:22px;fill:#1a1a1a}</style></defs>';
  const bassStaffSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 100" width="340" height="100">
  <rect width="340" height="100" fill="#fff"/>
  ${bassStaffFontDef}
  <line x1="40" x2="320" y1="34" y2="34" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="42" y2="42" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="50" y2="50" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="58" y2="58" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" x2="320" y1="66" y2="66" stroke="#1a1a1a" stroke-width="1"/>
  <text class="leland" x="32" y="50" text-anchor="middle" dominant-baseline="middle" font-size="48">&#xE062;</text>
  <text class="acc" x="72" y="46" text-anchor="middle" dominant-baseline="middle">&#xE260;</text>
  <text class="leland" x="90" y="46" text-anchor="middle" dominant-baseline="middle" font-size="28">&#xE0A4;</text>
  <line x1="97" y1="46" x2="97" y2="18" stroke="#1a1a1a" stroke-width="1.2"/>
  <text class="leland" x="140" y="62" text-anchor="middle" dominant-baseline="middle" font-size="28">&#xE0A4;</text>
  <line x1="147" y1="62" x2="147" y2="34" stroke="#1a1a1a" stroke-width="1.2"/>
  <text class="leland" x="190" y="42" text-anchor="middle" dominant-baseline="middle" font-size="28">&#xE0A4;</text>
  <line x1="197" y1="42" x2="197" y2="14" stroke="#1a1a1a" stroke-width="1.2"/>
  <text class="leland" x="240" y="50" text-anchor="middle" dominant-baseline="middle" font-size="28">&#xE0A4;</text>
  <line x1="247" y1="50" x2="247" y2="22" stroke="#1a1a1a" stroke-width="1.2"/>
  <text class="acc" x="272" y="58" text-anchor="middle" dominant-baseline="middle">&#xE260;</text>
  <text class="leland" x="290" y="58" text-anchor="middle" dominant-baseline="middle" font-size="28">&#xE0A4;</text>
  <line x1="297" y1="58" x2="297" y2="30" stroke="#1a1a1a" stroke-width="1.2"/>
  <text x="90" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">E&#9837;</text>
  <text x="140" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">A</text>
  <text x="190" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">F</text>
  <text x="240" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">D</text>
  <text x="290" y="88" text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif">B&#9837;</text>
</svg>`;
  toExport.push({ id: 'bass-staff-eb-a-f-d-bb', svg: bassStaffSvg, rawSvg: true });

  const base64Images = [];
  let puppeteerUsed = false;
  let sharpFallbackWarned = false;

  for (const item of toExport) {
    const id = item.id;
    const safe = safeId(id);
    const outPath = path.join(OUT_DIR, `${safe}.png`);
    const isFontDependent = FONT_DEPENDENT_IDS.has(id);
    const w = item.rawSvg ? 340 : SIZE;
    const h = item.rawSvg ? 100 : SIZE;

    let pngBuffer = null;

    if (isFontDependent && fontUrl) {
      pngBuffer = await renderSvgWithPuppeteer(item.svg, w, h);
      if (pngBuffer) puppeteerUsed = true;
    }
    if (!pngBuffer) {
      if (isFontDependent && fontUrl && !sharpFallbackWarned) {
        console.warn('Puppeteer not available: traditional symbols (clefs, notes, rests) will render as missing glyphs. Install with: npm install puppeteer --save-dev');
        sharpFallbackWarned = true;
      }
      let svgToUse = item.svg;
      if (item.rawSvg) {
        svgToUse = item.svg;
      } else if (isFontDependent && item.pathFallback) {
        svgToUse = svgWrap(item.pathFallback, SIZE, SIZE);
      } else if (item.pathFallback) {
        try {
          pngBuffer = await sharp(Buffer.from(svgToUse)).png().toBuffer();
        } catch {
          svgToUse = svgWrap(item.pathFallback, SIZE, SIZE);
        }
      }
      if (!pngBuffer) {
        try {
          pngBuffer = await sharp(Buffer.from(svgToUse)).png().toBuffer();
        } catch (e) {
          if (item.pathFallback) {
            pngBuffer = await sharp(Buffer.from(svgWrap(item.pathFallback, SIZE, SIZE))).png().toBuffer();
          } else {
            console.warn('Skip', safe, e.message);
          }
        }
      }
    }

    if (pngBuffer) {
      fs.writeFileSync(outPath, pngBuffer);
      base64Images.push({ id, safeId: safe, base64: pngBuffer.toString('base64') });
      console.log('Saved', safe + '.png');
    }
  }
  if (puppeteerUsed) console.log('Traditional symbols (clefs, notes, rests) rendered with Leland in browser.');

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
