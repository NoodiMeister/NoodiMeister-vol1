/**
 * Genereerib public/rhythm-reference-table.svg — tabel kõikidest rütmikasti
 * väärtustest SMuFL (Bravura) eelvaatega. Font: sama mis @fontsource/bravura.
 *
 * Liitrütmid: sama BeamCalculation + geomeetria mis BeamedRhythmPatternIcon / TraditionalNotationView.
 *
 * Käivita: node scripts/generate-rhythm-smufl-table-svg.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { beamLineYAtX, computeBeamGroups, computeBeamGeometry } from '../src/notation/BeamCalculation.js';
import {
  getBeamGap,
  getBeamThickness,
  getStemCenterXFromNoteCenter,
  getStemLength,
  getStemThickness,
  SMUFL_BRAVURA_NOTEHEAD_BLACK_WIDTH_SP,
} from '../src/notation/StaffConstants.js';
import { getGlyphFontSize } from '../src/notation/musescoreStyle.js';
import { RHYTHM_PATTERN_SEGMENTS } from '../src/notation/rhythmPatternSpecs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../public/rhythm-reference-table.svg');

const BRAVURA_WOFF2 =
  'https://cdn.jsdelivr.net/npm/@fontsource/bravura@5.2.5/files/bravura-latin-400-normal.woff2';

const SM = {
  nh: '&#xE0A4;',
  whole: '&#xE1D2;',
  halfUp: '&#xE1D3;',
  qUp: '&#xE1D5;',
  e8Up: '&#xE1D7;',
  e16Up: '&#xE1D9;',
  e32Up: '&#xE1DB;',
  rWhole: '&#xE4E3;',
  rHalf: '&#xE4E4;',
  rQ: '&#xE4E5;',
  r8: '&#xE4E6;',
  r16: '&#xE4E7;',
  r32: '&#xE4E8;',
  dot: '&#xE1E7;',
};

const TIME_SIG = { beats: 4, beatUnit: 4 };
const ICON_STAFF_SPACE = 5;
const FILL = '#1a1a1a';
const BRAVURA_FF = 'Bravura,serif';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildNotesFromSegments(segments) {
  let beat = 0;
  return segments.map((seg) => {
    const n = {
      durationLabel: seg.durationLabel,
      duration: seg.duration,
      isRest: false,
      beat,
      isDotted: false,
      ...(seg.beamGroupId != null ? { beamGroupId: seg.beamGroupId } : {}),
      ...(seg.tuplet ? { tuplet: seg.tuplet } : {}),
    };
    beat += seg.duration;
    return n;
  });
}

function layoutNoteXs(notes, contentWidthPx) {
  const total = notes.reduce((s, n) => s + n.duration, 0) || 1;
  const xs = [];
  let acc = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const center = acc + n.duration / 2;
    xs.push(-contentWidthPx / 2 + (center / total) * contentWidthPx);
    acc += n.duration;
  }
  return xs;
}

/**
 * Sama loogika mis BeamedRhythmPatternIcon.jsx — SVG string (lokaalne koordinaadistik: keskjoon y=0).
 */
