/**
 * Export piano instrument staff (grand staff) to PNG: treble clef on top staff, bass clef on bottom staff, with brace.
 * Run: node scripts/export-piano-staff-png.js
 * Requires: npm install puppeteer --save-dev, public/fonts/Leland.woff2
 * Writes: docs/symbol-previews/piano-staff.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const OUT_PATH = path.join(OUT_DIR, 'piano-staff.png');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Leland.woff2');

const staffSpace = 10;
const staffHeight = 5 * staffSpace; // 50
const grandGap = 90;
const padTop = 24;
const padBottom = 24;
const width = 360;
const height = 260;
const staffLeft = 0;
const staffRight = 320;
const lineX = 16;
const clefX = 28;

// Treble staff: lines at padTop + 0, 10, 20, 30, 40
const trebleLineYs = [0, 1, 2, 3, 4].map((i) => i * staffSpace);
const TREBLE_G_LINE_INDEX = 3;
const trebleGLine = trebleLineYs[TREBLE_G_LINE_INDEX];
const spiralAlignDy = staffSpace * 0.35;
const trebleClefSvgY = padTop + trebleGLine + spiralAlignDy;

// Bass staff: lines at padTop + staffHeight + grandGap + 0..40
const bassStaffTop = padTop + staffHeight + grandGap;
const bassLineYs = [0, 1, 2, 3, 4].map((i) => i * staffSpace);
const BASS_F_LINE_INDEX = 1;
const bassFLine = bassLineYs[BASS_F_LINE_INDEX];
const bassClefAlignDy = staffSpace * 0.35;
const bassClefOneStaffHigher = -staffSpace;
const clefFontSize = staffSpace * 4;
const bassClefSvgY = bassStaffTop + bassFLine + bassClefAlignDy + bassClefOneStaffHigher;

// Brace (piano grand staff left edge)
const braceTop = padTop + 2;
const braceBottom = bassStaffTop + staffHeight - 2;
const braceH = braceBottom - braceTop;
const braceLeft = 2;
const bracePathD = `M ${lineX - 2} ${braceTop} Q ${braceLeft} ${braceTop + braceH * 0.25} ${braceLeft} ${braceTop + braceH / 2} Q ${braceLeft} ${braceBottom - braceH * 0.25} ${lineX - 2} ${braceBottom}`;

// Treble clef path (from export-treble-clef-on-staff-png.js)
const TREBLE_PATH_D = 'm2002 7851c-61 17-116 55-167 113-51 59-76 124-76 194 0 44 15 94 44 147 29 54 73 93 130 118 19 4 28 14 28 28 0 5-7 10-24 14-91-23-166-72-224-145-58-74-88-158-90-254 3-103 34-199 93-287 60-89 137-152 231-189l-69-355c-154 128-279 261-376 401-97 139-147 290-151 453 2 73 17 144 45 212 28 69 70 131 126 188 113 113 260 172 439 178 61-4 126-15 196-33l-155-783zm72-10l156 769c154-62 231-197 231-403-9-69-29-131-63-186-33-56-77-100-133-132s-119-48-191-48zm-205-1040c33-20 71-55 112-104 41-48 81-105 119-169 39-65 70-131 93-198 23-66 34-129 34-187 0-25-2-50-7-72-4-36-15-64-34-83-19-18-43-28-73-28-60 0-114 37-162 111-37 64-68 140-90 226-23 87-36 173-38 260 5 99 21 180 46 244zm-63 58c-45-162-70-327-75-495 1-108 12-209 33-303 20-94 49-175 87-245 37-70 80-123 128-159 43-32 74-49 91-49 13 0 24 5 34 14s23 24 39 44c119 169 179 373 179 611 0 113-15 223-45 333-29 109-72 213-129 310-58 98-126 183-205 256l81 394c44-5 74-9 91-9 76 0 144 16 207 48s117 75 161 130c44 54 78 116 102 186 23 70 36 143 36 219 0 118-31 226-93 323s-155 168-280 214c8 49 22 120 43 211 20 92 35 165 45 219s14 106 14 157c0 79-19 149-57 211-39 62-91 110-157 144-65 34-137 51-215 51-110 0-206-31-288-92-82-62-126-145-130-251 3-47 14-91 34-133s47-76 82-102c34-27 75-41 122-44 39 0 76 11 111 32 34 22 62 51 83 88 20 37 31 78 31 122 0 59-20 109-60 150s-91 62-152 62h-23c39 60 103 91 192 91 45 0 91-10 137-28 47-19 86-44 119-76s55-66 64-102c17-41 25-98 25-169 0-48-5-96-14-144-9-47-23-110-42-188-19-77-33-137-41-178-60 15-122 23-187 23-109 0-212-22-309-67s-182-107-256-187c-73-80-130-170-171-272-40-101-61-207-62-317 4-102 23-200 59-292 36-93 82-181 139-263s116-157 177-224c62-66 143-151 245-254z';
const trebleScale = (staffSpace * 4) / 887.51;
const trebleCenterX = 182.5;
const trebleCenterY = 489;

const F_CLEF = '\uE062'; // SMuFL bass clef in Leland

function lelandFontDataUrl() {
  if (!fs.existsSync(FONT_PATH)) return null;
  const woff2 = fs.readFileSync(FONT_PATH);
  return `data:font/woff2;base64,${woff2.toString('base64')}`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fontUrl = lelandFontDataUrl();
  if (!fontUrl) {
    console.error('Leland.woff2 not found at', FONT_PATH);
    process.exit(1);
  }

  const trebleStaffLines = trebleLineYs
    .map((y) => `<line x1="${staffLeft}" y1="${padTop + y}" x2="${staffRight}" y2="${padTop + y}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const bassStaffLines = bassLineYs
    .map((y) => `<line x1="${staffLeft}" y1="${bassStaffTop + y}" x2="${staffRight}" y2="${bassStaffTop + y}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');

  const trebleClefGroup = `<g transform="translate(${clefX}, ${trebleClefSvgY}) scale(${trebleScale}) translate(${-trebleCenterX}, ${-trebleCenterY}) matrix(0.21599 0 0 0.21546 -250.44 -1202.6)"><path d="${TREBLE_PATH_D}" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="53"/></g>`;
  const bassClefText = `<text x="${clefX}" y="${bassClefSvgY}" font-family="Leland,sans-serif" font-size="${clefFontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${F_CLEF}</text>`;

  const fontStyle = `@font-face{font-family:'Leland';src:url('${fontUrl}') format('woff2');}`;
  const svgContent = `
  <rect width="100%" height="100%" fill="#fff"/>
  <line x1="${lineX}" y1="${braceTop}" x2="${lineX}" y2="${braceBottom}" stroke="#000" stroke-width="3"/>
  <path d="${bracePathD}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  ${trebleStaffLines}
  ${bassStaffLines}
  ${trebleClefGroup}
  ${bassClefText}
`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${fontStyle}</style><style>
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${svgContent}
</svg></body></html>`;

  const htmlPath = path.join(OUT_DIR, 'piano-staff.html');
  fs.writeFileSync(htmlPath, html);
  console.log('Saved', htmlPath, '(open in browser to view)');

  try {
    const Puppeteer = (await import('puppeteer')).default;
    const browser = await Puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 300));

    const el = await page.$('svg');
    const pngBuffer = await el.screenshot({ type: 'png' });
    await browser.close();

    fs.writeFileSync(OUT_PATH, Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer));
    console.log('Saved', OUT_PATH);
  } catch (e) {
    console.warn('Puppeteer PNG export skipped:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
