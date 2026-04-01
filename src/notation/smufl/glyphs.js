// SMuFL (Standard Music Font Layout) codepoints (Private Use Area).
// We keep this small & explicit to avoid bundling the full metadata JSON.
// Precomposed notes (note+stem+flag in one glyph) = font design; use these instead of drawing stem/flag by hand.

export const SMUFL_GLYPH = Object.freeze({
  // Staff brackets and dividers (system bracket = bracketTop + line + bracketBottom)
  brace: '\uE000',
  bracket: '\uE002',
  bracketTop: '\uE003',
  bracketBottom: '\uE004',
  systemDivider: '\uE007',

  // Clefs
  gClef: '\uE050',
  cClef: '\uE05C',
  fClef: '\uE062',

  // Accidentals (key signatures, etc.)
  accidentalSharp: '\uE262',

  // Noteheads (for beamed notes or when stem length is custom)
  noteheadWhole: '\uE0A2',
  noteheadHalf: '\uE0A3',
  noteheadBlack: '\uE0A4',
  noteheadXBlack: '\uE0A9',
  noteheadSquareBlack: '\uE0B9',
  noteheadTriangleUpBlack: '\uE0BE',

  // Precomposed notes (U+E1D0–E1EF): full note from font – use for standalone notes
  noteWhole: '\uE1D2',
  noteHalfUp: '\uE1D3', noteHalfDown: '\uE1D4',
  noteQuarterUp: '\uE1D5', noteQuarterDown: '\uE1D6',
  note8thUp: '\uE1D7', note8thDown: '\uE1D8',
  note16thUp: '\uE1D9', note16thDown: '\uE1DA',
  note32ndUp: '\uE1DB', note32ndDown: '\uE1DC',

  // Rests
  restDoubleWhole: '\uE4E2',
  restWhole: '\uE4E3',
  restHalf: '\uE4E4',
  restQuarter: '\uE4E5',
  rest8th: '\uE4E6',
  rest16th: '\uE4E7',
  rest32nd: '\uE4E8',

  // Repeats and jumps (Leland / SMuFL U+E040–E04F) – for toolbox "Kordused ja hüpped"
  repeatLeft: '\uE040',       // start repeat (|:)
  repeatRight: '\uE041',     // end repeat (:|)
  repeatDots: '\uE043',      // repeat dots (center)
  repeatDot: '\uE044',       // single repeat dot
  dalSegno: '\uE045',        // Dal segno
  daCapo: '\uE046',          // Da capo
  segno: '\uE047',           // Segno (𝄋)
  coda: '\uE048',            // Coda (𝄌)
  codaSquare: '\uE049',      // square coda

  // Barlines (Leland / SMuFL)
  barlineFinal: '\uE032',    // final/ending barline (thin + thick double bar)

  // Time signatures (U+E080–U+E089) – Leland/SMuFL
  timeSig0: '\uE080',
  timeSig1: '\uE081',
  timeSig2: '\uE082',
  timeSig3: '\uE083',
  timeSig4: '\uE084',
  timeSig5: '\uE085',
  timeSig6: '\uE086',
  timeSig7: '\uE087',
  timeSig8: '\uE088',
  timeSig9: '\uE089',
});

export const SMUFL_MUSIC_FONT_FAMILY = 'Leland';

/** Leland time signature digit glyph for 0–9. */
export function smuflTimeSigDigit(digit) {
  const n = Math.floor(Number(digit));
  if (n < 0 || n > 9) return null;
  return String.fromCharCode(0xE080 + n);
}

/** Array of Leland timeSig glyphs for a number (e.g. 4 → [4], 16 → [1,6]). */
export function smuflTimeSigDigitsForNumber(num) {
  const s = String(Math.max(0, Math.floor(Number(num))));
  return s.split('').map((c) => smuflTimeSigDigit(parseInt(c, 10))).filter(Boolean);
}

/** Shape key for notehead (oval, x, square, triangle). Used by toolbox and rendering. */
export const NOTEHEAD_SHAPE_GLYPH = {
  oval: SMUFL_GLYPH.noteheadBlack,
  x: SMUFL_GLYPH.noteheadXBlack,
  square: SMUFL_GLYPH.noteheadSquareBlack,
  triangle: SMUFL_GLYPH.noteheadTriangleUpBlack,
};

export function smuflNoteheadForType(type, shapeKey = 'oval') {
  const shapeGlyph = NOTEHEAD_SHAPE_GLYPH[shapeKey];
  const defaultGlyph = shapeGlyph || SMUFL_GLYPH.noteheadBlack;
  switch (type) {
    case 'whole':
      return SMUFL_GLYPH.noteheadWhole;
    case 'half':
      return SMUFL_GLYPH.noteheadHalf;
    case 'quarter':
    case 'eighth':
    case 'sixteenth':
    default:
      return defaultGlyph;
  }
}

export function smuflRestForDurationLabel(durationLabel) {
  switch (durationLabel) {
    case '1/1':
      return SMUFL_GLYPH.restWhole;
    case '1/2':
      return SMUFL_GLYPH.restHalf;
    case '1/4':
      return SMUFL_GLYPH.restQuarter;
    case '1/8':
      return SMUFL_GLYPH.rest8th;
    case '1/16':
      return SMUFL_GLYPH.rest16th;
    case '1/32':
      return SMUFL_GLYPH.rest32nd;
    default:
      return SMUFL_GLYPH.restQuarter;
  }
}

/** Map editor duration label to precomposed SMuFL note type (Leland U+E1D0–E1DC). */
export function smuflPrecomposedTypeForDurationLabel(durationLabel) {
  switch (durationLabel || '1/4') {
    case '1/1':
      return 'whole';
    case '1/2':
      return 'half';
    case '1/4':
      return 'quarter';
    case '1/8':
      return 'eighth';
    case '1/16':
      return 'sixteenth';
    case '1/32':
      return 'thirtySecond';
    default:
      return 'quarter';
  }
}

/** Precomposed note glyph (note+stem+flag from font). Returns null if we should draw head+stem+flag ourselves (e.g. beamed). */
export function smuflPrecomposedNote(type, stemUp = true, usePrecomposed = true) {
  if (!usePrecomposed) return null;
  const up = stemUp;
  switch (type) {
    case 'whole':
      return SMUFL_GLYPH.noteWhole;
    case 'half':
      return up ? SMUFL_GLYPH.noteHalfUp : SMUFL_GLYPH.noteHalfDown;
    case 'quarter':
      return up ? SMUFL_GLYPH.noteQuarterUp : SMUFL_GLYPH.noteQuarterDown;
    case 'eighth':
      return up ? SMUFL_GLYPH.note8thUp : SMUFL_GLYPH.note8thDown;
    case 'sixteenth':
      return up ? SMUFL_GLYPH.note16thUp : SMUFL_GLYPH.note16thDown;
    case 'thirtySecond':
      return up ? SMUFL_GLYPH.note32ndUp : SMUFL_GLYPH.note32ndDown;
    default:
      return null;
  }
}

