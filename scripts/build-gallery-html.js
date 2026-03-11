/**
 * Build gallery.html with PNGs embedded as base64 so it works when opened from anywhere (file://, Cursor, server).
 * Run: node scripts/build-gallery-html.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const GALLERY_PATH = path.join(PREVIEWS_DIR, 'gallery.html');

const DEFINITIONS = `
  <h2>1. Leland font (SMuFL)</h2>
  <p><strong>Font file:</strong></p>
  <div class="font-path"><code>public/fonts/Leland.woff2</code></div>
  <p>Symbols that use Leland are rendered by drawing a single character (SMuFL codepoint) in that font.</p>
  <table>
    <thead><tr><th>Glyph name</th><th>Codepoint</th><th>Used in PNGs</th></tr></thead>
    <tbody>
      <tr><td>fClef (bass)</td><td><code>U+E062</code></td><td>clef-bass, bass-staff-eb-a-f-d-bb</td></tr>
      <tr><td>cClef (Aldivõti / alto)</td><td><code>U+E05C</code></td><td>clef-c; placement: c-clef-on-staff</td></tr>
      <tr><td>noteheadWhole</td><td><code>U+E0A2</code></td><td>bass-staff (noteheads)</td></tr>
      <tr><td>noteheadHalf</td><td><code>U+E0A3</code></td><td>—</td></tr>
      <tr><td>noteheadBlack</td><td><code>U+E0A4</code></td><td>bass-staff (noteheads)</td></tr>
      <tr><td>restWhole … rest32nd</td><td><code>U+E4E3</code>–<code>U+E4E8</code></td><td>— (app uses Leland; no PNG previews)</td></tr>
      <tr><td>flat</td><td><code>U+E260</code></td><td>bass-staff (E♭, B♭)</td></tr>
    </tbody>
  </table>
  <h2>2. How each symbol is defined</h2>
  <table>
    <thead><tr><th>PNG file</th><th>Definition</th></tr></thead>
    <tbody>
      <tr><td>clef-bass.png</td><td>Leland U+E062 (fClef)</td></tr>
      <tr><td>clef-c.png</td><td>Leland U+E05C (cClef / Aldivõti), symbol only</td></tr>
      <tr><td>c-clef-on-staff.png</td><td>Aldivõti placement on staff (clef center = middle C); symbol = clef-c.png</td></tr>
      <tr><td>figurenotes-A.png … G.png</td><td>SVG path: colored shapes (FIGURE_SHAPES)</td></tr>
      <tr><td>octave-1-empty … octave-5-triangle</td><td>SVG: dashed square, X, square, circle, triangle</td></tr>
      <tr><td>octave-2-cross-coordinate-table.png</td><td>SVG: grid + X hexagons</td></tr>
      <tr><td>bass-staff-eb-a-f-d-bb.png</td><td>Composite: staff + Leland clef + noteheads + stems + flats</td></tr>
    </tbody>
  </table>
  <h2>3. Gallery (images embedded – works when opened from anywhere)</h2>
`;

function main() {
  const pngFiles = fs.readdirSync(PREVIEWS_DIR).filter((f) => f.endsWith('.png')).sort();
  const cells = [];
  for (const file of pngFiles) {
    const filePath = path.join(PREVIEWS_DIR, file);
    const buf = fs.readFileSync(filePath);
    const base64 = buf.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;
    cells.push(`<div class="cell"><img src="${dataUrl}" alt="${file}"/><div class="name">${file}</div></div>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Symbol gallery – all PNGs + Leland definitions</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #fafafa; color: #1a1a1a; margin: 0; padding: 20px; max-width: 1200px; margin-left: auto; margin-right: auto; }
    h1 { font-size: 1.35rem; margin: 0 0 8px 0; }
    h2 { font-size: 1.1rem; margin: 24px 0 12px 0; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    p { margin: 0 0 12px 0; color: #4b5563; font-size: 0.9rem; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .cell { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
    .cell img { display: block; width: 100%; height: 110px; object-fit: contain; margin: 0 auto; background: #fff; }
    .cell .name { font-size: 0.7rem; color: #C7BAB7; margin-top: 6px; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; color: #374151; font-weight: 600; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
    .font-path { background: #eff6ff; padding: 10px 12px; border-radius: 6px; margin: 8px 0; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>Symbol gallery – all created PNGs</h1>
  <p>Every symbol PNG in this folder, plus how they are defined (Leland font vs SVG paths). <strong>Images are embedded</strong> so this file works when opened from anywhere (double‑click, Cursor preview, or any server).</p>
  ${DEFINITIONS}
  <div class="grid">
    ${cells.join('\n    ')}
  </div>
</body>
</html>`;

  fs.writeFileSync(GALLERY_PATH, html, 'utf8');
  console.log('Written', GALLERY_PATH);

  // Also write inspect.html with same embedded images (grid only, no definitions)
  const inspectCells = pngFiles.map((file) => {
    const buf = fs.readFileSync(path.join(PREVIEWS_DIR, file));
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    return `<div class="cell"><img src="${dataUrl}" alt="${file}"/><div class="name">${file}</div></div>`;
  });
  const inspectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Symbol PNGs – inspect</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #e5e5e5; margin: 0; padding: 16px; }
    h1 { font-size: 1.1rem; margin: 0 0 16px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .cell { background: #2d2d2d; border: 1px solid #444; border-radius: 8px; padding: 10px; text-align: center; }
    .cell img { display: block; width: 100%; height: 120px; object-fit: contain; margin: 0 auto; background: #fff; border-radius: 4px; }
    .cell .name { font-size: 0.7rem; color: #9ca3af; margin-top: 6px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Symbol PNGs – inspect (images embedded)</h1>
  <div class="grid">${inspectCells.join('\n    ')}</div>
</body>
</html>`;
  const inspectPath = path.join(PREVIEWS_DIR, 'inspect.html');
  fs.writeFileSync(inspectPath, inspectHtml, 'utf8');
  console.log('Written', inspectPath);

  console.log('Embedded', pngFiles.length, 'PNG images in both files. Open in any browser – they will work.');
}

main();