function renderBeamedPatternInner(segments) {
  const staffSpace = ICON_STAFF_SPACE;
  const middleLineY = 0;
  const notes = buildNotesFromSegments(segments);
  const contentW = Math.max(22, segments.length * 5) * staffSpace * 0.32;
  const noteXs = layoutNoteXs(notes, contentW);
  const noteCys = notes.map(() => middleLineY);
  const stemUp = true;
  const bravuraHeadOpts = { noteheadWidthSp: SMUFL_BRAVURA_NOTEHEAD_BLACK_WIDTH_SP };
  const beamGroups = computeBeamGroups(notes, 0, TIME_SIG).map((gr) => {
    const geom = computeBeamGeometry(gr, notes, noteXs, noteCys, stemUp, staffSpace, bravuraHeadOpts);
    return { ...gr, ...geom, noteXs };
  });
  const defaultStemLen = getStemLength(staffSpace);
  const stemStrokeW = getStemThickness(staffSpace);
  const glyphFontSize = getGlyphFontSize(staffSpace);
  const beamThick = getBeamThickness(staffSpace);
  const beamGap = getBeamGap(staffSpace);
  const beamOffset = beamThick + beamGap;

  const parts = [];
  const drawnBeamStarts = new Set();

  const getBeamGroup = (i) => beamGroups.find((g) => i >= g.start && i <= g.end);

  for (let i = 0; i < notes.length; i++) {
    const noteX = noteXs[i];
    const cy = noteCys[i];
    const beamGroup = getBeamGroup(i);
    const stemLen = beamGroup ? beamGroup.stemLengths[i - beamGroup.start] ?? defaultStemLen : defaultStemLen;
    const stemX = getStemCenterXFromNoteCenter(noteX, staffSpace, stemUp, bravuraHeadOpts);
    const stemY2 = cy - stemLen;

    parts.push(
      `<text x="${noteX}" y="${cy}" font-family="${BRAVURA_FF}" font-size="${glyphFontSize}" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${SM.nh}</text>`
    );
    parts.push(
      `<line x1="${stemX}" y1="${cy}" x2="${stemX}" y2="${stemY2}" stroke="${FILL}" stroke-width="${stemStrokeW}" stroke-linecap="butt"/>`
    );

    if (beamGroup && i === beamGroup.start && !drawnBeamStarts.has(beamGroup.start)) {
      drawnBeamStarts.add(beamGroup.start);
      const dir = beamGroup.stemUp ? -1 : 1;
      const y1 = beamGroup.beamY1;
      const slope = beamGroup.beamSlope ?? 0;
      const xs = beamGroup.stemXsInGroup;
      const sw = beamGroup.stemW ?? stemStrokeW;
      /* Tala kirjutusjärjekord (SVG/DOM): b=numBeams-1 .. 0 — sekundaarne/osaline span enne, esmane tala viimasena (peal).
       * x otspunktid varre välisservadel (beamXLeft/Right); osaline tala stemXsInGroup[idxMin], idxMax. */
      for (let b = beamGroup.numBeams - 1; b >= 0; b--) {
        let xL = beamGroup.beamXLeft;
        let xR = beamGroup.beamXRight;
        if (b >= 1 && beamGroup.beamLevels && xs?.length) {
          const levels = beamGroup.beamLevels;
          const idxMin = levels.findIndex((lev) => lev >= b + 1);
          const idxMax = levels.length - 1 - [...levels].reverse().findIndex((lev) => lev >= b + 1);
          if (idxMin >= 0 && idxMax >= 0) {
            xL = xs[idxMin] - sw / 2;
            xR = xs[idxMax] + sw / 2;
          }
        }
        const swap = beamGroup.mixedBeamStackSwap;
        const dy = (swap ? beamGroup.numBeams - 1 - b : b) * beamOffset * dir;
        const yL = beamLineYAtX(y1, slope, beamGroup.xLeft, xL, dy);
        const yR = beamLineYAtX(y1, slope, beamGroup.xLeft, xR, dy);
        parts.push(
          `<line x1="${xL}" y1="${yL}" x2="${xR}" y2="${yR}" stroke="${FILL}" stroke-width="${beamThick}" stroke-linecap="butt"/>`
        );
      }
    }
  }

  const staffTop = -2 * staffSpace;
  const staffBottom = 2 * staffSpace;
  const beamTopExtra =
    beamGroups.length > 0
      ? Math.min(...beamGroups.map((g) => Math.min(g.beamY1, g.beamY2) - g.numBeams * beamOffset))
      : staffTop;
  const extTop = Math.min(staffTop, beamTopExtra);
  const pad = staffSpace * 1.2;
  const vbMinY = extTop - pad;
  const vbMaxY = staffBottom + staffSpace * 2.2;
  const vbHalfW = contentW / 2 + staffSpace * 2;

  /* Üks keskjoon nagu cellPre ridadel — mitte täis viiejoone süsteem (vähem müra, sama stiil). */
  const staffLine = `<line x1="${-vbHalfW}" y1="0" x2="${vbHalfW}" y2="0" stroke="#e5e5e5" stroke-width="0.6"/>`;

  return {
    innerSvgBody: staffLine + parts.join(''),
    vbHalfW,
    vbMinY,
    vbMaxY,
  };
}

