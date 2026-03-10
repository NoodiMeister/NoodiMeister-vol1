// SMuFL (Standard Music Font Layout) codepoints (Private Use Area).
// We keep this small & explicit to avoid bundling the full metadata JSON.
// Precomposed notes (note+stem+flag in one glyph) = font design; use these instead of drawing stem/flag by hand.

export const SMUFL_GLYPH = Object.freeze({
  // Clefs
  gClef: '\uE050',
  cClef: '\uE05C',
  fClef: '\uE062',

  // Noteheads (for beamed notes or when stem length is custom)
  noteheadWhole: '\uE0A2',
  noteheadHalf: '\uE0A3',
  noteheadBlack: '\uE0A4',

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
});

export function smuflNoteheadForType(type) {
  switch (type) {
    case 'whole':
      return SMUFL_GLYPH.noteheadWhole;
    case 'half':
      return SMUFL_GLYPH.noteheadHalf;
    case 'quarter':
    case 'eighth':
    case 'sixteenth':
    default:
      return SMUFL_GLYPH.noteheadBlack;
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

