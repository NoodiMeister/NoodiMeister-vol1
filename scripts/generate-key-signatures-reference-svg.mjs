/**
 * Genereerib public/key-signatures-reference-table.svg
 *
 * Viide: Wikimedia Commons — „Positions of ♯ and ♭ in Key Signatures in 4 Clefs”
 *   https://commons.wikimedia.org/wiki/File:Positions_of_%E2%99%AF_and_%E2%99%AD_in_Key_Signatures_in_4_Clefs.svg
 *   (täiskoopia: public/reference/key-signatures-wikimedia-4-clefs.svg)
 * Mõõdetud sellest SVG-st: noodijoonte vahe W=327 ühikut; järjestised dieeside keskpunktid
 * on täpselt W kaugusel (1 staff space); 5 joont → 4×W vertikaalne samm.
 *
 * Võtmed: sama ankur kui src/components/ClefSymbols.jsx + TraditionalNotationView.jsx
 *   — treble: y = G/B ankur @ staffLinePositions[TREBLE_CLEF_LINE_INDEX] + spiralAlignDy (0.35 sp)
 *   — bass: y = F-joon @ staffLinePositions[1]
 *   — fontSize = 4× staff-space (musescoreStyle GLYPH_FONT_SIZE_SP)
 *
 * Võtmemärgid: horisontaalne vahe 1,0× staff-space (Wikimedia); vertikaalne paigutus
 * kvintiring / BEADGCF (täis 7), staff-indeks = StaffConstants getYFromStaffPosition.
 * SMuFL: võtmemärgi glüüfi fontSize ≈ 2,5× staff-space (bemollid); dieesid veidi suuremad (2,75×sp)
 * ilma transform/nihuta — yy jääb getYFromStaffPosition (ei tõsta ega nihuta võtmemärke).
 *
 * Font: Bravura WOFF2 (sama SMuFL allikas mis exportFontAssets / eelvaated).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'key-signatures-reference-table.svg');
const WM_MEASURED_JSON = path.join(__dirname, 'wikimedia-measured-key-positions.json');

/** @see src/views/TraditionalNotationView.jsx */
const GAP_BEFORE_CLEF_PX = 6;
const CLEF_WIDTH = 45;
const TREBLE_CLEF_LINE_INDEX = 2;

/** @see src/notation/musescoreStyle.js — Leland engravingDefaults */
const STAFF_LINE_WIDTH_SP = 0.11;
const GLYPH_FONT_SIZE_SP = 4;
/** Bemollid — Wikimedia 4-clefs chart proportion (~2.5 sp); app UI uses ~1.8 sp */
const KEY_SIG_ACCIDENTAL_SP = 2.5;
/** Dieesid: suurem font (ainult suurus, mitte translate/scale — ankur yy muutmata) */
const KEY_SIG_SHARP_FONT_SP = 2.75;
/** Successive key-sig accidentals spaced 1 staff space (measured on Wikimedia SVG) */
const KEY_SIG_DX_SP = 1.0;

const STAFF_SPACE = 10;
const SPIRAL_ALIGN_DY = STAFF_SPACE * 0.35;

const SMUFL = {
  gClef: '\uE050',
  fClef: '\uE062',
  accidentalSharp: '\uE262',
  accidentalFlat: '\uE260',
};

/**
 * @see StaffConstants.getStaffLinePositions — centerY = joonestiku keskpunkt
 */
function getStaffLinePositions(centerY, staffLines = 5, staffSpace = STAFF_SPACE) {
  const startY = centerY - 2 * staffSpace;
  return Array.from({ length: staffLines }, (_, i) => startY + i * staffSpace);
}

/**
 * @see StaffConstants.getYFromStaffPosition
 */
function getYFromStaffPosition(position, centerY, staffLines = 5, staffSpace = STAFF_SPACE) {
  const lines = getStaffLinePositions(centerY, staffLines, staffSpace);
  const bottomLineY = lines[lines.length - 1];
  return bottomLineY - position * (staffSpace / 2);
}