function cellBeamedPattern(patternKey, cellWOverride) {
  const segments = RHYTHM_PATTERN_SEGMENTS[patternKey];
  if (!segments?.length) return cellSmufl('<!-- missing pattern -->');

  const { innerSvgBody, vbHalfW, vbMinY, vbMaxY } = renderBeamedPatternInner(segments);
  const vbW = vbHalfW * 2;
  const vbH = vbMaxY - vbMinY;
  const displayW = cellWOverride ?? Math.max(88, Math.ceil(vbW + ICON_STAFF_SPACE * 1.6));
  const displayH = 36;

  const isTriplet = patternKey === 'triplet-8' || patternKey === 'triplet-4';
  const tripletEl = isTriplet
    ? `<text x="0" y="${vbMinY + ICON_STAFF_SPACE * 0.85}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${ICON_STAFF_SPACE * 1.15}" font-weight="700" fill="${FILL}">3</text>`
    : '';

  /* Sama viewBox / aspect kui BeamedRhythmPatternIcon — ei suru geomeetriat 0..36 kasti (see rikus tala suhte). */
  return `<svg width="${displayW}" height="${displayH}" viewBox="${-vbHalfW} ${vbMinY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" overflow="visible">${tripletEl}${innerSvgBody}</svg>`;
}

function cellSmufl(inner, w = 88, h = 36) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${inner}</svg>`;
}

function cellPre(glyph, fs = 26, w = 88) {
  const mid = w / 2;
  return cellSmufl(
    `<line x1="4" y1="22" x2="${w - 4}" y2="22" stroke="#e5e5e5" stroke-width="0.6"/><text x="${mid}" y="22" font-family="${BRAVURA_FF}" font-size="${fs}" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${glyph}</text>`,
    w,
    36
  );
}

function cellPreDotted(glyph, fs = 26, w = 88) {
  const mid = w / 2;
  const sp = fs / 4;
  const rx = 0.7 * sp;
  const gap = 0.5 * sp;
  const dotX = mid + rx + gap;
  const staffY = 22;
  const dotY = staffY - 0.5 * sp;
  return cellSmufl(
    `<line x1="4" y1="${staffY}" x2="${w - 4}" y2="${staffY}" stroke="#e5e5e5" stroke-width="0.6"/><text x="${mid}" y="${staffY}" font-family="${BRAVURA_FF}" font-size="${fs}" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${glyph}</text><text x="${dotX}" y="${dotY}" font-family="${BRAVURA_FF}" font-size="${fs}" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${SM.dot}</text>`,
    w,
    36
  );
}

function cellBeamSchematic(digit) {
  return cellSmufl(
    `<g fill="none" stroke="${FILL}" stroke-width="1.2"><line x1="8" y1="10" x2="80" y2="10"/><line x1="8" y1="26" x2="80" y2="26"/></g><text x="44" y="20" font-family="system-ui,sans-serif" font-size="9" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${digit}</text>`
  );
}

function cellBeamSchematicTxt(t) {
  return cellSmufl(
    `<g fill="none" stroke="${FILL}" stroke-width="1"><line x1="6" y1="9" x2="82" y2="9"/><line x1="6" y1="13" x2="82" y2="13"/></g><text x="44" y="24" font-family="system-ui,sans-serif" font-size="7" fill="${FILL}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`
  );
}

