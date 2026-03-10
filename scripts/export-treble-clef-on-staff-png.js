/**
 * Export treble clef on staff to PNG. Path-based (no Puppeteer).
 * Run: node scripts/export-treble-clef-on-staff-png.js
 * Writes: docs/symbol-previews/treble-clef-on-staff.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const OUT_PATH = path.join(OUT_DIR, 'treble-clef-on-staff.png');

const staffSpace = 10;
const half = staffSpace / 2;
const centerY = 80;
const startY = centerY - 2 * staffSpace;
const staffLinePositions = [0, 1, 2, 3, 4].map((i) => startY + i * staffSpace);
const TREBLE_CLEF_LINE_INDEX = 3;
const gLine = staffLinePositions[TREBLE_CLEF_LINE_INDEX];
const clefX = 28;
const staffLeft = 0;
const staffRight = 320;
const width = 360;
const height = 220;
const padTop = 24;

const lineNames = ['F5', 'D5', 'B4', 'G4', 'E4'];
const gapNames = ['E5', 'C5', 'A4', 'F4'];
const gapY = (i) => startY + (i + 0.5) * staffSpace;
const firstLineY = staffLinePositions[0];
const lastLineY = staffLinePositions[4];
const ledgerBelowY = (n) => (n === 1 ? lastLineY + half : lastLineY + 3 * half);
const ledgerAboveY = (n) => (n === 1 ? firstLineY - half : firstLineY - 3 * half);

// Path from public/trebleclefsymbol.svg (path9); matrix from original puts it in viewBox space
const TREBLE_PATH_D = 'm2002 7851c-61 17-116 55-167 113-51 59-76 124-76 194 0 44 15 94 44 147 29 54 73 93 130 118 19 4 28 14 28 28 0 5-7 10-24 14-91-23-166-72-224-145-58-74-88-158-90-254 3-103 34-199 93-287 60-89 137-152 231-189l-69-355c-154 128-279 261-376 401-97 139-147 290-151 453 2 73 17 144 45 212 28 69 70 131 126 188 113 113 260 172 439 178 61-4 126-15 196-33l-155-783zm72-10l156 769c154-62 231-197 231-403-9-69-29-131-63-186-33-56-77-100-133-132s-119-48-191-48zm-205-1040c33-20 71-55 112-104 41-48 81-105 119-169 39-65 70-131 93-198 23-66 34-129 34-187 0-25-2-50-7-72-4-36-15-64-34-83-19-18-43-28-73-28-60 0-114 37-162 111-37 64-68 140-90 226-23 87-36 173-38 260 5 99 21 180 46 244zm-63 58c-45-162-70-327-75-495 1-108 12-209 33-303 20-94 49-175 87-245 37-70 80-123 128-159 43-32 74-49 91-49 13 0 24 5 34 14s23 24 39 44c119 169 179 373 179 611 0 113-15 223-45 333-29 109-72 213-129 310-58 98-126 183-205 256l81 394c44-5 74-9 91-9 76 0 144 16 207 48s117 75 161 130c44 54 78 116 102 186 23 70 36 143 36 219 0 118-31 226-93 323s-155 168-280 214c8 49 22 120 43 211 20 92 35 165 45 219s14 106 14 157c0 79-19 149-57 211-39 62-91 110-157 144-65 34-137 51-215 51-110 0-206-31-288-92-82-62-126-145-130-251 3-47 14-91 34-133s47-76 82-102c34-27 75-41 122-44 39 0 76 11 111 32 34 22 62 51 83 88 20 37 31 78 31 122 0 59-20 109-60 150s-91 62-152 62h-23c39 60 103 91 192 91 45 0 91-10 137-28 47-19 86-44 119-76s55-66 64-102c17-41 25-98 25-169 0-48-5-96-14-144-9-47-23-110-42-188-19-77-33-137-41-178-60 15-122 23-187 23-109 0-212-22-309-67s-182-107-256-187c-73-80-130-170-171-272-40-101-61-207-62-317 4-102 23-200 59-292 36-93 82-181 139-263s116-157 177-224c62-66 143-151 245-254z';
const spiralAlignDy = staffSpace * 0.35;
const clefY = padTop + gLine + spiralAlignDy;
const trebleScale = (staffSpace * 4) / 887.51;
const trebleCenterX = 182.5;
const trebleCenterY = 489;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sharp = (await import('sharp')).default;

  const ledgerHalfWidth = staffSpace * 1.4;
  const staffLines = staffLinePositions
    .map((y) => `<line x1="${staffLeft}" y1="${padTop + y}" x2="${staffRight}" y2="${padTop + y}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const lineLabels = staffLinePositions
    .map((y, i) => `<text x="${staffRight + 12}" y="${padTop + y}" font-family="sans-serif" font-size="11" fill="#666">${lineNames[i]}</text>`)
    .join('\n  ');
  const gapLabels = [0, 1, 2, 3]
    .map((i) => `<text x="${staffRight + 12}" y="${padTop + gapY(i)}" font-family="sans-serif" font-size="10" fill="#999">${gapNames[i]}</text>`)
    .join('\n  ');

  const ledgerLinesBelow = [1, 2]
    .map((n) => `<line x1="${clefX - ledgerHalfWidth}" y1="${padTop + ledgerBelowY(n)}" x2="${clefX + ledgerHalfWidth}" y2="${padTop + ledgerBelowY(n)}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const ledgerLabelsBelow = [
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(1)}" font-family="sans-serif" font-size="10" fill="#666">C4 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(2)}" font-family="sans-serif" font-size="10" fill="#666">A3 (2nd ledger)</text>`,
  ].join('\n  ');
  const ledgerLinesAbove = [1, 2]
    .map((n) => `<line x1="${clefX - ledgerHalfWidth}" y1="${padTop + ledgerAboveY(n)}" x2="${clefX + ledgerHalfWidth}" y2="${padTop + ledgerAboveY(n)}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const ledgerLabelsAbove = [
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(1)}" font-family="sans-serif" font-size="10" fill="#666">A5 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(2)}" font-family="sans-serif" font-size="10" fill="#666">C6 (2nd ledger)</text>`,
  ].join('\n  ');

  const trebleClefGroup = `<g transform="translate(${clefX}, ${clefY}) scale(${trebleScale}) translate(${-trebleCenterX}, ${-trebleCenterY}) matrix(0.21599 0 0 0.21546 -250.44 -1202.6)"><path d="${TREBLE_PATH_D}" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="53"/></g>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${ledgerLinesAbove}
  ${staffLines}
  ${ledgerLinesBelow}
  ${trebleClefGroup}
  ${lineLabels}
  ${gapLabels}
  ${ledgerLabelsAbove}
  ${ledgerLabelsBelow}
  <text x="${clefX}" y="${padTop + 2 * staffSpace + 22}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="middle">clef center = G line</text>
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(OUT_PATH, pngBuffer);
  console.log('Saved', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
