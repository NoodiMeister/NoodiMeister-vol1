import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'public', 'reference', 'key-signature-all-staves.svg');

const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

const SHARP_ORDER = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
const FLAT_ORDER = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];

const SHARP_COUNT = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 };
const FLAT_COUNT = { C: 0, F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 };

// 0 = bottom line
const TREBLE_SHARP_POS = [8, 5, 9, 6, 3, 7, 4];
const BASS_SHARP_POS = [6, 3, 7, 4, 1, 5, 2];
const TREBLE_FLAT_POS = [4, 7, 3, 6, 2, 5, 1];
const BASS_FLAT_POS = [2, 5, 1, 4, 0, 3, -1];

// Same visual logic as key-signature-6-standard.svg
const TREBLE_SHARP_DY = [-6, -6, -4, -6, -6, -6, -6];
const BASS_SHARP_DY = [-6, -6, -7, -6, -6, -6, -6];

const W = 1400;
const H = 2200;
const lineGap = 20;
const staffWidth = 540;
const keySigStartX = 190;
const dx = 34;

function yFromPos(bottomLineY, pos) {
  return bottomLineY - pos * (lineGap / 2);
}

function drawStaff(x, topY) {
  let s = '';
  for (let i = 0; i < 5; i += 1) {
    const y = topY + i * lineGap;
    s += `<line x1="${x}" y1="${y}" x2="${x + staffWidth}" y2="${y}" stroke="#111" stroke-width="1"/>`;
  }
  return s;
}

function drawKeySig({ x, topY, count, kind, clef }) {
  if (count <= 0) return '';
  const bottomLineY = topY + 4 * lineGap;
  const posArr =
    kind === 'sharp'
      ? (clef === 'treble' ? TREBLE_SHARP_POS : BASS_SHARP_POS)
      : (clef === 'treble' ? TREBLE_FLAT_POS : BASS_FLAT_POS);
  const glyph = kind === 'sharp' ? '&#xE262;' : '&#9837;';
  const family = kind === 'sharp' ? 'Bravura, serif' : 'Times New Roman, serif';
  const size = kind === 'sharp' ? 52 : 30;
  let s = '';
  for (let i = 0; i < count; i += 1) {
    const pos = posArr[i];
    const baseY = yFromPos(bottomLineY, pos);
    const dy =
      kind === 'sharp'
        ? (clef === 'treble' ? (TREBLE_SHARP_DY[i] ?? -6) : (BASS_SHARP_DY[i] ?? -6))
        : 0;
    const y = baseY + dy;
    s += `<text x="${x + keySigStartX + i * dx}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="${family}" font-size="${size}" fill="#111">${glyph}</text>`;
  }
  return s;
}

function drawRow({ y, key, count, kind }) {
  const leftX = 40;
  const trebleX = 250;
  const bassX = 840;
  const trebleTop = y;
  const bassTop = y;
  const accidentalNames = (kind === 'sharp' ? SHARP_ORDER : FLAT_ORDER).slice(0, count).join(', ') || '-';
  const countLabel = `${count}`;
  return `
    <text x="${leftX}" y="${y + 26}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#111">${key}</text>
    <text x="${leftX + 52}" y="${y + 26}" font-family="Arial, sans-serif" font-size="13" fill="#333">${countLabel}</text>
    <text x="${leftX + 86}" y="${y + 26}" font-family="Arial, sans-serif" font-size="12" fill="#444">${accidentalNames}</text>

    ${drawStaff(trebleX, trebleTop)}
    <text x="${trebleX + 10}" y="${trebleTop + 42}" font-family="Arial, sans-serif" font-size="12" fill="#444">treble</text>
    ${drawKeySig({ x: trebleX, topY: trebleTop, count, kind, clef: 'treble' })}

    ${drawStaff(bassX, bassTop)}
    <text x="${bassX + 10}" y="${bassTop + 42}" font-family="Arial, sans-serif" font-size="12" fill="#444">bass</text>
    ${drawKeySig({ x: bassX, topY: bassTop, count, kind, clef: 'bass' })}
  `;
}

let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Bravura';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('https://cdn.jsdelivr.net/npm/@fontsource/bravura@5.2.5/files/bravura-latin-400-normal.woff2') format('woff2');
      }
    ]]></style>
  </defs>
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111">
    Key signatures by key (separate staves, treble + bass)
  </text>
  <text x="${W / 2}" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#444">
    Uses the same placement logic as public/reference/key-signature-6-standard.svg
  </text>

  <text x="40" y="96" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111">Sharp keys</text>
`;

let y = 120;
const rowGap = 116;
for (const key of SHARP_KEYS) {
  svg += drawRow({ y, key, count: SHARP_COUNT[key], kind: 'sharp' });
  y += rowGap;
}

svg += `<line x1="40" y1="${y - 18}" x2="${W - 40}" y2="${y - 18}" stroke="#d1d5db"/>`;
svg += `<text x="40" y="${y + 16}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111">Flat keys</text>`;
y += 40;

for (const key of FLAT_KEYS) {
  svg += drawRow({ y, key, count: FLAT_COUNT[key], kind: 'flat' });
  y += rowGap;
}

svg += `
</svg>`;

fs.writeFileSync(outPath, svg, 'utf8');
console.log('Wrote', outPath);