/** Vihje: mitme tala korral alumine kiht enne, ülemine viimasena (sama mis renderBeamedPatternInner). */
function cellBeamZOrderHint() {
  return cellSmufl(
    `<text x="44" y="14" font-family="system-ui,sans-serif" font-size="7" fill="${FILL}" text-anchor="middle">1. alt</text><text x="44" y="26" font-family="system-ui,sans-serif" font-size="7" fill="${FILL}" text-anchor="middle">2. peal</text>`,
    88,
    36
  );
}

const rows = [];
function addRow(cat, value, etDesc, previewInner, w = 88) {
  rows.push({ cat, value, etDesc, previewInner, w });
}

addRow('Noot', '1/32', 'Kuuskümnendiknoot (U+E1DB)', cellPre(SM.e32Up, 24));
addRow('Noot', '1/16', 'Kuueteistkümnendiknoot (U+E1D9)', cellPre(SM.e16Up, 24));
addRow('Noot', '1/8', 'Kaheksandiknoot (U+E1D7)', cellPre(SM.e8Up, 26));
addRow('Noot', '1/4', 'Neljandiknoot (U+E1D5)', cellPre(SM.qUp, 26));
addRow('Noot', '1/2', 'Poolnoot (U+E1D3)', cellPre(SM.halfUp, 26));
addRow('Noot', '1/1', 'Täisnoot (U+E1D2)', cellPre(SM.whole, 22));

addRow('Paus', '1/1', 'Täispaus U+E4E3', cellPre(SM.rWhole, 22));
addRow('Paus', '1/2', 'Poolpaus U+E4E4', cellPre(SM.rHalf, 22));
addRow('Paus', '1/4', 'Neljandikpaus U+E4E5', cellPre(SM.rQ, 24));
addRow('Paus', '1/8', 'Kaheksandikpaus U+E4E6', cellPre(SM.r8, 24));
addRow('Paus', '1/16', 'Kuueteistkümnendikpaus U+E4E7', cellPre(SM.r16, 24));
addRow('Paus', '1/32', 'Kuuskümnendikpaus U+E4E8', cellPre(SM.r32, 22));

addRow('Lüliti', 'rest', 'Paus-režiim (0 + vältus)', cellPre(SM.rQ, 24));
addRow('Lüliti', 'dotted', 'Punktiga (näide neljandik)', cellPreDotted(SM.qUp, 24));

addRow('Liit', '2/8', '2×1/8 (BeamCalculation, vars üles)', cellBeamedPattern('2/8'));
addRow('Liit', '2/8+2/8', 'Kaks eraldi tala', cellBeamedPattern('2/8+2/8'));
addRow('Liit', '4/8', '4×1/8 üks tala', cellBeamedPattern('4/8'));
addRow('Liit', '4/16', '4×1/16', cellBeamedPattern('4/16'));
addRow('Liit', '8/16', '8×1/16 (kaks rühma)', cellBeamedPattern('8/16', 148), 148);
addRow(
  'Liit',
  '1/8+2/16',
  'Segarütm (esmane tala väljas, osaline 2/16 sees — vt beam-samples/beam-1-8-plus-2-16.svg)',
  cellBeamedPattern('1/8+2/16')
);
addRow('Liit', '2/16+1/8', 'Segarütm', cellBeamedPattern('2/16+1/8'));
addRow('Liit', 'triplet-8', 'Triool kaheksandikud', cellBeamedPattern('triplet-8'));
addRow(
  'Liit',
  'triplet-4',
  'Triool veerandikud (1/4 ei taluta — tala puudub, nagu partituuris)',
  cellBeamedPattern('triplet-4')
);