/**
 * Standard võtmemärkide vertikaalsed indeksid (0 = alumine joon), SMuFL/MuseScore-tüüpi
 * paigutus: dieesid F♯→… kvintiring; bemollid B♭→… kvintiring vastupidises järjekorras.
 * Tuletatakse sama loogikaga nagu getVerticalPosition (StaffConstants) — täis 7 märki.
 */
const PITCH_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

function trebleStaffIndex(pitch, octave) {
  const rel = PITCH_INDEX[pitch];
  return (octave - 4) * 7 + rel - 2;
}

function bassStaffIndex(pitch, octave) {
  const rel = PITCH_INDEX[pitch];
  return (octave - 2) * 7 + rel - 4;
}

// F♯, C♯, G♯, D♯, A♯, E♯, B♯ — oktavid nagu klassikalises graveeringus
const TREBLE_SHARP_POS = [
  trebleStaffIndex('F', 5),
  trebleStaffIndex('C', 5),
  trebleStaffIndex('G', 5),
  trebleStaffIndex('D', 5),
  trebleStaffIndex('A', 4),
  trebleStaffIndex('E', 5),
  trebleStaffIndex('B', 4),
];

// B♭, E♭, A♭, D♭, G♭, C♭, F♭
const TREBLE_FLAT_POS = [
  trebleStaffIndex('B', 4),
  trebleStaffIndex('E', 4),
  trebleStaffIndex('A', 4),
  trebleStaffIndex('D', 5),
  trebleStaffIndex('G', 4),
  trebleStaffIndex('C', 5),
  trebleStaffIndex('F', 4),
];

const BASS_SHARP_POS = [
  bassStaffIndex('F', 3),
  bassStaffIndex('C', 3),
  bassStaffIndex('G', 3),
  bassStaffIndex('D', 3),
  bassStaffIndex('A', 2),
  bassStaffIndex('E', 3),
  bassStaffIndex('B', 2),
];

const BASS_FLAT_POS = [
  bassStaffIndex('B', 2),
  bassStaffIndex('E', 3),
  bassStaffIndex('A', 2),
  bassStaffIndex('D', 3),
  bassStaffIndex('G', 2),
  bassStaffIndex('C', 3),
  bassStaffIndex('F', 3),
];