addRow('Beam', 'beam:auto', 'Automaatne (skeem)', cellBeamSchematic('A'));
addRow('Beam', 'beam:2/8', '2/8 kaupa (skeem)', cellBeamSchematic('2'));
addRow('Beam', 'beam:3/8', '3/8 kaupa (skeem)', cellBeamSchematic('3'));
addRow('Beam', 'beam:4/8', '4/8 (skeem)', cellBeamSchematic('4'));
addRow('Beam', 'beam:3/16', '3/16 (skeem)', cellBeamSchematicTxt('3/16'));
addRow(
  'Beam',
  'z-order',
  'Mitme talaastmega: osaline/sekundaarne span enne (alumine kiht), esmane täispikk tala viimasena (peal). Hori. tala: stroke ei pikenda x-s; x-vahemik = varre välisservad. Näidis: public/beam-samples/beam-1-8-plus-2-16.svg.',
  cellBeamZOrderHint()
);

const rowH = 42;
const startY = 92;
const colCat = 28;
const colVal = 160;
const colPrev = 300;
const colEt = 430;
const tableW = 900;
const totalH = startY + rows.length * rowH + 118;

function embedPreview(r) {
  const w = r.w || 88;
  const updated = r.previewInner.replace(/width="[^"]+"/, `width="${w}"`).replace(/viewBox="0 0 \d+ /, `viewBox="0 0 ${w} `);
  const ty = (rowH - 36) / 2;
  return `<g transform="translate(${colPrev},${ty})">${updated}</g>`;
}

let body = '';
rows.forEach((r, i) => {
  const y = startY + i * rowH;
  body += `<g transform="translate(0,${y})">`;
  body += `<line x1="20" y1="${rowH - 2}" x2="${tableW - 20}" y2="${rowH - 2}" stroke="#eee"/>`;
  body += `<text x="${colCat}" y="${rowH / 2 + 4}" font-family="system-ui,sans-serif" font-size="11" fill="#444">${esc(r.cat)}</text>`;
  body += `<text x="${colVal}" y="${rowH / 2 + 4}" font-family="ui-monospace,monospace" font-size="11" fill="#1a1a1a">${esc(r.value)}</text>`;
  body += embedPreview(r);
  body += `<text x="${colEt}" y="${rowH / 2 + 4}" font-family="system-ui,sans-serif" font-size="11" fill="#333">${esc(r.etDesc)}</text>`;
  body += '</g>';
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tableW} ${totalH}" width="${tableW}" height="${totalH}">
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
  <text x="${tableW / 2}" y="36" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#1a1a1a">Noodimeister — rütmid ja rühmad (SMuFL / Bravura)</text>
  <text x="${tableW / 2}" y="56" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#555">Eelvaade: Bravura WOFF2. Liit: BeamCalculation (õige viewBox + tala pikkus iga rütmataseme jaoks, nagu partituur).</text>
  <rect x="20" y="68" width="${tableW - 40}" height="22" fill="#e7e5e4" stroke="#d6d3d1"/>
  <text x="${colCat}" y="84" font-family="system-ui,sans-serif" font-size="11" font-weight="700">Kategooria</text>
  <text x="${colVal}" y="84" font-family="system-ui,sans-serif" font-size="11" font-weight="700">value</text>
  <text x="${colPrev}" y="84" font-family="system-ui,sans-serif" font-size="11" font-weight="700">SMuFL eelvaade</text>
  <text x="${colEt}" y="84" font-family="system-ui,sans-serif" font-size="11" font-weight="700">Kirjeldus</text>
  ${body}
  <text x="24" y="${totalH - 66}" font-family="system-ui,sans-serif" font-size="10" fill="#666">Beam-read: ainult skeem (mitte SMuFL), nagu rhythmToolbox BEAM_MODE_ICONS.</text>
  <text x="24" y="${totalH - 48}" font-family="system-ui,sans-serif" font-size="10" fill="#666">Tala kihid (z-order): rea Beam / z-order; näidis beam-samples/beam-1-8-plus-2-16.svg.</text>
  <text x="24" y="${totalH - 30}" font-family="system-ui,sans-serif" font-size="10" fill="#666">Uuenda: node scripts/generate-rhythm-smufl-table-svg.mjs</text>
</svg>`;

writeFileSync(outPath, svg, 'utf8');
console.log('Wrote', outPath, `(${rows.length} rows)`);