/** Kui olemas: scripts/analyze-wikimedia-keysig-images.mjs väljund (noodijooned + tippude kinnitus) */
function loadMeasuredStaffPositions() {
  try {
    const raw = fs.readFileSync(WM_MEASURED_JSON, 'utf8');
    const j = JSON.parse(raw);
    const ts = j.trebleSharpStaffPositions;
    const tf = j.trebleFlatStaffPositions;
    if (
      Array.isArray(ts) &&
      ts.length === 7 &&
      Array.isArray(tf) &&
      tf.length === 7 &&
      ts.every((n) => typeof n === 'number') &&
      tf.every((n) => typeof n === 'number')
    ) {
      return {
        trebleSharp: ts,
        trebleFlat: tf,
        peakOk: j.allReferenceImagesPeakCountOk === true,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

const measured = loadMeasuredStaffPositions();
const TREBLE_SHARP_POS_FINAL = measured ? measured.trebleSharp : TREBLE_SHARP_POS;
const TREBLE_FLAT_POS_FINAL = measured ? measured.trebleFlat : TREBLE_FLAT_POS;

const SHARP_ORDER_LABEL = 'F♯, C♯, G♯, D♯, A♯, E♯, B♯';
const FLAT_ORDER_LABEL = 'B♭, E♭, A♭, D♭, G♭, C♭, F♭';

const MAJOR_KEYS_SHARPS = [
  { label: 'C-duur / a-moll', n: 0 },
  { label: 'G-duur / e-moll', n: 1 },
  { label: 'D-duur / h-moll', n: 2 },
  { label: 'A-duur / f♯-moll', n: 3 },
  { label: 'E-duur / c♯-moll', n: 4 },
  { label: 'H-duur / g♯-moll', n: 5 },
  { label: 'F♯-duur / d♯-moll', n: 6 },
  { label: 'C♯-duur / a♯-moll', n: 7 },
];

const MAJOR_KEYS_FLATS = [
  { label: 'C-duur / a-moll', n: 0 },
  { label: 'F-duur / d-moll', n: 1 },
  { label: 'B♭-duur / g-moll', n: 2 },
  { label: 'E♭-duur / c-moll', n: 3 },
  { label: 'A♭-duur / f-moll', n: 4 },
  { label: 'D♭-duur / b-moll', n: 5 },
  { label: 'G♭-duur / e♭-moll', n: 6 },
  { label: 'C♭-duur / a♭-moll', n: 7 },
];

const BRAVURA_WOFF2 =
  'https://cdn.jsdelivr.net/npm/@fontsource/bravura@5.2.5/files/bravura-latin-400-normal.woff2';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drawStaff(x0, yTop, width, centerYLocal) {
  const w = STAFF_SPACE * STAFF_LINE_WIDTH_SP;
  const lines = getStaffLinePositions(centerYLocal, 5, STAFF_SPACE);
  return lines
    .map((y) => `<line x1="${x0}" y1="${yTop + y}" x2="${x0 + width}" y2="${yTop + y}" stroke="#1a1a1a" stroke-width="${w}"/>`)
    .join('\n');
}

/**
 * clefX = võtme horisontaalankur (keskpunkt), nagu SmuflGlyph textAnchor middle.
 * Treble: ClefSymbols — y = G-ankur + spiralAlignDy
 * Bass: y = F-joon
 */
function drawClef(clef, clefX, yTop, centerYLocal, staffLinesY) {
  const fs = STAFF_SPACE * GLYPH_FONT_SIZE_SP;
  const ch = clef === 'treble' ? SMUFL.gClef : SMUFL.fClef;
  const trebleGLine = staffLinesY[TREBLE_CLEF_LINE_INDEX];
  const bassFLine = staffLinesY[1];
  const y =
    clef === 'treble'
      ? yTop + trebleGLine + SPIRAL_ALIGN_DY
      : yTop + bassFLine;
  return `<text x="${clefX}" y="${y}" font-family="Bravura,serif" font-size="${fs}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${ch}</text>`;
}

function drawKeySignature(positions, count, kind, keySigStartX, yTop, centerYLocal) {
  const sym = kind === 'sharp' ? SMUFL.accidentalSharp : SMUFL.accidentalFlat;
  const fontSize =
    kind === 'sharp'
      ? Math.round(STAFF_SPACE * KEY_SIG_SHARP_FONT_SP)
      : Math.round(STAFF_SPACE * KEY_SIG_ACCIDENTAL_SP);
  const keySigDx = Math.max(8, STAFF_SPACE * KEY_SIG_DX_SP);
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const pos = positions[i];
    const x = keySigStartX + i * keySigDx;
    const yy = yTop + getYFromStaffPosition(pos, centerYLocal, 5, STAFF_SPACE);
    out += `<text x="${x}" y="${yy}" font-family="Bravura,serif" font-size="${fontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${sym}</text>\n`;
  }
  return out;
}

function section(title, keys, positions, kind, clef, rowW, staffW, leftLabelW) {
  const centerYLocal = 42;
  const staffLinesY = getStaffLinePositions(centerYLocal, 5, STAFF_SPACE);
  const rowH = 78;
  let body = '';
  body += `<text x="8" y="22" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#111">${esc(title)}</text>`;
  body += `<text x="8" y="40" font-family="system-ui,sans-serif" font-size="10.5" fill="#555">${kind === 'sharp' ? esc(`Dieesid: ${SHARP_ORDER_LABEL}`) : esc(`Bemollid: ${FLAT_ORDER_LABEL}`)}</text>`;
  const yStart = 52;

  keys.forEach((row, idx) => {
    const yRow = yStart + idx * rowH;
    body += `<text x="8" y="${yRow + 38}" font-family="system-ui,sans-serif" font-size="11" fill="#333">${esc(row.label)}</text>`;
    body += `<text x="${leftLabelW - 6}" y="${yRow + 38}" font-family="system-ui,sans-serif" font-size="11" text-anchor="end" fill="#666">${row.n}</text>`;
    const x0 = leftLabelW + 8;
    const clefX = x0 + GAP_BEFORE_CLEF_PX;
    const keySigStartX = clefX + CLEF_WIDTH;
    body += drawStaff(x0, yRow, staffW, centerYLocal);
    body += drawClef(clef, clefX, yRow, centerYLocal, staffLinesY);
    body += drawKeySignature(positions, row.n, kind, keySigStartX, yRow, centerYLocal);
    body += `<line x1="0" y1="${yRow + rowH - 4}" x2="${rowW}" y2="${yRow + rowH - 4}" stroke="#eee"/>`;
  });

  const totalH = 52 + keys.length * rowH + 16;
  return { body, totalH };
}

const leftLabelW = 200;
const rowW = 920;
const staffW = 420;

const tSharp = section(
  'Viiulivõti — dieesid (suurhelistikud)',
  MAJOR_KEYS_SHARPS,
  TREBLE_SHARP_POS_FINAL,
  'sharp',
  'treble',
  rowW,
  staffW,
  leftLabelW
);
const tFlat = section(
  'Viiulivõti — bemollid (suurhelistikud)',
  MAJOR_KEYS_FLATS,
  TREBLE_FLAT_POS_FINAL,
  'flat',
  'treble',
  rowW,
  staffW,
  leftLabelW
);
const bSharp = section('Bassivõti — dieesid (suurhelistikud)', MAJOR_KEYS_SHARPS, BASS_SHARP_POS, 'sharp', 'bass', rowW, staffW, leftLabelW);
const bFlat = section('Bassivõti — bemollid (suurhelistikud)', MAJOR_KEYS_FLATS, BASS_FLAT_POS, 'flat', 'bass', rowW, staffW, leftLabelW);

let cursorY = 24;
const margin = 16;
const blocks = [
  { html: tSharp.body, h: tSharp.totalH },
  { html: tFlat.body, h: tFlat.totalH },
  { html: bSharp.body, h: bSharp.totalH },
  { html: bFlat.body, h: bFlat.totalH },
];

let svgInner = '';
blocks.forEach((b, i) => {
  svgInner += `<g transform="translate(${margin}, ${cursorY})">${b.html}</g>\n`;
  cursorY += b.h + (i < blocks.length - 1 ? 28 : 0);
});

const totalHeight = cursorY + margin + 36;
const svgW = rowW + margin * 2;
const wmLine =
  measured && measured.peakOk
    ? 'Viiul: staff-indeksid scripts/wikimedia-measured-key-positions.json (pitch→staff; Commons piltidel kinnitatud tippude arv). Horisontaal: 1×sp; märk ~2,5×sp. Wikimedia 4 võtit: public/reference/key-signatures-wikimedia-4-clefs.svg. Indeks 0 = alumine joon.'
    : 'Paigutus: Wikimedia „4 clefs” tabel (public/reference/key-signatures-wikimedia-4-clefs.svg) — samm 1×sp; märk ~2,5×sp. Võtmed: ClefSymbols. Indeks 0 = alumine joon. Genereeri JSON: node scripts/analyze-wikimedia-keysig-images.mjs.';
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${totalHeight}" width="${svgW}" height="${totalHeight}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Bravura';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('${BRAVURA_WOFF2}') format('woff2');
      }
    ]]></style>
  </defs>
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${svgW / 2}" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="#111">Helistikud ja võtmemärgid (SMuFL / Bravura)</text>
  <text x="${svgW / 2}" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#555">${esc(wmLine)}</text>
  ${svgInner}
  <text x="${margin}" y="${totalHeight - 12}" font-family="system-ui,sans-serif" font-size="9.5" fill="#777">Uuenda: node scripts/generate-key-signatures-reference-svg.mjs</text>
</svg>
`;

fs.writeFileSync(OUT, svg, 'utf8');
console.log('Wrote', OUT);
